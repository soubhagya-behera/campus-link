import { useState } from "react";
import Field from "./Field";
import Alert from "./Alert";
import {
  ENROLLMENT_EXAMPLE,
  ENROLLMENT_LENGTH,
  graduationYearOptions,
  isValidEnrollmentNo,
  validateBranch,
  validateEmail,
  validateEnrollmentNo,
  validateFullName,
  validateGraduationYear,
  type ProfileErrors,
  type ProfileValues,
} from "../lib/validation";

interface StepProfileProps {
  values: ProfileValues;
  errors: ProfileErrors;
  busy: boolean;
  serverError: string | null;
  onChange: (field: keyof ProfileValues, value: string) => void;
  onSubmit: () => void;
}

type Touched = Partial<Record<keyof ProfileValues, boolean>>;

const CURRENT_YEAR = new Date().getFullYear();

function successFor(field: keyof ProfileValues, values: ProfileValues): string | undefined {
  switch (field) {
    case "fullName":
      return values.fullName.trim() && !validateFullName(values.fullName) ? "Looks good." : undefined;
    case "email":
      return values.email.trim() && !validateEmail(values.email) ? "That email looks valid." : undefined;
    case "enrollmentNo": {
      return values.enrollmentNo.trim() && isValidEnrollmentNo(values.enrollmentNo)
        ? "Valid registration number."
        : undefined;
    }
    case "graduationYear":
      return values.graduationYear.trim() && !validateGraduationYear(values.graduationYear)
        ? "Selected."
        : undefined;
    case "branch":
      return values.branch.trim() && !validateBranch(values.branch) ? "Looks good." : undefined;
    case "institution":
      return values.institution.trim() ? undefined : undefined;
    default:
      return undefined;
  }
}

/**
 * Step 1 — who you are and where you study.
 *
 * Single compact list (no ornamental group dividers): labels sit close to
 * their inputs, and inline validation messages carry the requirements so no
 * repeated helper text is needed. Values live in the parent, so stepping back
 * from the code screen returns everything exactly as it was typed. Green
 * appears only for a completely valid value after interaction — never for
 * partial input — and every state has a text message, never colour alone.
 */
export default function StepProfile({
  values,
  errors,
  busy,
  serverError,
  onChange,
  onSubmit,
}: StepProfileProps) {
  const years = graduationYearOptions();
  const [touched, setTouched] = useState<Touched>({});

  const mark = (field: keyof ProfileValues) =>
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));

  const showError = (field: keyof ProfileValues): string | undefined => {
    if (errors[field]) return errors[field];
    if (!touched[field]) return undefined;
    switch (field) {
      case "fullName":
        return validateFullName(values.fullName);
      case "email":
        return validateEmail(values.email);
      case "enrollmentNo":
        return validateEnrollmentNo(values.enrollmentNo);
      case "graduationYear":
        return validateGraduationYear(values.graduationYear);
      case "branch":
        return validateBranch(values.branch);
      case "institution":
        return values.institution.trim().length > 160 ? "Keep this under 160 characters." : undefined;
      default:
        return undefined;
    }
  };

  const showSuccess = (field: keyof ProfileValues): string | undefined => {
    if (showError(field)) return undefined;
    if (!touched[field] && !errors[field]) {
      // Before interaction the border stays neutral — no premature green.
      return undefined;
    }
    if (!touched[field]) return undefined;
    return successFor(field, values);
  };

  return (
    <form
      className="rg-step"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTouched({
          fullName: true,
          email: true,
          enrollmentNo: true,
          graduationYear: true,
          branch: true,
          institution: true,
        });
        if (!busy) onSubmit();
      }}
    >
      <p className="rg-eyebrow">Step 1 of 3</p>
      <h2 className="rg-title">Create your student account</h2>

      {serverError ? <Alert>{serverError}</Alert> : null}

      <Field label="Full name" error={showError("fullName")} success={showSuccess("fullName")}>
        {(a) => (
          <input
            {...a}
            name="fullName"
            type="text"
            autoComplete="name"
            placeholder="Ada Lovelace"
            maxLength={120}
            value={values.fullName}
            onChange={(e) => onChange("fullName", e.target.value)}
            onBlur={() => mark("fullName")}
          />
        )}
      </Field>

      <Field label="Email address" error={showError("email")} success={showSuccess("email")}>
        {(a) => (
          <input
            {...a}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            placeholder="you@college.edu"
            maxLength={160}
            value={values.email}
            onChange={(e) => onChange("email", e.target.value)}
            onBlur={() => mark("email")}
          />
        )}
      </Field>

      <Field
        label="College registration number"
        error={showError("enrollmentNo")}
        success={showSuccess("enrollmentNo")}
      >
        {(a) => (
          <input
            {...a}
            name="enrollmentNo"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder={ENROLLMENT_EXAMPLE}
            maxLength={ENROLLMENT_LENGTH}
            pattern="[A-Za-z0-9]{8}"
            value={values.enrollmentNo}
            onChange={(e) => onChange("enrollmentNo", e.target.value.toUpperCase())}
            onBlur={() => mark("enrollmentNo")}
          />
        )}
      </Field>

      <div className="rg-grid-2">
        <Field
          label="Graduation year"
          error={showError("graduationYear")}
          success={showSuccess("graduationYear")}
        >
          {(a) => (
            <select
              {...a}
              name="graduationYear"
              value={values.graduationYear}
              onChange={(e) => {
                onChange("graduationYear", e.target.value);
                mark("graduationYear");
              }}
              onBlur={() => mark("graduationYear")}
            >
              <option value="">Select…</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                  {year === CURRENT_YEAR ? " (this year)" : ""}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="Branch or department" error={showError("branch")} success={showSuccess("branch")}>
          {(a) => (
            <input
              {...a}
              name="branch"
              type="text"
              autoComplete="organization-title"
              placeholder="Computer Science"
              maxLength={80}
              value={values.branch}
              onChange={(e) => onChange("branch", e.target.value)}
              onBlur={() => mark("branch")}
            />
          )}
        </Field>
      </div>

      <Field label="College or institution" error={showError("institution")} optional>
        {(a) => (
          <input
            {...a}
            name="institution"
            type="text"
            autoComplete="organization"
            placeholder="Ravenscourt Institute of Technology"
            maxLength={160}
            value={values.institution}
            onChange={(e) => onChange("institution", e.target.value)}
            onBlur={() => mark("institution")}
          />
        )}
      </Field>

      <button className="rg-btn rg-btn--block" type="submit" disabled={busy}>
        {busy ? <span className="rg-spin" aria-hidden="true" /> : null}
        {busy ? "Sending code…" : "Continue and verify email"}
      </button>
    </form>
  );
}
