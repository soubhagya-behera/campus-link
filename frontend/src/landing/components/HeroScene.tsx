/**
 * The Ridgeline: the hero's signature visual.
 *
 * One inline SVG landscape — sky, four terrain bands at increasing depth,
 * drifting mist, a summit light burst, survey contours and a signal path that
 * climbs through five career stations to a destination fix.
 *
 * Performance notes:
 *  - `pathLength={1}` normalises every stroke, so the draw-in is a plain
 *    stroke-dashoffset transition with no geometry measured at runtime.
 *  - Depth is produced by nesting <g> elements. Three separate motions
 *    (entrance / scroll parallax / idle drift) each own one element, so they
 *    never compete for the same property.
 *  - Only transform and opacity animate. No canvas, no 3D, no animation lib.
 */
import type { CSSProperties } from "react";

interface Station {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly delay: number;
  /** Caption anchor, as a percentage of the 720x900 viewBox. */
  readonly capLeft: number;
  readonly capTop: number;
  readonly alignRight?: boolean;
}

const STATIONS: readonly Station[] = [
  { name: "Skills", x: 196, y: 702, delay: 1150, capLeft: 26, capTop: 81 },
  { name: "Projects", x: 306, y: 566, delay: 1420, capLeft: 41, capTop: 66 },
  { name: "Readiness", x: 420, y: 400, delay: 1690, capLeft: 57, capTop: 47 },
  { name: "Matching", x: 492, y: 268, delay: 1960, capLeft: 67, capTop: 33 },
  { name: "Next move", x: 556, y: 150, delay: 2230, capLeft: 74, capTop: 20, alignRight: true },
];

const VIEW_W = 720;
const VIEW_H = 900;

/** The signal path: bottom-left foreground to the summit fix. */
const SIGNAL_PATH =
  "M60,868 C110,822 150,772 196,702 C246,634 268,606 306,566 C350,520 392,466 420,400 C446,344 476,300 492,268 C516,214 542,182 556,150";

const CONTOURS = [
  { d: "M0,318 C90,286 170,318 260,296 C350,274 430,310 520,288 C600,268 668,302 720,280", delay: 260 },
  { d: "M0,442 C80,414 160,450 250,426 C340,402 420,442 510,418 C590,396 660,430 720,408", delay: 420 },
  { d: "M0,584 C90,552 180,590 280,564 C380,538 460,580 560,554 C640,534 690,562 720,548", delay: 580 },
] as const;

const GRASS = [
  "M40,892 l-6,-26 M46,892 l2,-34 M52,892 l9,-22",
  "M188,880 l-4,-22 M194,880 l3,-30 M200,880 l8,-19",
  "M372,888 l-6,-24 M378,888 l1,-32 M384,888 l9,-21",
  "M556,876 l-5,-23 M562,876 l3,-31 M568,876 l8,-20",
  "M668,890 l-6,-25 M674,890 l2,-33 M680,890 l9,-22",
] as const;

