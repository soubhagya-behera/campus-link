import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** Digits in a CAMPUSLINK verification code. */
export const OTP_LENGTH = 6;

/**
 * HMAC key for one-time codes.
 *
 * Codes are never stored, logged or emailed in a recoverable form: only an
 * HMAC of `attemptId:code` reaches PostgreSQL. Because a six-digit code has
 * just 10^6 candidates, a bare SHA-256 would be trivially reversible from a
 * leaked row by brute force — the key is what prevents that. It is read from
 * OTP_PEPPER when present (needed if you ever run more than one API process)
 * and otherwise generated per process and never persisted. Consequence of the
 * generated fallback: codes issued before an API restart stop verifying, which
 * is harmless — they expire in minutes and the client can request a new one.
 */
const PEPPER = process.env.OTP_PEPPER?.trim() || randomBytes(32).toString("hex");

/**
 * Uniform six-digit code from the CSPRNG.
 * randomInt is rejection-sampled, so there is no modulo bias, and it cannot
 * throw here: 1_000_000 is far below the 2^48 limit.
 */
export function generateOtp(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

/** Lowercase hex HMAC-SHA256 of `attemptId:code`. Safe to persist. */
export function hashOtp(attemptId: string, code: string): string {
  return createHmac("sha256", PEPPER).update(`${attemptId}:${code}`, "utf8").digest("hex");
}

/**
 * Constant-time comparison of a submitted code against a stored hash.
 * Returns false (never throws) when the hash is missing or malformed, so a
 * corrupt row can never be "verified" by an empty submission.
 */
export function verifyOtp(attemptId: string, code: string, storedHash: string | null): boolean {
  if (!storedHash) return false;
  const expected = Buffer.from(storedHash, "hex");
  const actual = Buffer.from(hashOtp(attemptId, code), "hex");
  if (expected.length !== actual.length || expected.length === 0) return false;
  return timingSafeEqual(expected, actual);
}

/** True when the code is exactly OTP_LENGTH digits — shape check only, not validity. */
export function isOtpShape(code: string): boolean {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code);
}
