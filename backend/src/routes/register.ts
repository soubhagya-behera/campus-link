import { Router } from "express";
import prisma from "../lib/prisma.js";
import { OTP_LENGTH, generateOtp, hashOtp, isOtpShape, verifyOtp } from "../lib/otp.js";
import { newSessionToken } from "../lib/password.js";
import {
  COMPLETION_TTL_MS,
  MAX_SENDS_PER_ATTEMPT,
  MAX_VERIFY_ATTEMPTS,
  OTP_TTL_MS,
  RESEND_COOLDOWN_MS,
  hashCompletionToken,
  maskEmail,
  prepareStart,
  startBody,
  verifyBody,
} from "../lib/registration.js";
import { MailNotConfiguredError, isMailConfigured, missingMailVars, sendVerificationCode } from "../lib/mail.js";
import { sendInvalid } from "../lib/validate.js";
import { completeRegistration } from "./register-complete.js";
import {
  agentOf,
  completeLimiter,
  mailNotConfigured,
  retireCode,
  sendLimiter,
  verifyLimiter,
} from "./register-shared.js";

/**
 * Public student registration. Three steps on one URL:
 *
 *   POST /api/auth/register/start      step 1 → emails a code, creates NO user
 *   POST /api/auth/register/verify     step 2 → exchanges the code for a
 *                                       short-lived completion token
 *   POST /api/auth/register/complete   step 3 → creates the STUDENT user and
 *                                       profile, then mints a session
 *                                       (see ./register-complete.ts)
 *
 * Invariants enforced here:
 *  - An account exists only after a code is verified. Steps 1 and 2 never
 *    touch the User or StudentProfile tables.
 *  - The role is the literal `STUDENT`, never read from the body; the step-1
 *    schema is `.strict()`, so `role`, `isActive` or `companyId` sent by a
 *    public client are rejected as unknown keys.
 *  - Codes are stored only as HMACs, are single-use, attempt-capped and
 *    expiry-capped on the server.
 */
const router = Router();

/**
 * POST /api/auth/register/start — validate the academic details, refuse
 * duplicates, and email a code. Creates no account.
 */
