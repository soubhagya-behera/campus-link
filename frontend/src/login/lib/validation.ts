/**
 * Client-side validation for the login form.
 *
 * Shape checks only — correctness of the credentials is the server's verdict.
 * Email is normalised the same way here as at registration so the two pages
 * describe one account.
 */

export interface LoginValues {
  email: string;
  password: string;
}

export type LoginErrors = Partial<Record<keyof LoginValues, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateLogin(values: LoginValues): LoginErrors {
  const errors: LoginErrors = {};
  const email = values.email.trim();
  if (!email) errors.email = "Enter your email address.";
  else if (!EMAIL.test(email)) errors.email = "Enter a valid email address, like you@college.edu.";

  if (!values.password) errors.password = "Enter your password.";
  return errors;
}

export function hasLoginErrors(errors: LoginErrors): boolean {
  return Object.values(errors).some(Boolean);
}

/**
 * A `next` target is safe only when it stays inside this site. Reject
 * protocol-relative URLs, backslash tricks and the public auth pages
 * themselves, or a crafted link could bounce a fresh session somewhere else.
 */
export function safeNext(raw: string | null): string {
  if (!raw) return "/app";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/app";
  if (raw === "/login" || raw.startsWith("/login?") || raw === "/login/") return "/app";
  if (raw === "/register" || raw.startsWith("/register?") || raw === "/register/") return "/app";
  return raw;
}
