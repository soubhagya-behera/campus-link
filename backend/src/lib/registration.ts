import { createHash } from "node:crypto";
import { z } from "zod";

/**
 * Registration rules for the public student signup flow.
 *
 * Everything here is pure so it can be unit-tested without a database, and it
 * is the single source of truth the routes validate against. The client mirrors
 * these rules for immediate feedback, but the server is the authority.
 */

/** How long an emailed code stays usable. */
export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
/** Minimum gap between two codes for the same attempt. */
export const RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute
/** Codes an attempt may request before it must restart registration. */
export const MAX_SENDS_PER_ATTEMPT = 5;
/** Codes a person may get wrong before the attempt is burned. */
export const MAX_VERIFY_ATTEMPTS = 5;
/** How long a verified email stays authorised to set a password. */
export const COMPLETION_TTL_MS = 20 * 60 * 1000; // 20 minutes
/** Window during which a server restart invalidates outstanding codes. */
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 256;

/** Graduation years a registering student may plausibly be in. */
export const GRADUATION_YEAR_MIN = 2020;
export const GRADUATION_YEAR_MAX = 2035;

/** Collapse internal whitespace and trim. Applied to every free-text field. */
export function normaliseText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Canonical form of an email for storage and comparison.
 * Matches login's `toLowerCase()` so one account can never exist under two
 * casings, which the unique index on User.email would otherwise allow.
 */
export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Canonical form of a college registration number.
 * Letters are uppercased and surrounding whitespace is trimmed. Internal
 * spaces, hyphens and punctuation are NOT stripped, so the format rule below
 * rejects them instead of silently accepting a different value than typed.
 * Example valid value: `21BFH987` (exactly 8 ASCII alphanumerics).
 */
export function normaliseEnrollmentNo(value: string): string {
  return value.trim().toUpperCase();
}

/** College registration numbers are exactly 8 ASCII alphanumerics. */
export const ENROLLMENT_RE = /^[A-Z0-9]{8}$/;

/**
 * Every field is normalised *before* it is length-checked, so a value of "   "
 * fails `min(2)` instead of passing on raw length and then being trimmed away
 * to nothing. Validating the exact string that will be stored also removes the
 * chance of the server storing "" for a field the client believed was filled.
 */
const name = z.string().transform(normaliseText).pipe(z.string().min(2).max(120));
const enrollmentNo = z
  .string()
  .transform(normaliseEnrollmentNo)
  .pipe(z.string().regex(ENROLLMENT_RE, "Enter the 8-character registration number, for example 21BFH987."));
const branch = z.string().transform(normaliseText).pipe(z.string().min(2).max(80));
const institution = z.string().transform(normaliseText).pipe(z.string().max(160)).optional();
const email = z.string().transform(normaliseEmail).pipe(z.string().email().max(160));

/** Step 1 payload. `.strict()` so a client cannot smuggle extra keys. */
export const startBody = z
  .object({
    fullName: name,
    enrollmentNo,
    graduationYear: z.coerce.number().int().min(GRADUATION_YEAR_MIN).max(GRADUATION_YEAR_MAX),
    branch,
    institution,
    email,
  })
  .strict();

/** Step 2 payload. */
export const verifyBody = z
  .object({
    attemptId: z.string().min(1).max(64),
    code: z.string().min(1).max(16),
  })
  .strict();

/** Step 3 payload. Profile data is intentionally absent: it comes from the
 *  verified attempt row, never from the browser. */
export const completeBody = z
  .object({
    attemptId: z.string().min(1).max(64),
    completionToken: z.string().min(1).max(128),
    password: z.string().min(1).max(PASSWORD_MAX),
  })
  .strict();

export type StartInput = z.infer<typeof startBody>;

/**
 * Selects the fields to persist. The schema has already normalised them;
 * re-running the (idempotent) normalisation here keeps the stored values
 * canonical even if the schema is later loosened.
 */
export function prepareStart(input: StartInput) {
  return {
    email: normaliseEmail(input.email),
    fullName: normaliseText(input.fullName),
    enrollmentNo: normaliseEnrollmentNo(input.enrollmentNo),
    branch: normaliseText(input.branch),
    institution: input.institution ? normaliseText(input.institution) : null,
    graduationYear: input.graduationYear,
  };
}

export interface PasswordCheck {
  ok: boolean;
  /** Human-readable failures, in the order shown by the step-3 checklist. */
  problems: string[];
}

/**
 * Password policy, kept in one place so the step-3 checklist and the server
 * can never drift apart.
 */
export function checkPassword(password: string): PasswordCheck {
  const problems: string[] = [];
  if (password.length < PASSWORD_MIN) problems.push(`At least ${PASSWORD_MIN} characters`);
  if (password.length > PASSWORD_MAX) problems.push(`No more than ${PASSWORD_MAX} characters`);
  if (!/\p{L}/u.test(password)) problems.push("At least one letter");
  if (!/\d/.test(password)) problems.push("At least one number");
  return { ok: problems.length === 0, problems };
}

/** Mask an email for display and mail greetings: a****@example.edu */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "your email address";
  const head = email.slice(0, at);
  const keep = head.slice(0, Math.min(2, head.length));
  return `${keep}${"*".repeat(Math.max(1, head.length - keep.length))}${email.slice(at)}`;
}

/**
 * SHA-256 of the short-lived completion token, domain-separated from session
 * tokens so the two can never be confused for one another. Only this digest is
 * persisted; the raw token exists in the browser for the length of step 3.
 */
export function hashCompletionToken(token: string): string {
  return createHash("sha256").update(`registration:${token}`, "utf8").digest("hex");
}
