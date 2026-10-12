/**
 * Client-side validation for the registration flow.
 *
 * These rules deliberately mirror backend/src/lib/registration.ts so the
 * checklist and the inline errors describe the same policy the server
 * enforces. They exist to give fast feedback, never to authorise anything:
 * every value is validated again on arrival.
 */

export interface ProfileValues {
  fullName: string;
  enrollmentNo: string;
  graduationYear: string;
  branch: string;
  institution: string;
  email: string;
}

export type ProfileErrors = Partial<Record<keyof ProfileValues, string>>;

export const GRADUATION_YEAR_MIN = 2020;
export const GRADUATION_YEAR_MAX = 2035;

export const EMPTY_PROFILE: ProfileValues = {
  fullName: "",
  enrollmentNo: "",
  graduationYear: "",
  branch: "",
  institution: "",
  email: "",
};

/** Trim and collapse inner runs of whitespace, matching the server. */
export function squash(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Canonical registration number, matching normaliseEnrollmentNo on the
 * server: surrounding whitespace trimmed, letters uppercased. Internal
 * spaces, hyphens and punctuation are preserved so validation rejects them.
 */
export function squashEnrollmentNo(value: string): string {
  return value.trim().toUpperCase();
}

/** College registration numbers are exactly 8 ASCII alphanumerics. */
export const ENROLLMENT_RE = /^[A-Z0-9]{8}$/;
export const ENROLLMENT_LENGTH = 8;
export const ENROLLMENT_EXAMPLE = "21BFH987";

export function validateEnrollmentNo(raw: string): string | undefined {
  const enrollment = squashEnrollmentNo(raw);
  if (!enrollment) return "Enter your college registration number.";
  if (enrollment.length !== ENROLLMENT_LENGTH || !ENROLLMENT_RE.test(enrollment)) {
    return `Enter the ${ENROLLMENT_LENGTH}-character registration number, for example ${ENROLLMENT_EXAMPLE}.`;
  }
  return undefined;
}

export function isValidEnrollmentNo(raw: string): boolean {
  return validateEnrollmentNo(raw) === undefined;
}

/** Graduation years worth offering, newest first, plus any year already typed. */
export function graduationYearOptions(): number[] {
  const years: number[] = [];
  for (let y = GRADUATION_YEAR_MAX; y >= GRADUATION_YEAR_MIN; y -= 1) years.push(y);
  return years;
}

/** Pragmatic shape check; the server applies the authoritative zod email rule. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateFullName(raw: string): string | undefined {
  const name = squash(raw);
  if (!name) return "Enter your full name.";
  if (name.length < 2) return "That looks too short.";
  if (name.length > 120) return "Keep this under 120 characters.";
  return undefined;
}

export function validateEmail(raw: string): string | undefined {
  const email = raw.trim();
  if (!email) return "Enter your email address.";
  if (email.length > 160) return "That address is too long.";
  if (!EMAIL.test(email)) return "Enter a valid email address, like you@college.edu.";
  return undefined;
}

export function validateBranch(raw: string): string | undefined {
  const branch = squash(raw);
  if (!branch) return "Enter your branch or department.";
  if (branch.length < 2) return "That looks too short.";
  if (branch.length > 80) return "Keep this under 80 characters.";
  return undefined;
}

export function validateGraduationYear(raw: string): string | undefined {
  const year = raw.trim();
  if (!year) return "Select your graduation year.";
  const parsed = Number(year);
  if (!Number.isInteger(parsed)) return "Enter a year, for example 2027.";
  if (parsed < GRADUATION_YEAR_MIN || parsed > GRADUATION_YEAR_MAX) {
    return `Choose a year between ${GRADUATION_YEAR_MIN} and ${GRADUATION_YEAR_MAX}.`;
  }
  return undefined;
}

export function validateProfile(values: ProfileValues): ProfileErrors {
  const errors: ProfileErrors = {};

  const nameError = validateFullName(values.fullName);
  if (nameError) errors.fullName = nameError;

  const enrollmentError = validateEnrollmentNo(values.enrollmentNo);
  if (enrollmentError) errors.enrollmentNo = enrollmentError;

  const yearError = validateGraduationYear(values.graduationYear);
  if (yearError) errors.graduationYear = yearError;

  const branchError = validateBranch(values.branch);
  if (branchError) errors.branch = branchError;

  if (squash(values.institution).length > 160) {
    errors.institution = "Keep this under 160 characters.";
  }

  const emailError = validateEmail(values.email);
  if (emailError) errors.email = emailError;

  return errors;
}

export function hasErrors(errors: ProfileErrors): boolean {
  return Object.values(errors).some(Boolean);
}

/** Canonical payload sent to the API — the server normalises again regardless. */
export function toProfilePayload(values: ProfileValues) {
  const institution = squash(values.institution);
  return {
    fullName: squash(values.fullName),
    enrollmentNo: squashEnrollmentNo(values.enrollmentNo),
    graduationYear: Number(values.graduationYear),
    branch: squash(values.branch),
    ...(institution ? { institution } : {}),
    email: values.email.trim().toLowerCase(),
  };
}

/* ── Password ─────────────────────────────────────────────────────────── */

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 256;

export interface Requirement {
  id: string;
  label: string;
  met: (password: string) => boolean;
}

/** Single source of truth for the step-3 checklist and the submit gate. */
export const PASSWORD_REQUIREMENTS: Requirement[] = [
  { id: "length", label: `At least ${PASSWORD_MIN} characters`, met: (p) => p.length >= PASSWORD_MIN },
  { id: "letter", label: "At least one letter", met: (p) => /\p{L}/u.test(p) },
  { id: "number", label: "At least one number", met: (p) => /\d/.test(p) },
];

export function metRequirements(password: string): Set<string> {
  const met = new Set<string>();
  for (const req of PASSWORD_REQUIREMENTS) if (req.met(password)) met.add(req.id);
  return met;
}

export function isPasswordAcceptable(password: string): boolean {
  return PASSWORD_REQUIREMENTS.every((r) => r.met(password));
}

export interface PasswordErrors {
  password?: string;
  confirm?: string;
}

/**
 * Errors for the password pair. A field only reports once it has content, so a
 * blank form is never scolded for being blank.
 */
export function validatePasswords(password: string, confirm: string): PasswordErrors {
  const errors: PasswordErrors = {};
  if (password && !isPasswordAcceptable(password)) {
    errors.password = "Your password does not meet the requirements yet.";
  }
  if (confirm && confirm !== password) {
    errors.confirm = "The two passwords do not match.";
  }
  return errors;
}

/* ── Code ─────────────────────────────────────────────────────────────── */

export const CODE_LENGTH = 6;

export function isCompleteCode(code: string): boolean {
  return new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code);
}
