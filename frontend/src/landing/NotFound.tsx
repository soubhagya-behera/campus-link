import { Link } from "react-router-dom";
import { Arrow, Mark } from "./components/bits";
import "./landing.css";

/** Public 404. Kept on-brand; the workspace has its own navigation. */
export default function NotFound() {
  return (
    <div className="cl" style={{ display: "grid", placeItems: "center", minHeight: "100dvh" }}>
      <main className="cl-shell" style={{ paddingBlock: "6rem", maxWidth: "34rem" }}>
        <WordmarkNoLink />
        <p className="cl-eyebrow" style={{ marginTop: "2.25rem" }}>
          Error 404 / off the path
        </p>
        <h1 className="cl-h1" style={{ marginTop: "0.9rem", fontSize: "clamp(2.2rem, 1.4rem + 3vw, 3.4rem)" }}>
          This one does not lead anywhere.
        </h1>
        <p className="cl-lede" style={{ marginTop: "1rem" }}>
          The address you followed is not part of CAMPUSLINK. The homepage has the full map.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1.75rem" }}>
          <Link className="cl-btn cl-btn--primary cl-btn--lg" to="/">
            Back to the homepage <Arrow />
          </Link>
          <Link className="cl-btn cl-btn--quiet cl-btn--lg" to="/app">
            Open the workspace
          </Link>
        </div>
      </main>
    </div>
  );
}

function WordmarkNoLink() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.55rem" }}>
      <Mark />
      <span>
        <span className="cl-mark-word">CAMPUSLINK</span>
        <span className="cl-mark-sub">Career Intelligence</span>
      </span>
    </span>
  );
}
