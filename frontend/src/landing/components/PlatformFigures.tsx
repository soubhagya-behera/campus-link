/**
 * Product-shaped figures for the capability cards.
 * Each one is a small piece of the real interface, not decoration, so the
 * capabilities can be read at a glance instead of being read about.
 */

const CLAIMED = [
  { skill: "React", level: "Advanced" },
  { skill: "SQL", level: "Intermediate" },
  { skill: "Data viz", level: "Claimed" },
] as const;

const PROVEN = ["React", "SQL"] as const;

/** Career Twin: the same list, split between what is claimed and what is backed. */
export function MirrorFigure() {
  return (
    <div className="cl-mirror">
      <div className="cl-mirror-col">
        <p className="cl-mirror-title">Claimed</p>
        {CLAIMED.map((row) => (
          <p className="cl-mirror-row" key={row.skill}>
            <i />
            {row.skill}
            <b>{row.level}</b>
          </p>
        ))}
      </div>
      <div className="cl-mirror-seam" aria-hidden="true" />
      <div className="cl-mirror-col">
        <p className="cl-mirror-title">Evidenced</p>
        {PROVEN.map((skill) => (
          <p className="cl-mirror-row cl-mirror-row--proven" key={skill}>
            <i />
            {skill}
            <b>Proven</b>
          </p>
        ))}
        <p className="cl-mirror-row">
          <i />
          Data viz
          <b>Pending</b>
        </p>
      </div>
    </div>
  );
}

const MATCHES = [
  { role: "Frontend engineer", score: 86, top: true },
  { role: "Data analyst", score: 74, top: false },
  { role: "Support engineer", score: 51, top: false },
] as const;

/** Opportunity Mirror: ranked fit with the gaps called out. */
export function RankFigure() {
  return (
    <div className="cl-rank">
      {MATCHES.map((m) => (
        <div className={`cl-rank-row${m.top ? " cl-rank-row--top" : ""}`} key={m.role}>
          <span className="cl-rank-name">{m.role}</span>
          <span className="cl-rank-score">{m.score}%</span>
          <span className="cl-rank-track">
            <span className="cl-rank-fill" style={{ width: `${m.score}%` }} />
          </span>
        </div>
      ))}
      <p className="cl-rank-gaps">Gaps named per role</p>
    </div>
  );
}

interface RubricRow {
  readonly label: string;
  readonly width: string;
  readonly top?: boolean;
}

const RUBRIC: readonly RubricRow[] = [
  { label: "Substance", width: "52%" },
  { label: "Numbers", width: "68%" },
  { label: "Reasoning", width: "84%" },
  { label: "Structure", width: "100%", top: true },
];

/** Skill Sprint: the public rubric a submission is graded on. */
export function LadderFigure() {
  return (
    <div className="cl-ladder">
      {RUBRIC.map((r) => (
        <div className={`cl-ladder-row${r.top ? " cl-ladder-row--top" : ""}`} key={r.label}>
          <span className="cl-ladder-label">{r.label}</span>
          <span className="cl-ladder-track">
            <span className="cl-ladder-fill" style={{ width: r.width }} />
          </span>
        </div>
      ))}
    </div>
  );
}

const STAMPS = [
  { name: "Course project", meta: "Project" },
  { name: "Graded submission", meta: "Sprint 82" },
  { name: "Published link", meta: "Public" },
] as const;

/** Career Passport: every claim resolves to something real. */
export function PassportFigure() {
  return (
    <div className="cl-passport">
      {STAMPS.map((s) => (
        <p className="cl-passport-stamp" key={s.name}>
          {s.name}
          <span>{s.meta}</span>
        </p>
      ))}
    </div>
  );
}

const PIPELINE = [
  { label: "Applied", tiles: [true, true, false] },
  { label: "Shortlisted", tiles: [true, false, false] },
  { label: "Closed", tiles: [true, false, false] },
] as const;

/** Applications: a guarded pipeline. */
export function PipelineFigure() {
  return (
    <div className="cl-pipeline">
      {PIPELINE.map((col) => (
        <div className="cl-pipeline-col" key={col.label}>
          <span className="cl-pipeline-label">{col.label}</span>
          {col.tiles.map((live, i) => (
            <span
              key={i}
              className={`cl-pipeline-tile${live && i === 0 ? " cl-pipeline-tile--live" : ""}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Interview Arena: practice exchange graded on the public rubric. */
export function ArenaFigure() {
  return (
    <div className="cl-arena">
      <div className="cl-arena-row">
        <p className="cl-arena-bubble">Which number moved, and how did you measure it?</p>
      </div>
      <div className="cl-arena-row cl-arena-row--you">
        <p className="cl-arena-bubble">Render time, 900ms to 120ms, measured on a 5k-row table.</p>
      </div>
    </div>
  );
}
