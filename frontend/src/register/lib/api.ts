import { request } from "../../lib/server";
import type { ProfileValues } from "./validation";
import { toProfilePayload } from "./validation";

/**
 * Typed client for the three public registration endpoints.
 *
 * Requests go through the shared `request` helper in lib/server.ts, so cookies
 * travel exactly the same path as in the authenticated app: `credentials:
 * "include"` is what lets the browser store the HttpOnly session cookie that
 * POST /register/complete sets on a different port from this page.
 */

function post<T>(path: string, body: unknown): Promise<T> {
  return request<{ ok: boolean; data: T }>(path, {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.data);
}

/** What the server tells us about the email we just sent a code to. */
export interface RegistrationStart {
  attemptId: string;
  emailMasked: string;
  expiresAt: string;
  resendAvailableAt: string;
  codeLength: number;
  maxAttempts: number;
}

/** Proof, held only in memory, that the server verified this email. */
export interface RegistrationVerify {
  attemptId: string;
  completionToken: string;
  emailMasked: string;
  expiresAt: string;
}

export interface RegisteredUser {
  id: string;
  email: string;
  role: string;
  companyId: string | null;
  studentProfileId: string | null;
}

/** Step 1. Creates no account — only a verifiable registration attempt. */
export function startRegistration(values: ProfileValues): Promise<RegistrationStart> {
  return post<RegistrationStart>("/api/auth/register/start", toProfilePayload(values));
}

/** Step 2. Trades the emailed code for a short-lived completion token. */
export function verifyRegistrationCode(attemptId: string, code: string): Promise<RegistrationVerify> {
  return post<RegistrationVerify>("/api/auth/register/verify", { attemptId, code });
}

/**
 * Step 3. Creates the student account and signs them in. The server derives the
 * profile from the verified attempt, so nothing about the student is sent here
 * beyond the password.
 */
export function completeRegistration(
  attemptId: string,
  completionToken: string,
  password: string,
): Promise<{ user: RegisteredUser }> {
  return post<{ user: RegisteredUser }>("/api/auth/register/complete", {
    attemptId,
    completionToken,
    password,
  });
}
