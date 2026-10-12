import { Link } from "react-router-dom";
import { Arrow, Reveal } from "./bits";

const CELLS = ["Cohort", "Readiness spread", "Open drives", "In flight"] as const;

export default function RecruitersSection() {
  return (
    <section className="cl-section cl-section--tight" id="recruiters" aria-labelledby="recruiters-title">
      <div className="cl-shell">
        <Reveal className="cl-placement">
          <div className="cl-placement-copy">
            <p className="cl-eyebrow">For placement cells</p>
            <h2 className="cl-h2" id="recruiters-title">
              The whole batch, one screen.
            </h2>
            <p className="cl-body">
              The Placement Tower reads the same records students write, so every figure shown to a
              partner institution traces back to a row rather than a spreadsheet.
            </p>
            <div style={{ paddingTop: "0.35rem" }}>
              <Link className="cl-btn cl-btn--quiet" to="/tower">
                Open the workspace <Arrow />
              </Link>
            </div>
          </div>

          <Reveal delay={110}>
            <div className="cl-placement-board">
              {CELLS.map((label) => (
                <div className="cl-placement-cell" key={label}>
                  <b aria-hidden="true">&mdash;</b>
                  <span>{label}</span>
                </div>
              ))}
              <p className="cl-note" style={{ gridColumn: "1 / -1", margin: 0 }}>
                Live batch figures are shown inside the Placement Tower workspace.
              </p>
            </div>
          </Reveal>
        </Reveal>
      </div>
    </section>
  );
}
