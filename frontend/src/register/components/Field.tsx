import { useId, type ReactNode } from "react";

interface FieldProps {
  label: string;
  error?: string;
  /** Shown only when there is no error and the value is fully valid. */
  success?: string;
  hint?: ReactNode;
  optional?: boolean;
  children: (attrs: {
    id: string;
    "aria-invalid": boolean | undefined;
    "aria-describedby": string | undefined;
    className: string;
  }) => ReactNode;
}

/**
 * Label + control + hint + error/success, wired together for assistive
 * technology.
 *
 * The control is passed as a function so this component owns the id and the
 * `aria-describedby` chain. Without that, a field can render a visible error
 * that no screen reader ever announces. Success is never colour-only: a check
 * icon plus a short text alternative accompany the green border, and green
 * appears only when the value is completely valid — never for partial input.
 */
export default function Field({ label, error, success, hint, optional, children }: FieldProps) {
  const uid = useId();
  const id = `rg-${uid}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const successId = !error && success ? `${id}-ok` : undefined;
  const describedBy = [hintId, errorId, successId].filter(Boolean).join(" ") || undefined;
  const stateClass = error ? " is-invalid" : success ? " is-valid" : "";

  return (
    <div className="rg-field">
      <label className="rg-label" htmlFor={id}>
        {label}
        {optional ? <span className="rg-optional">optional</span> : null}
      </label>
      <div className="rg-control">
        {children({
          id,
          "aria-invalid": error ? true : undefined,
          "aria-describedby": describedBy,
          className: `rg-input${stateClass}`,
        })}
        {!error && success ? (
          <span className="rg-check" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" focusable="false">
              <path
                d="M2.5 7.2 5.8 10.5 11.5 3.8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        ) : null}
      </div>
      {hint ? (
        <p className="rg-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="rg-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
      {!error && success ? (
        <p className="rg-ok" id={successId}>
          {success}
        </p>
      ) : null}
    </div>
  );
}
