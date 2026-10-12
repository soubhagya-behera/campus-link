import { Link } from "react-router-dom";
import { Arrow, Reveal } from "./bits";

/** The ridge motif returns, flattened into a horizon under the closing panel. */
function Horizon() {
  return (
    <svg
      className="cl-cta-horizon"
      viewBox="0 0 1200 300"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M0,214 C120,182 210,224 330,196 C450,168 540,214 660,188 C780,162 870,206 990,180 C1070,162 1140,190 1200,176"
        stroke="currentColor"
        strokeWidth="1.2"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M0,248 C130,218 220,258 340,232 C460,206 550,248 670,222 C790,198 880,240 1000,214 C1080,198 1150,224 1200,210"
        stroke="currentColor"
        strokeWidth="1.2"
        vectorEffect="non-scaling-stroke"
        opacity="0.6"
      />
      <circle cx="990" cy="180" r="4.5" fill="#c5e86c" />
      <path
        d="M990,164 L990,148 M976,171 L1004,187 M1004,171 L976,187"
        stroke="#c5e86c"
        strokeWidth="1.4"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function FinalCta() {
  return (
    <section className="cl-section" id="start" aria-labelledby="cta-title">
      <div className="cl-shell">
        <Reveal>
          <div className="cl-cta">
            <Horizon />
            <div className="cl-cta-in">
              <div>
                <p className="cl-eyebrow">Start here</p>
                <h2 className="cl-h2" id="cta-title">
                  The path starts at the bottom.
                </h2>
              </div>
              <div>
                <p className="cl-lede">
                  Open the workspace and record your first skill. It takes one line, and everything
                  else builds on it.
                </p>
                <div className="cl-cta-actions" style={{ marginTop: "1.25rem" }}>
                  <Link className="cl-btn cl-btn--primary cl-btn--lg" to="/register">
                    Get started <Arrow />
                  </Link>
                  <a className="cl-link" href="#journey">
                    See how it works <Arrow />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
