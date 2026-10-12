import { useId, useState, type ComponentProps } from "react";
import Alert from "./Alert";
import Field from "./Field";
import { PASSWORD_MAX, PASSWORD_REQUIREMENTS, metRequirements, type PasswordErrors } from "../lib/validation";

interface StepPasswordProps {
  password: string;
  confirm: string;
  errors: PasswordErrors;
  serverError: string | null;
  busy: boolean;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}

/** Eye / eye-off drawn inline so the page adds no icon dependency. */
function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M1.8 10S4.9 4.8 10 4.8 18.2 10 18.2 10 15.1 15.2 10 15.2 1.8 10 1.8 10Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.4" />
      {off ? <path d="M3 3l14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /> : null}
    </svg>
  );
}

/**
 * Step 3 — set the password.
 *
 * The checklist mirrors the server policy exactly, so the button only enables
 * when the server would accept the value. Confirmation is checked on blur and
 * on submit, not on every keystroke, to avoid shouting at a half-typed word.
 */
export default function StepPassword({
  password,
  confirm,
  errors,
  serverError,
  busy,
  onPasswordChange,
  onConfirmChange,
  onSubmit,
  onBack,
}: StepPasswordProps) {
  const [visible, setVisible] = useState(false);
  const met = metRequirements(password);
  const checklistId = useId();
  const allMet = PASSWORD_REQUIREMENTS.every((r) => met.has(r.id));

  const passwordField = (attrs: ComponentProps<"input">) => (
    <span className="rg-input-wrap">
      <input
        {...attrs}
        name="password"
        type={visible ? "text" : "password"}
        autoComplete="new-password"
        maxLength={PASSWORD_MAX}
        value={password}
        // Points at both the requirement checklist and, when present, the error.
        aria-describedby={[checklistId, attrs["aria-describedby"]].filter(Boolean).join(" ") || undefined}
        onChange={(e) => onPasswordChange(e.target.value)}
      />
      <button
        type="button"
        className="rg-reveal"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        <EyeIcon off={visible} />
      </button>
    </span>
  );

  return (
    <form
      className="rg-step"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy) onSubmit();
      }}
    >
      <p className="rg-eyebrow">Step 3 of 3</p>
      <h2 className="rg-title">Create your password</h2>
      <p className="rg-lede">
        Your email is verified. Choose a password to finish creating your student account.
      </p>

      {serverError ? <Alert>{serverError}</Alert> : null}

      <ul className="rg-reqs" id={checklistId}>
        {PASSWORD_REQUIREMENTS.map((req) => (
          <li key={req.id} className={`rg-req${met.has(req.id) ? " is-met" : ""}`}>
            <span className="rg-req-tick" aria-hidden="true">
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" focusable="false">
                <path
                  d="M1.6 5.2 3.9 7.5 8.4 2.9"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span>
              <span className="rg-sr">{met.has(req.id) ? "Met: " : "Not met: "}</span>
              {req.label}
            </span>
          </li>
        ))}
      </ul>

      <Field label="Password" error={errors.password}>
        {(a) => passwordField(a)}
      </Field>

      <Field label="Confirm password" error={errors.confirm}>
        {(a) => (
          <input
            {...a}
            name="confirmPassword"
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            maxLength={PASSWORD_MAX}
            value={confirm}
            onChange={(e) => onConfirmChange(e.target.value)}
          />
        )}
      </Field>

      <button className="rg-btn rg-btn--block" type="submit" disabled={busy}>
        {busy ? <span className="rg-spin" aria-hidden="true" /> : null}
        {busy ? "Creating your account…" : "Create account"}
      </button>

      <div className="rg-foot">
        <button type="button" className="rg-foot-link" onClick={onBack} disabled={busy}>
          Back to verification
        </button>
        <span className="rg-sr" aria-live="polite">
          {allMet ? "All password requirements met." : ""}
        </span>
      </div>
    </form>
  );
}
