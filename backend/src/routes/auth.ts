import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  clearSessionCookie,
  parseCookies,
  requireAuth,
  setSessionCookie,
} from "../lib/auth.js";
import { hashSessionToken, newSessionToken, verifyPassword } from "../lib/password.js";
import { sendInvalid } from "../lib/validate.js";

const router = Router();

/** Strict per-IP budget for credential guessing. Counts failures AND successes. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ ok: false, error: "Too many login attempts. Try again later." });
  },
});

const loginBody = z.object({
  email: z.string().trim().email().max(160),
  password: z.string().min(1).max(256),
});

function publicUser(u: {
  id: string;
  email: string;
  role: string;
  companyId: string | null;
  studentProfile: { id: string } | null;
}) {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    companyId: u.companyId,
    studentProfileId: u.studentProfile?.id ?? null,
  };
}

/**
 * POST /api/auth/login — verify credentials, mint a revocable session.
 * Uniform 401 for unknown email, wrong password, or inactive account
 * (no account-enumeration leak). Sets an HttpOnly session cookie.
 */
router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) return sendInvalid(res, parsed.error);
    const email = parsed.data.email.toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email },
      include: { studentProfile: { select: { id: true } } },
    });
    const ok =
      user !== null &&
      user.isActive &&
      (await verifyPassword(parsed.data.password, user.passwordHash));
    if (!ok || !user) {
      res.status(401).json({ ok: false, error: "Invalid email or password" });
      return;
    }
    const token = newSessionToken();
    await prisma.session.create({
      data: {
        tokenHash: hashSessionToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        userAgent: String(req.headers["user-agent"] ?? "").slice(0, 200) || null,
        ip: req.ip ?? null,
      },
    });
    setSessionCookie(res, req, token);
    res.json({ ok: true, data: { user: publicUser(user) } });
  } catch (err) {
    next(err);
  }
});

/** POST /api/auth/logout — revoke the current session and clear the cookie. */
router.post("/logout", requireAuth, async (req, res, next) => {
  try {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (token) {
      await prisma.session.updateMany({
        where: { tokenHash: hashSessionToken(token), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/** GET /api/auth/me — the caller's identity, role, and profile association. */
router.get("/me", requireAuth, (req, res) => {
  res.json({
    ok: true,
    data: {
      user: {
        id: req.auth?.id,
        email: req.auth?.email,
        role: req.auth?.role,
        companyId: req.auth?.companyId,
        studentProfileId: req.auth?.studentProfileId,
      },
    },
  });
});

export default router;