export default function HeroScene() {
  return (
    <figure className="cl-scene">
      <div className="cl-scene-frame">
        <svg
          className="cl-scene-svg"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id="rs-sky" x1="0" y1="0" x2="0.35" y2="1">
              <stop offset="0" stopColor="#0e2a20" />
              <stop offset="0.42" stopColor="#173c2f" />
              <stop offset="0.78" stopColor="#24503d" />
              <stop offset="1" stopColor="#31614a" />
            </linearGradient>
            <linearGradient id="rs-far" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#4a7561" />
              <stop offset="1" stopColor="#2f5a48" />
            </linearGradient>
            <linearGradient id="rs-mid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#35604c" />
              <stop offset="1" stopColor="#1f4835" />
            </linearGradient>
            <linearGradient id="rs-near" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#204636" />
              <stop offset="1" stopColor="#143326" />
            </linearGradient>
            <linearGradient id="rs-front" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#102a1f" />
              <stop offset="1" stopColor="#081810" />
            </linearGradient>
            <linearGradient id="rs-mist" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#cfe3d4" stopOpacity="0" />
              <stop offset="0.35" stopColor="#dcebdd" stopOpacity="0.55" />
              <stop offset="0.65" stopColor="#cfe3d4" stopOpacity="0.4" />
              <stop offset="1" stopColor="#cfe3d4" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="rs-bloom" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#eaffc2" stopOpacity="0.95" />
              <stop offset="0.28" stopColor="#c5e86c" stopOpacity="0.5" />
              <stop offset="0.62" stopColor="#8fc45a" stopOpacity="0.16" />
              <stop offset="1" stopColor="#c5e86c" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="rs-sun" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#f2f7d9" stopOpacity="0.5" />
              <stop offset="1" stopColor="#f2f7d9" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="rs-ray" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e4f5c0" stopOpacity="0.3" />
              <stop offset="1" stopColor="#e4f5c0" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="rs-vig" cx="0.52" cy="0.38" r="0.78">
              <stop offset="0.45" stopColor="#06110c" stopOpacity="0" />
              <stop offset="1" stopColor="#06110c" stopOpacity="0.6" />
            </radialGradient>
          </defs>

          {/* Sky and the low sun behind the ridge line. */}
          <rect width={VIEW_W} height={VIEW_H} fill="url(#rs-sky)" className="cl-sc-sky" />
          <circle
            className="cl-sc-shimmer"
            cx="600"
            cy="120"
            r="210"
            fill="url(#rs-sun)"
          />

          {/* Far band. */}
          <g className="cl-sc-rise" style={{ "--rise-delay": "120ms" } as CSSProperties}>
            <g className="cl-sc-layer" style={{ "--depth": "12px" } as CSSProperties}>
              <g
                className="cl-sc-drift"
                style={{ "--dur": "38s", "--amp": "10px" } as CSSProperties}
              >
                <path
                  d="M0,318 C90,286 170,318 260,296 C350,274 430,310 520,288 C600,268 668,302 720,280 L720,900 L0,900 Z"
                  fill="url(#rs-far)"
                />
                <path
                  className="cl-sc-contour"
                  d={CONTOURS[0].d}
                  pathLength={1}
                  opacity="0.34"
                  style={{ "--d": `${CONTOURS[0].delay}ms` } as CSSProperties}
                />
              </g>
            </g>
          </g>

          {/* Mist between the far and mid bands: the depth cue. */}
          <g className="cl-sc-mist" style={{ "--mist-dur": "34s" } as CSSProperties}>
            <ellipse cx="360" cy="372" rx="470" ry="46" fill="url(#rs-mist)" />
          </g>

          {/* Mid band. */}
          <g className="cl-sc-rise" style={{ "--rise-delay": "260ms" } as CSSProperties}>
            <g className="cl-sc-layer" style={{ "--depth": "22px" } as CSSProperties}>
              <g
                className="cl-sc-drift"
                style={{ "--dur": "29s", "--amp": "16px" } as CSSProperties}
              >
                <path
                  d="M0,442 C80,414 160,450 250,426 C340,402 420,442 510,418 C590,396 660,430 720,408 L720,900 L0,900 Z"
                  fill="url(#rs-mid)"
                />
                <path
                  className="cl-sc-contour"
                  d={CONTOURS[1].d}
                  pathLength={1}
                  opacity="0.3"
                  style={{ "--d": `${CONTOURS[1].delay}ms` } as CSSProperties}
                />
              </g>
            </g>
          </g>

          <g className="cl-sc-mist" style={{ "--mist-dur": "26s" } as CSSProperties}>
            <ellipse cx="400" cy="512" rx="440" ry="40" fill="url(#rs-mist)" opacity="0.8" />
          </g>

          {/* Near band. */}
          <g className="cl-sc-rise" style={{ "--rise-delay": "400ms" } as CSSProperties}>
            <g className="cl-sc-layer" style={{ "--depth": "36px" } as CSSProperties}>
              <g
                className="cl-sc-drift"
                style={{ "--dur": "21s", "--amp": "24px" } as CSSProperties}
              >
                <path
                  d="M0,584 C90,552 180,590 280,564 C380,538 460,580 560,554 C640,534 690,562 720,548 L720,900 L0,900 Z"
                  fill="url(#rs-near)"
                />
                <path
                  className="cl-sc-contour"
                  d={CONTOURS[2].d}
                  pathLength={1}
                  opacity="0.26"
                  style={{ "--d": `${CONTOURS[2].delay}ms` } as CSSProperties}
                />
              </g>
            </g>
          </g>

          {/* Summit light and the path. */}
          <g className="cl-sc-layer" style={{ "--depth": "18px" } as CSSProperties}>
            {/* Light shafts falling from the destination. */}
            <g className="cl-sc-ray">
              <path d="M556,150 L432,760 L560,760 Z" fill="url(#rs-ray)" opacity="0.5" />
              <path d="M556,150 L606,760 L716,760 Z" fill="url(#rs-ray)" opacity="0.34" />
            </g>

            <circle className="cl-sc-bloom" cx="556" cy="150" r="150" fill="url(#rs-bloom)" />

            <path
              className="cl-sc-path-bed"
              d={SIGNAL_PATH}
              pathLength={1}
              data-scene-path="bed"
            />
            <path className="cl-sc-path" d={SIGNAL_PATH} pathLength={1} data-scene-path="main" />
            <path className="cl-sc-charge" d={SIGNAL_PATH} pathLength={1} />

            {STATIONS.map((s) => (
              <g key={s.name} style={{ "--d": `${s.delay}ms` } as CSSProperties}>
                <circle
                  className="cl-sc-ping"
                  cx={s.x}
                  cy={s.y}
                  r="9"
                  fill="none"
                  stroke="#c5e86c"
                  strokeWidth="1.4"
                />
                <g className="cl-sc-node">
                  <circle cx={s.x} cy={s.y} r="6" fill="#f5f4ee" stroke="#173c2f" strokeWidth="2.5" />
                  <circle cx={s.x} cy={s.y} r="2.2" fill="#173c2f" />
                </g>
              </g>
            ))}

            {/* Destination: a crossed fix on the summit. */}
            <g className="cl-sc-summit" stroke="#c5e86c" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="556" cy="150" r="13" fill="none" />
              <path d="M556,126 L556,174 M532,150 L580,150" />
            </g>
          </g>

          {/* Foreground. */}
          <g className="cl-sc-rise" style={{ "--rise-delay": "540ms" } as CSSProperties}>
            <g className="cl-sc-layer" style={{ "--depth": "-30px" } as CSSProperties}>
              <g
                className="cl-sc-drift"
                style={{ "--dur": "15s", "--amp": "34px" } as CSSProperties}
              >
                <path
                  d="M0,742 C100,710 200,752 300,728 C400,704 480,748 580,722 C650,704 700,728 720,720 L720,900 L0,900 Z"
                  fill="url(#rs-front)"
                />
              </g>
            </g>
          </g>

          {/* Foreground grasses, two groups swaying out of phase. */}
          <g stroke="#04100b" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.85">
            <g className="cl-sc-grass">
              <path d={GRASS[0]} />
              <path d={GRASS[1]} />
            </g>
            <g className="cl-sc-grass cl-sc-grass--b">
              <path d={GRASS[2]} />
              <path d={GRASS[3]} />
              <path d={GRASS[4]} />
            </g>
          </g>

          <rect width={VIEW_W} height={VIEW_H} fill="url(#rs-vig)" pointerEvents="none" />
        </svg>
      </div>

      {STATIONS.map((s) => (
        <span
          key={s.name}
          className={`cl-scene-tag${s.alignRight ? " cl-scene-tag--last" : ""}`}
          style={
            {
              left: `${s.capLeft}%`,
              top: `${s.capTop}%`,
              transform: s.alignRight ? "translateX(-100%)" : undefined,
              "--d": `${s.delay + 220}ms`,
            } as CSSProperties
          }
        >
          {s.name}
        </span>
      ))}

      <p className="cl-scene-meta">One path, five stations</p>
      <figcaption className="cl-sr">
        An illustration of a single signal path climbing through five stations: skills, projects,
        readiness, matching, and the next move.
      </figcaption>
    </figure>
  );
}
