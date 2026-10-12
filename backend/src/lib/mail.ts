import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outbound mail for the registration flow.
 *
 * There is no demo, console or "pretend" transport here on purpose: if mail is
 * not configured the API answers 503 and says so, rather than telling a student
 * a code was sent when nothing left the machine. Credentials are read from
 * environment variables and never logged, echoed or returned to a client.
 *
 * Required in backend/.env (see .env.example):
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM
 * For Gmail, SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_SECURE=1 and
 * SMTP_PASS must be an app password, not the account password.
 */

/** Variable names required for delivery. Names only — never their values. */
const REQUIRED_VARS = ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"] as const;

let cached: Transporter | null = null;

/** Which of the required variables are absent, for an actionable 503. */
export function missingMailVars(): string[] {
  return REQUIRED_VARS.filter((name) => {
    const value = process.env[name];
    return value === undefined || value.trim() === "";
  });
}

export function isMailConfigured(): boolean {
  return missingMailVars().length === 0;
}

/**
 * `SMTP_SECURE=1` selects implicit TLS (port 465), per .env.example. The
 * common spellings `true` and `yes` are accepted too, so a reasonable value
 * never silently downgrades to STARTTLS; anything else (including an empty
 * value, which never reaches here) uses STARTTLS.
 */
export function parseImplicitTls(raw: string | undefined): boolean {
  return ["1", "true", "yes"].includes((raw ?? "").trim().toLowerCase());
}

function transport(): Transporter {
  if (cached) return cached;
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST!.trim(),
    port: Number.parseInt(process.env.SMTP_PORT!.trim(), 10),
    secure: parseImplicitTls(process.env.SMTP_SECURE),
    auth: { user: process.env.SMTP_USER!.trim(), pass: process.env.SMTP_PASS! },
    // Never let a message body reach out to the filesystem or the network.
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return cached;
}

const BRAND = {
  canvas: "#f5f4ee",
  forest: "#173c2f",
  ink: "#202822",
  sage: "#849581",
  lime: "#c5e86c",
  border: "#dde2d8",
};

function subject(expiresInMinutes: number): string {
  return `Your CAMPUSLINK verification code (valid ${expiresInMinutes} minutes)`;
}

function textBody(input: { name: string; code: string; expiresInMinutes: number }): string {
  return [
    `Hi ${input.name},`,
    "",
    `Your CAMPUSLINK verification code is ${input.code}`,
    "",
    `It is valid for ${input.expiresInMinutes} minutes and can be used once.`,
    "If you did not try to register a CAMPUSLINK student account, ignore this email —",
    "no account exists until a password is set.",
    "",
    "CAMPUSLINK · Career Intelligence",
  ].join("\n");
}

/**
 * Table-based layout so the code renders identically in Outlook and Gmail,
 * using the same palette as the product. No remote images (nothing to track,
 * nothing to block).
 */
function htmlBody(input: { name: string; code: string; expiresInMinutes: number }): string {
  const digits = input.code
    .split("")
    .map(
      (d) =>
        `<td align="center" style="width:44px;height:52px;background:#ffffff;border:1px solid ${BRAND.border};font:600 26px/52px ui-monospace,'JetBrains Mono',Consolas,monospace;color:${BRAND.forest};">${d}</td>`,
    )
    .join('<td style="width:8px;">&nbsp;</td>');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your CAMPUSLINK verification code</title></head>
<body style="margin:0;padding:0;background:${BRAND.canvas};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your CAMPUSLINK verification code is ${input.code} — valid for ${input.expiresInMinutes} minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.canvas};padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${BRAND.canvas};font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.ink};">
<tr><td style="padding:8px 8px 20px;">
  <span style="display:inline-block;padding:6px 12px;border:1px solid ${BRAND.border};border-radius:8px;font-size:12px;font-weight:700;letter-spacing:.14em;color:${BRAND.forest};">CAMPUSLINK</span>
</td></tr>
<tr><td style="padding:0 8px 8px;font-size:26px;line-height:1.2;font-weight:700;color:${BRAND.forest};">Verify your email</td></tr>
<tr><td style="padding:0 8px 20px;font-size:15px;line-height:1.6;color:${BRAND.ink};">Hi ${escapeHtml(input.name)}, enter this code to finish creating your student account.</td></tr>
<tr><td style="padding:0 8px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>${digits}</tr></table></td></tr>
<tr><td style="padding:20px 8px 8px;font-size:13px;line-height:1.6;color:${BRAND.sage};">The code expires in ${input.expiresInMinutes} minutes and works once.</td></tr>
<tr><td style="padding:0 8px 28px;border-top:1px solid ${BRAND.border};font-size:13px;line-height:1.6;color:${BRAND.sage};">
  If you did not try to register a CAMPUSLINK student account, ignore this email. No account exists until you set a password.
</td></tr>
</table>
</td></tr></table></body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface VerificationMail {
  to: string;
  name: string;
  code: string;
  expiresInMinutes: number;
}

/**
 * Sends the one-time code. Throws on transport failure so the caller can fail
 * the request honestly — a code the student never received must not be treated
 * as sent. The code itself is never written to the log.
 */
export async function sendVerificationCode(input: VerificationMail): Promise<void> {
  const missing = missingMailVars();
  if (missing.length > 0) throw new MailNotConfiguredError(missing);
  await transport().sendMail({
    from: process.env.MAIL_FROM!.trim(),
    to: input.to,
    subject: subject(input.expiresInMinutes),
    text: textBody(input),
    html: htmlBody(input),
  });
}

export class MailNotConfiguredError extends Error {
  readonly missing: string[];
  constructor(missing: string[]) {
    super(`Mail is not configured; missing: ${missing.join(", ")}`);
    this.name = "MailNotConfiguredError";
    this.missing = missing;
  }
}