router.post("/start", sendLimiter, async (req, res, next) => {
  try {
    if (!isMailConfigured()) {
      // Variable names only, never their values.
      // eslint-disable-next-line no-console
      console.warn(`[mail] registration unavailable; missing ${missingMailVars().join(", ")}`);
      return mailNotConfigured(res);
    }

    const parsed = startBody.safeParse(req.body);
    if (!parsed.success) return sendInvalid(res, parsed.error);
    const input = prepareStart(parsed.data);

    const [emailTaken, enrollmentTaken, enrollmentHeld] = await Promise.all([
      prisma.user.findUnique({ where: { email: input.email }, select: { id: true } }),
      prisma.studentProfile.findUnique({ where: { enrollmentNo: input.enrollmentNo }, select: { id: true } }),
      // A *different* email mid-registration on this number. The student's own
      // in-flight attempt is excluded, so resending their code is not treated
      // as someone else having claimed their registration number.
      prisma.registrationAttempt.findFirst({
        where: { enrollmentNo: input.enrollmentNo, consumedAt: null, NOT: { email: input.email } },
        select: { id: true },
      }),
    ]);
    if (emailTaken) {
      res.status(409).json({ ok: false, error: "An account already exists for this email address." });
      return;
    }
    if (enrollmentTaken || enrollmentHeld) {
      res.status(409).json({ ok: false, error: "This college registration number is already registered." });
      return;
    }

    const now = new Date();
    const existing = await prisma.registrationAttempt.findUnique({
      where: { activeEmail: input.email },
    });

    // Cooldown and send cap are checked before anything is written, so a
    // blocked request leaves no trace and mints no code.
    if (existing && existing.resendAvailableAt > now) {
      const waitSeconds = Math.ceil((existing.resendAvailableAt.getTime() - now.getTime()) / 1000);
      res.status(429).json({
        ok: false,
        error: `Please wait ${waitSeconds}s before requesting another code.`,
      });
      return;
    }
    if (existing && existing.sendCount >= MAX_SENDS_PER_ATTEMPT) {
      res.status(429).json({
        ok: false,
        error: "Too many codes requested for this email. Please try again later.",
      });
      return;
    }

    const otpExpiresAt = new Date(now.getTime() + OTP_TTL_MS);
    const resendAvailableAt = new Date(now.getTime() + RESEND_COOLDOWN_MS);
    const code = generateOtp();
    const fields = {
      fullName: input.fullName,
      enrollmentNo: input.enrollmentNo,
      branch: input.branch,
      graduationYear: input.graduationYear,
      institution: input.institution,
    };

    // The OTP hash is keyed on the attempt id, which Prisma generates. A brand
    // new attempt is therefore created and then stamped inside one transaction.
    const attempt = existing
      ? await prisma.registrationAttempt.update({
          where: { id: existing.id },
          data: {
            ...fields,
            otpHash: hashOtp(existing.id, code),
            otpExpiresAt,
            resendAvailableAt,
            // A fresh code invalidates any earlier verification: the student
            // must prove they still control the mailbox.
            verifiedAt: null,
            completionTokenHash: null,
            completionExpiresAt: null,
            sendCount: { increment: 1 },
          },
        })
      : await prisma.$transaction(async (tx) => {
          const row = await tx.registrationAttempt.create({
            data: {
              ...fields,
              activeEmail: input.email,
              email: input.email,
              maxVerifyAttempts: MAX_VERIFY_ATTEMPTS,
              resendAvailableAt,
              otpExpiresAt,
              ip: req.ip ?? null,
              userAgent: agentOf(req.headers["user-agent"]),
            },
          });
          return tx.registrationAttempt.update({
            where: { id: row.id },
            data: { otpHash: hashOtp(row.id, code), sendCount: 1 },
          });
        });

    try {
      await sendVerificationCode({
        to: input.email,
        name: input.fullName.split(" ")[0] || "there",
        code,
        expiresInMinutes: Math.round(OTP_TTL_MS / 60000),
      });
    } catch (err) {
      // Delivery failed: retire the code rather than leave a live one nobody
      // received. Never report success for a message that did not send.
      await retireCode(attempt.id);
      if (err instanceof MailNotConfiguredError) return mailNotConfigured(res);
      // eslint-disable-next-line no-console
      console.error("[mail] verification email failed:", err instanceof Error ? err.message : err);
      res.status(502).json({ ok: false, error: "We could not send the verification email. Try again." });
      return;
    }

    res.json({
      ok: true,
      data: {
        attemptId: attempt.id,
        emailMasked: maskEmail(input.email),
        expiresAt: otpExpiresAt.toISOString(),
        resendAvailableAt: resendAvailableAt.toISOString(),
        codeLength: OTP_LENGTH,
        maxAttempts: attempt.maxVerifyAttempts,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/register/verify — exchange a valid code for a single-use,
 * short-lived completion token bound to this attempt and email.
 */
router.post("/verify", verifyLimiter, async (req, res, next) => {
  try {
    const parsed = verifyBody.safeParse(req.body);
    if (!parsed.success) return sendInvalid(res, parsed.error);
    const { attemptId, code } = parsed.data;
    if (!isOtpShape(code)) {
      res.status(400).json({ ok: false, error: `Enter the ${OTP_LENGTH}-digit code from your email.` });
      return;
    }

    const attempt = await prisma.registrationAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.consumedAt) {
      res.status(404).json({ ok: false, error: "This registration attempt no longer exists." });
      return;
    }
    if (attempt.verifiedAt && !attempt.otpHash) {
      res.status(409).json({ ok: false, error: "This code has already been used." });
      return;
    }
    if (attempt.verifyAttempts >= attempt.maxVerifyAttempts) {
      res.status(429).json({ ok: false, error: "Too many incorrect codes. Request a new one to continue." });
      return;
    }
    if (!attempt.otpExpiresAt || attempt.otpExpiresAt <= new Date()) {
      res.status(410).json({ ok: false, error: "This code has expired. Request a new one." });
      return;
    }

    if (!verifyOtp(attemptId, code, attempt.otpHash)) {
      // Record the miss before answering, so guessing cannot outrun the cap.
      const after = await prisma.registrationAttempt.update({
        where: { id: attemptId },
        data: { verifyAttempts: { increment: 1 } },
        select: { verifyAttempts: true, maxVerifyAttempts: true },
      });
      const left = Math.max(0, after.maxVerifyAttempts - after.verifyAttempts);
      res.status(400).json({
        ok: false,
        error:
          left > 0
            ? "That code is not correct. Check the digits and try again."
            : "Too many incorrect codes. Request a new one to continue.",
      });
      return;
    }

    const completionToken = newSessionToken();
    const expiresAt = new Date(Date.now() + COMPLETION_TTL_MS);
    await prisma.registrationAttempt.update({
      where: { id: attemptId },
      data: {
        verifiedAt: new Date(),
        // Retiring the code is what makes verification single-use.
        otpHash: null,
        otpExpiresAt: null,
        completionTokenHash: hashCompletionToken(completionToken),
        completionExpiresAt: expiresAt,
      },
    });

    res.json({
      ok: true,
      data: { attemptId, completionToken, emailMasked: maskEmail(attempt.email), expiresAt: expiresAt.toISOString() },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/complete", completeLimiter, completeRegistration);

export default router;
