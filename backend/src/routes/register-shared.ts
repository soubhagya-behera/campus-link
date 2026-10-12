import rateLimit from "express-rate-limit";
import type { Response } from "express";
import prisma from "../lib/prisma.js";
import { missingMailVars } from "../lib/mail.js";

/**
 * Helpers shared by the registration route files, kept in one place so the
 * three steps cannot drift apart on limiters, user-agent truncation or the
 * mail-unavailable response.
 */

/** Shared limiter factory: per-IP only, since these routes are unauthenticated. */
function limiter(limit: number, message: string) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ ok: false, error: message });
    },
  });
}

/*
 * Per-IP budgets are deliberately loose: an entire campus can sit behind one
 * NAT address, so these are a blunt abuse guard only. The limits that actually
 * protect a single email are per-attempt (cooldown, send cap, attempt cap).
 */
export const sendLimiter = limiter(20, "Too many verification emails requested. Try again later.");
export const verifyLimiter = limiter(60, "Too many code attempts. Try again later.");
export const completeLimiter = limiter(20, "Too many attempts. Try again later.");

/** Bounded user-agent for the audit columns; never the raw header. */
export function agentOf(userAgent: string | undefined): string | null {
  return (userAgent ?? "").slice(0, 200) || null;
}

/** Prisma's unique-constraint violation. */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

/** 503 with the variable *names* that are unset — never their values. */
export function mailNotConfigured(res: Response): void {
  res.status(503).json({
    ok: false,
    error: "Email delivery is not configured on this server, so codes cannot be sent.",
    details: missingMailVars().map((path) => ({ path, message: "Not configured on the server" })),
  });
}

/** Invalidate a code that was minted but must not be usable. */
export async function retireCode(attemptId: string): Promise<void> {
  await prisma.registrationAttempt.updateMany({
    where: { id: attemptId, verifiedAt: null },
    data: { otpHash: null, otpExpiresAt: null },
  });
}

/** Thrown inside the completion transaction to abort it with a 409. */
export class AlreadyCompletedError extends Error {}
