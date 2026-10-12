import { useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, api } from "../lib/server";
import LoginForm from "./components/LoginForm";
import LoginPanel from "./components/LoginPanel";
import {
  hasLoginErrors,
  safeNext,
  validateLogin,
  type LoginErrors,
  type LoginValues,
} from "./lib/validation";
import "./login.css";

/** Maps the server's verdict to one honest sentence. No message is invented. */
function loginError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 0:
        return "Cannot reach the API. Start the backend, then try again.";
      case 400:
        return "That request was not valid. Check the fields and try again.";
      case 401:
        return "Incorrect email or password. Check both and try again.";
      case 429:
        return "Too many attempts. Wait a little, then try again.";
      default:
        return err.message || "Sign-in failed. Try again.";
    }
  }
  return "Sign-in failed. Try again.";
}

const EMPTY: LoginValues = { email: "", password: "" };

/**
 * The sign-in page.
 *
 * Renders outside the SessionProvider on purpose, like the landing page: an
 * unauthenticated visitor must never need a session just to see the form. On
 * success the server has already set the session cookie, so navigating to the
 * return path is enough — the app gate reads the real session when it loads.
 */
export default function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [values, setValues] = useState<LoginValues>(EMPTY);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const setField = (field: keyof LoginValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
    setServerError(null);
  };

  const submit = async () => {
    const found = validateLogin(values);
    setErrors(found);
    if (hasLoginErrors(found) || inFlight.current) return;

    inFlight.current = true;
    setBusy(true);
    setServerError(null);
    try {
      // A 2xx here means the server verified the credentials AND set the
      // session cookie. Nothing else on this page decides signed-in state.
      await api.login(values.email, values.password);
      navigate(safeNext(params.get("next")), { replace: true });
    } catch (err) {
      setServerError(loginError(err));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="lg">
      <main className="lg-main">
        <div className="lg-card">
          <p className="rg-eyebrow">Student sign-in</p>
          <h1 className="lg-title">Welcome back</h1>
          <p className="lg-lede">Sign in to continue to your workspace.</p>

          <LoginForm
            values={values}
            errors={errors}
            serverError={serverError}
            busy={busy}
            onChange={setField}
            onSubmit={submit}
          />

          <div className="lg-foot">
            <p className="lg-foot-note">
              New here?{" "}
              <Link className="lg-foot-link" to="/register">
                Create your account
              </Link>
            </p>
            <Link className="lg-foot-link" to="/">
              Back to home
            </Link>
          </div>
        </div>
      </main>

      <LoginPanel />
    </div>
  );
}
