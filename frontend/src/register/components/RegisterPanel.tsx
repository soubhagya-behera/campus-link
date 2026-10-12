import { Link } from "react-router-dom";
import { Mark } from "../../landing/components/bits";

/**
 * The editorial image panel.
 *
 * The photograph is shown cleanly with no text, logo or overlay drawn over
 * it, so the student's face, hair and hands stay unobstructed. Branding and
 * messaging live in a separate solid surface below the image (stacked banner
 * on mobile), never across her face. The logo is the existing CAMPUSLINK
 * mark, imported from the landing module so this screen cannot drift into a
 * separate identity.
 */
export default function RegisterPanel() {
  return (
    <aside className="rg-panel">
      <div className="rg-panel-photo">
        <img
          className="rg-panel-media"
          src="/images/register-student.png"
          alt=""
          aria-hidden="true"
          width={1536}
          height={1024}
          decoding="async"
          fetchPriority="high"
        />
      </div>
      <div className="rg-panel-body">
        <Link className="rg-brand" to="/" aria-label="CAMPUSLINK — back to the home page">
          <Mark className="rg-mark" />
          <span>
            <span className="rg-brand-name">CAMPUSLINK</span>
            <span className="rg-brand-sub">Career Intelligence</span>
          </span>
        </Link>

        <h1>Your next chapter starts here.</h1>
        <p className="rg-panel-lede">
          Build your skills. Show your work. Find opportunities that fit.
        </p>
        <p className="rg-panel-note">Student accounts · Verified email</p>
      </div>
    </aside>
  );
}
