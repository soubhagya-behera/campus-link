import { Link } from "react-router-dom";
import { Mark } from "../../landing/components/bits";

/**
 * Compact editorial panel.
 *
 * Same photograph as registration, composed differently on purpose: a short,
 * framed card rather than a full-bleed column, so the two pages do not read
 * as copies. The photograph itself is decorative (alt=""); the brand link
 * and caption carry the meaning.
 */
export default function LoginPanel() {
  return (
    <div className="lg-aside">
      <aside className="lg-panel">
        <img
          className="lg-panel-media"
          src="/images/register-student.png"
          alt=""
          width={1536}
          height={1024}
          decoding="async"
          fetchPriority="high"
        />
        <div className="lg-panel-body">
          <Link className="lg-brand" to="/" aria-label="CAMPUSLINK — back to the home page">
            <Mark className="lg-mark" />
            <span className="lg-brand-name">CAMPUSLINK</span>
          </Link>
          <div className="lg-caption">
            <p className="lg-caption-line">Show your work. Find opportunities that fit.</p>
            <p className="lg-caption-sub">Career Intelligence for students</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
