import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../lib/server";
import ProgressRail from "./components/ProgressRail";
import RegisterPanel from "./components/RegisterPanel";
import StepPassword from "./components/StepPassword";
import StepProfile from "./components/StepProfile";
import StepVerify from "./components/StepVerify";
import SuccessPanel from "./components/SuccessPanel";
import { useCountdown } from "./hooks/useCountdown";
import {
  completeRegistration,
  startRegistration,
  verifyRegistrationCode,
  type RegisteredUser,
  type RegistrationStart,
} from "./lib/api";
import {
  EMPTY_PROFILE,
  hasErrors,
  isCompleteCode,
  isPasswordAcceptable,
  validatePasswords,
  validateProfile,
  type PasswordErrors,
  type ProfileErrors,
  type ProfileValues,
} from "./lib/validation";
import "./register.css";

type Step = 1 | 2 | 3;

function messageFor(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message || fallback;
  return fallback;
}

/**
 * Student registration — three steps, one URL.
 *
 * The attempt id and completion token are held in memory only, never in
 * storage: the completion token authorises account creation, so putting it in
 * localStorage would widen the blast radius of an XSS bug for no benefit.
 * A reload therefore returns to step 1, which is the safe default.
 *
 * Every step transition is driven by a server response. Nothing here assumes a
 * verification succeeded before the API said so.
 */
export default function Register() {
  const [step, setStep] = useState<Step>(1);
  const [values, setValues] = useState<ProfileValues>(EMPTY_PROFILE);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const [attempt, setAttempt] = useState<RegistrationStart | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeInfo, setCodeInfo] = useState<string | null>(null);
  const [completionToken, setCompletionToken] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [user, setUser] = useState<RegisteredUser | null>(null);

  // Guards against a double-click landing two requests for the same attempt.
  const inFlight = useRef(false);

  const resendAfter = useCountdown(attempt?.resendAvailableAt ?? null);

  const setField = (field: keyof ProfileValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
    setServerError(null);
  };

  /* ── Step 1 ─────────────────────────────────────────────────────────── */

  const submitProfile = async () => {
    const found = validateProfile(values);
    setErrors(found);
    if (hasErrors(found) || inFlight.current) return;

    inFlight.current = true;
    setBusy(true);
    setServerError(null);
    try {
      const started = await startRegistration(values);
      setAttempt(started);
      setCode("");
      setCodeError(null);
      setCodeInfo(null);
      setStep(2);
    } catch (err) {
      setServerError(messageFor(err, "We could not start your registration. Try again."));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  /* ── Step 2 ─────────────────────────────────────────────────────────── */

  const submitCode = async () => {
    if (!attempt || !isCompleteCode(code) || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setCodeError(null);
    setCodeInfo(null);
    try {
      const verified = await verifyRegistrationCode(attempt.attemptId, code);
      setCompletionToken(verified.completionToken);
      setStep(3);
    } catch (err) {
      setCodeError(messageFor(err, "We could not verify that code. Try again."));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!attempt || resending || resendAfter > 0) return;
    setResending(true);
    setCodeError(null);
    setCodeInfo(null);
    try {
      const resent = await startRegistration(values);
      setAttempt(resent);
      setCode("");
      setCodeInfo("A new code is on its way. The previous one no longer works.");
    } catch (err) {
      setCodeError(messageFor(err, "We could not send another code. Try again shortly."));
    } finally {
      setResending(false);
    }
  };

  // Stepping back to correct an email invalidates the code and the token.
  const backToProfile = () => {
    setCode("");
    setCodeError(null);
    setCodeInfo(null);
    setCompletionToken(null);
    setStep(1);
  };

  const backToVerify = () => {
    setPassword("");
    setConfirm("");
    setServerError(null);
    setStep(2);
  };

  /* ── Step 3 ─────────────────────────────────────────────────────────── */

  const passwordErrors: PasswordErrors = validatePasswords(password, confirm);

  const submitPassword = async () => {
    if (!attempt || !completionToken) return;
    // Surface anything the live checks have not flagged yet, then wait.
    if (Object.keys(validatePasswords(password, confirm)).length > 0 || !isPasswordAcceptable(password)) {
      return;
    }
    if (inFlight.current) return;

    inFlight.current = true;
    setBusy(true);
    setServerError(null);
    try {
      const done = await completeRegistration(attempt.attemptId, completionToken, password);
      // Only the server's own session establishes a signed-in state.
      setUser(done.user);
    } catch (err) {
      setServerError(messageFor(err, "We could not create your account. Try again."));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────── */

  return (
    <div className="rg">
      <RegisterPanel />

      <main className="rg-main">
        <div className="rg-card">
          {user ? (
            <SuccessPanel user={user} />
          ) : (
            <>
              <ProgressRail current={step} />
              {step === 1 ? (
                <StepProfile
                  values={values}
                  errors={errors}
                  busy={busy}
                  serverError={serverError}
                  onChange={setField}
                  onSubmit={submitProfile}
                />
              ) : null}

              {step === 2 && attempt ? (
                <StepVerify
                  emailMasked={attempt.emailMasked}
                  code={code}
                  error={codeError}
                  info={codeInfo}
                  busy={busy}
                  resending={resending}
                  resendAfterSeconds={resendAfter}
                  maxAttempts={attempt.maxAttempts}
                  onCodeChange={(next) => {
                    setCode(next);
                    if (codeError) setCodeError(null);
                  }}
                  onSubmit={submitCode}
                  onResend={resend}
                  onBack={backToProfile}
                />
              ) : null}

              {step === 3 ? (
                <StepPassword
                  password={password}
                  confirm={confirm}
                  errors={passwordErrors}
                  serverError={serverError}
                  busy={busy}
                  onPasswordChange={setPassword}
                  onConfirmChange={setConfirm}
                  onSubmit={submitPassword}
                  onBack={backToVerify}
                />
              ) : null}
            </>
          )}

          {/* Only relevant before an account exists; the success screen has
              its own way out. */}
          {!user ? (
            <div className="rg-foot">
              <p className="rg-foot-note">
                Already have an account?{" "}
                <Link className="rg-foot-link" to="/login">
                  Sign in
                </Link>
              </p>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
