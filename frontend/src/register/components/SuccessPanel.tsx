import { Link } from "react-router-dom";
import type { RegisteredUser } from "../lib/api";

interface SuccessPanelProps {
  user: RegisteredUser;
}

/**
 * Confirmation after the server created the account and set the session cookie.
 *
 * Nothing here is simulated: the user shown is the one POST /register/complete
 * returned. No dashboard data is invented — the link simply moves to the app,
 * which will read the real session when it loads.
 */
export default function SuccessPanel({ user }: SuccessPanelProps) {
  return (
    <div className="rg-step">
      <p className="rg-eyebrow">All done</p>
      <h2 className="rg-title">Your account is ready</h2>
      <div className="rg-alert rg-alert--info" role="status">
        <div>
          <strong>Signed in as {user.email}</strong>
          You are signed in on this device. Add your skills and projects next to build your
          Career Twin.
        </div>
      </div>

      <Link className="rg-btn rg-btn--block" to="/app">
        Go to your workspace
      </Link>

      <div className="rg-foot">
        <Link className="rg-foot-link" to="/">
          Back to the home page
        </Link>
      </div>
    </div>
  );
}
