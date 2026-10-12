import { Reveal } from "./bits";

const TRACE = [
  { title: "You record a skill", body: "A claim, stored against your profile. On its own it moves nothing." },
  { title: "A project links to it", body: "The claim now has something a stranger can check." },
  { title: "It counts as evidenced", body: "Only now does it affect readiness and match strength." },
  { title: "Matches reorder", body: "One link, three consequences, all recomputed from records." },
] as const;

const RECORD = [
  { skill: "React", level: "Advanced", note: "Linked to Accessible data table", width: "86%" },
  { skill: "SQL", level: "Intermediate", note: "Linked to Ledger analytics", width: "64%" },
  { skill: "Data viz", level: "Claimed", note: "No project attached yet", width: "26%" },
] as const;

export default function EvidenceSection() {
  return (
    <section className="cl-section" id="evidence" aria-labelledby="evidence-title">
      <div className="cl-shell">
        <Reveal className="cl-platform-head">
          <div>
            <p className="cl-eyebrow">Progress and evidence</p>
            <h2 className="cl-h2" id="evidence-title" style={{ marginTop: "0.9rem" }}>
              Progress you can point at.
            </h2>
          </div>
          <p className="cl-lede">
            Not a streak or a score that drifts on its own: the count of skills you can attach
            something real to.
          </p>
        </Reveal>

        <div className="cl-proof">
          <ol className="cl-trace">
            {TRACE.map((step) => (
              <li key={step.title}>
                <b>{step.title}</b>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>

          <Reveal delay={120}>
            <div className="cl-record">
              <div className="cl-record-bar">
                <span className="cl-tag cl-tag--signal">Career Twin</span>
                <p>Illustrative example</p>
              </div>
              {RECORD.map((row) => (
                <div className="cl-record-row" key={row.skill}>
                  <div className="cl-record-top">
                    <span className="cl-record-skill">{row.skill}</span>
                    <span className="cl-tag">{row.level}</span>
                  </div>
                  <span className="cl-record-note">{row.note}</span>
                  <span className="cl-rank-track">
                    <span className="cl-rank-fill" style={{ width: row.width }} />
                  </span>
                </div>
              ))}
              <div className="cl-record-foot">
                <span>
                  evidenced <b>2 of 3</b>
                </span>
                <span>
                  readiness <b>from records only</b>
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
