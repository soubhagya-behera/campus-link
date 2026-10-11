import type { NextFunction, Request, Response } from "express";
import prisma from "./prisma.js";
import { hashSessionToken } from "./password.js";

export const SESSION_COOKIE = "campuslink_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, absolute

export type Role = "STUDENT" | "STAFF" | "RECRUITER" | "ADMIN";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  studentProfileId: string | null;
  companyId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

export function parseCookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  const header = req.headers.cookie;
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export function setSessionCookie(res: Response, req: Request, token: string): void {
  const secure = process.env.COOKIE_SECURE === "1" || req.secure;
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (secure) parts.push("Secure");
  res.appendHeader("Set-Cookie", parts.join("; "));
}

export function clearSessionCookie(res: Response): void {
  res.appendHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
}

/** 401 unless a live, unrevoked, unexpired session cookie maps to an active user. */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (!token) {
      res.status(401).json({ ok: false, error: "Authentication required" });
      return;
    }
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: { include: { studentProfile: { select: { id: true } } } } },
    });
    const now = new Date();
    if (!session || session.revokedAt || session.expiresAt <= now || !session.user.isActive) {
      res.status(401).json({ ok: false, error: "Authentication required" });
      return;
    }
    req.auth = {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role as Role,
      studentProfileId: session.user.studentProfile?.id ?? null,
      companyId: session.user.companyId,
    };
    next();
  } catch (err) {
    next(err);
  }
}

/** 403 unless the authenticated user holds one of the given roles. */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ ok: false, error: "Authentication required" });
      return;
    }
    if (!roles.includes(req.auth.role)) {
      res.status(403).json({ ok: false, error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

/**
 * CSRF guard for state-changing requests. Policy:
 * - Safe methods (GET/HEAD/OPTIONS) always pass (preflight carries no cookies).
 * - A request bearing a session cookie MUST prove its origin: a matching
 *   Origin header, else (when Origin is absent) a matching Referer — anything
 *   else is 403. This closes header-stripping CSRF against cookie auth.
 * - Requests WITHOUT a session cookie pass this check regardless of headers;
 *   authentication (401) and role ownership (403) still apply downstream.
 *   Documented in docs/API-CONTRACT.md.
 */
export function csrfOriginCheck(req: Request, res: Response, next: NextFunction): void {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next();
    return;
  }
  const allowed = process.env.CORS_ORIGIN ?? "http://127.0.0.1:5173";
  const origin = req.headers.origin;
  const referer = typeof req.headers.referer === "string" ? req.headers.referer : undefined;
  const hasSession = Boolean(parseCookies(req)[SESSION_COOKIE]);
  if (!origin && !referer) {
    // Only non-browser clients (curl, server-to-server) omit both headers.
    // With a session cookie present, headerless mutations are refused.
    if (hasSession) {
      res.status(403).json({ ok: false, error: "Cross-origin request refused" });
      return;
    }
    next();
    return;
  }
  const matches = (value: string): boolean => {
    try {
      return new URL(value).origin === allowed;
    } catch {
      return false;
    }
  };
  if ((origin && matches(origin)) || (!origin && referer && matches(referer))) {
    next();
    return;
  }
  res.status(403).json({ ok: false, error: "Cross-origin request refused" });
}

/**
 * Owner-or-placement gate for a studentProfileId taken from params/body.
 * Returns the effective id to use, or sends 401/403 and returns null.
 * RECRUITERs have no direct student-record access (candidates via own jobs).
 */
export function resolveStudentScope(
  req: Request,
  res: Response,
  requestedId: string,
): string | null {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ ok: false, error: "Authentication required" });
    return null;
  }
  if (auth.role === "STAFF" || auth.role === "ADMIN") return requestedId;
  if (auth.role === "STUDENT") {
    if (!auth.studentProfileId || auth.studentProfileId !== requestedId) {
      res.status(403).json({ ok: false, error: "Insufficient permissions" });
      return null;
    }
    return auth.studentProfileId;
  }
  res.status(403).json({ ok: false, error: "Insufficient permissions" });
  return null;
}
