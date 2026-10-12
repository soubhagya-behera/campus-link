import type { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma.js";
import { SESSION_TTL_MS, setSessionCookie } from "../lib/auth.js";
import { hashPassword, hashSessionToken, newSessionToken } from "../lib/password.js";
import { checkPassword, completeBody, hashCompletionToken } from "../lib/registration.js";
import { sendInvalid } from "../lib/validate.js";
import {
  AlreadyCompletedError,
  agentOf,
  completeLimiter,
  isUniqueViolation,
} from "./register-shared.js";

/**
 * Step 3 of public student registration.
 *
 * Reached only with a `completionToken` that the server issued after a
 * successful email verification. This handler therefore never accepts a
 * profile from the browser: it reads the verified attempt row and copies those
 * values into the new StudentProfile, so nothing about the student can be
 * swapped after the fact.
 *
 * On success it mints a session with exactly the same cookie contract as
 * POST /api/auth/login.
 */
export async function completeRegistration(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = completeBody.safeParse(req.body);
    if (!parsed.success) return sendInvalid(res, parsed.error);
    const { attemptId, completionToken, password } = parsed.data;

    const policy = checkPassword(password);
    if (!policy.ok) {
      res.status(400).json({
        ok: false,
        error: "Password does not meet the requirements.",
        details: policy.problems.map((message) => ({ path: "password", message })),
      });
      return;
    }

    const attempt = await prisma.registrationAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.consumedAt) {
      res.status(404).json({ ok: false, error: "This registration attempt no longer exists." });
      return;
    }
    if (!attempt.verifiedAt) {
      res.status(422).json({ ok: false, error: "Verify your email address before setting a password." });
      return;
    }
    if (
      !attempt.completionTokenHash ||
      !attempt.completionExpiresAt ||
      attempt.completionExpiresAt <= new Date() ||
      attempt.completionTokenHash !== hashCompletionToken(completionToken)
    ) {
      res.status(410).json({ ok: false, error: "This verification has expired. Verify your email address again." });
      return;
    }

    // Re-check at the moment of creation: the row may have appeared between
    // step 1 and now.
    const [emailTaken, enrollmentTaken] = await Promise.all([
      prisma.user.findUnique({ where: { email: attempt.email }, select: { id: true } }),
      prisma.studentProfile.findUnique({ where: { enrollmentNo: attempt.enrollmentNo }, select: { id: true } }),
    ]);
    if (emailTaken) {
      res.status(409).json({ ok: false, error: "An account already exists for this email address." });
      return;
    }
    if (enrollmentTaken) {
      res.status(409).json({ ok: false, error: "This college registration number is already registered." });
      return;
    }

    // Hashed before the transaction opens: scrypt is deliberately slow and
    // must not hold a database transaction.
    const passwordHash = await hashPassword(password);

    try {
      // One transaction for the claim and both inserts, so a failure leaves
      // nothing half-built. The conditional update is the concurrency guard:
      // a second, racing request sees consumedAt already set and gets 409.
      const profile = await prisma.$transaction(async (tx) => {
        const claimed = await tx.registrationAttempt.updateMany({
          where: { id: attemptId, consumedAt: null, verifiedAt: { not: null } },
          data: { consumedAt: new Date(), activeEmail: null, completionTokenHash: null },
        });
        if (claimed.count === 0) throw new AlreadyCompletedError();

        const user = await tx.user.create({
          data: { email: attempt.email, passwordHash, role: "STUDENT", isActive: true },
        });
        return tx.studentProfile.create({
          data: {
            userId: user.id,
            fullName: attempt.fullName,
            enrollmentNo: attempt.enrollmentNo,
            branch: attempt.branch,
            graduationYear: attempt.graduationYear,
            institution: attempt.institution,
          },
        });
      });

      const token = newSessionToken();
      await prisma.session.create({
        data: {
          tokenHash: hashSessionToken(token),
          userId: profile.userId,
          expiresAt: new Date(Date.now() + SESSION_TTL_MS),
          userAgent: agentOf(req.headers["user-agent"]),
          ip: req.ip ?? null,
        },
      });
      setSessionCookie(res, req, token);

      res.status(201).json({
        ok: true,
        data: {
          user: {
            id: profile.userId,
            email: attempt.email,
            role: "STUDENT",
            companyId: null,
            studentProfileId: profile.id,
          },
        },
      });
    } catch (err) {
      if (err instanceof AlreadyCompletedError) {
        res.status(409).json({ ok: false, error: "This registration has already been completed." });
        return;
      }
      // A unique-constraint race (two simultaneous completes) must read as a
      // duplicate, not a 500. The transaction has already rolled back.
      if (isUniqueViolation(err)) {
        res.status(409).json({
          ok: false,
          error: "An account already exists for this email or registration number.",
        });
        return;
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}
