import { useId } from "react";
import Alert from "./Alert";
import OtpInput from "./OtpInput";
import { formatCountdown } from "../hooks/useCountdown";
import { CODE_LENGTH, isCompleteCode } from "../lib/validation";

interface StepVerifyProps {
  emailMasked: string;
  code: string;
  error: string | null;
  info: string | null;
  busy: boolean;
  resending: boolean;
  resendAfterSeconds: number;
  maxAttempts: number;
  onCodeChange: (next: string) => void;
  onSubmit: () => void;
  onResend: () => void;
  onBack: () => void;
}

/**
 * Step 2 — prove control of the mailbox.
 *
 * Every message here reflects something the server actually said. There is no
 * optimistic "verified" state: the step only advances when POST /verify
 * returns a completion token.
 */
export default function StepVerify({
  emailMasked,
  code,
  error,
  info,
  busy,
  resending,
  resendAfterSeconds,
  maxAttempts,
  onCodeChange,
  onSubmit,
  onResend,
  onBack,
}: StepVerifyProps) {
  const hintId = useId();
  const canResend = resendAfterSeconds === 0 && !busy && !resending;
  const complete = isCompleteCode(code);

  return (
    <form
      className="rg-step"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && complete) onSubmit();
      }}
    >
      <p className="rg-eyebrow">Step 2 of 3</p>
      <h2 className="rg-title">Check your inbox</h2>
      <p className="rg-lede">
        We sent a {CODE_LENGTH}-digit code to your email address. Enter it below to continue.
      </p>

      <p className="rg-sent">
        <span>Code sent to</span>
        <span className="rg-sent-email">{emailMasked}</span>
      </p>

      {error ? <Alert>{error}</Alert> : null}
      {!error && info ? <Alert tone="info">{info}</Alert> : null}

      <OtpInput
        value={code}
        onChange={onCodeChange}
        disabled={busy}
        invalid={Boolean(error)}
        describedBy={hintId}
        autoFocus
      />

      <div className="rg-otp-meta">
        {/* Not a live region: a once-per-second countdown would be announced
            every second. The resend button's enabled state carries the change. */}
        <span className="rg-otp-count" id={hintId}>
          {busy
            ? "Checking your code…"
            : resendAfterSeconds > 0
              ? `You can request another code in ${formatCountdown(resendAfterSeconds)}`
              : `You have ${maxAttempts} attempts`}
        </span>
        <button type="button" className="rg-text-btn" onClick={onResend} disabled={!canResend}>
          {resending ? "Sending…" : "Resend code"}
        </button>
      </div>

      <button className="rg-btn rg-btn--block" type="submit" disabled={busy || !complete}>
        {busy ? <span className="rg-spin" aria-hidden="true" /> : null}
        {busy ? "Verifying…" : "Verify email"}
      </button>

      <div className="rg-foot">
        <button type="button" className="rg-foot-link" onClick={onBack} disabled={busy}>
          Back to your details
        </button>
      </div>
    </form>
  );
}
