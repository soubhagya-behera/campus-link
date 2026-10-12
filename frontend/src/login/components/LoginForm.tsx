import { useState } from "react";
import type { LoginErrors, LoginValues } from "../lib/validation";

/**
 * The sign-in form.
 *
 * Form primitives (.rg-input, .rg-btn, .rg-alert, .rg-field) are shared with
 * the registration page verbatim — one design system, not two. The only
 * login-specific chrome is the password visibility toggle.
 */

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

interface LoginFormProps {
  values: LoginValues;
  errors: LoginErrors;
  serverError: string | null;
  busy: boolean;
  onChange: (field: keyof LoginValues, value: string) => void;
  onSubmit: () => void;
}

export default function LoginForm({ values, errors, serverError, busy, onChange, onSubmit }: LoginFormProps) {
  const [visible, setVisible] = useState(false);

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy) onSubmit();
      }}
    >
      {serverError ? <div className="rg-alert" role="alert">{serverError}</div> : null}

      <div className="rg-field">
        <label className="rg-label" htmlFor="lg-email">
          Email address
        </label>
        <input
          id="lg-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          placeholder="you@college.edu"
          maxLength={160}
          disabled={busy}
          value={values.email}
          onChange={(e) => onChange("email", e.target.value)}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "lg-email-error" : undefined}
          className={`rg-input${errors.email ? " is-invalid" : ""}`}
        />
        {errors.email ? (
          <p className="rg-error" id="lg-email-error" role="alert">
            {errors.email}
          </p>
        ) : null}
      </div>

      <div className="rg-field">
        <label className="rg-label" htmlFor="lg-password">
          Password
        </label>
        <span className="rg-input-wrap">
          <input
            id="lg-password"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            maxLength={256}
            disabled={busy}
            value={values.password}
            onChange={(e) => onChange("password", e.target.value)}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "lg-password-error" : undefined}
            className={`rg-input${errors.password ? " is-invalid" : ""}`}
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
        {errors.password ? (
          <p className="rg-error" id="lg-password-error" role="alert">
            {errors.password}
          </p>
        ) : null}
      </div>

      <button className="rg-btn rg-btn--block" type="submit" disabled={busy}>
        {busy ? <span className="rg-spin" aria-hidden="true" /> : null}
        {busy ? "Signing in…" : "Log in"}
      </button>

      <p className="lg-note">
        Forgot your password? Contact your placement cell for help signing in.
      </p>
    </form>
  );
}
