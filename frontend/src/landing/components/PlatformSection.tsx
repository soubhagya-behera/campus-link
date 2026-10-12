import type { ReactNode } from "react";
import { Reveal } from "./bits";
import {
  ArenaFigure,
  LadderFigure,
  MirrorFigure,
  PassportFigure,
  PipelineFigure,
  RankFigure,
} from "./PlatformFigures";

function Card({
  tag,
  title,
  body,
  figure,
  delay = 0,
  tint = false,
}: {
  tag: string;
  title: string;
  body: string;
  figure: ReactNode;
  delay?: number;
  tint?: boolean;
}) {
  return (
    <Reveal delay={delay} className="h-full">
      <article className="cl-card h-full">
        <span className="cl-tag">{tag}</span>
        <h3 className="cl-h3">{title}</h3>
        <p>{body}</p>
        <div className={`cl-card-figure${tint ? " cl-card-figure--tint" : ""}`}>{figure}</div>
      </article>
    </Reveal>
  );
}

export default function PlatformSection() {
  return (
    <section className="cl-section" id="platform" aria-labelledby="platform-title">
      <div className="cl-shell">
        <Reveal className="cl-platform-head">
          <div>
            <p className="cl-eyebrow">The platform</p>
            <h2 className="cl-h2" id="platform-title" style={{ marginTop: "0.9rem" }}>
              Six tools. One career record.
            </h2>
          </div>
          <p className="cl-lede">
            Each tool writes something the others read, so nothing you enter ever has to be
            entered twice.
          </p>
        </Reveal>

        {/* 1 · Spotlight */}
        <Reveal>
          <div className="cl-spotlight">
            <div className="cl-spotlight-copy">
              <span className="cl-tag cl-tag--signal">Career Twin</span>
              <h3 className="cl-h3">Your skill record, kept honest</h3>
              <p className="cl-body">
                Every skill is split in two: what you claim, and what a project backs. Only the
                second kind counts when roles are matched.
              </p>
            </div>
            <MirrorFigure />
          </div>
        </Reveal>

        {/* 2 · Asymmetric trio */}
        <div className="cl-trio">
          <Card
            tag="Opportunity Mirror"
            title="Roles ranked by fit"
            body="Open roles sorted against your evidenced skills, with the exact gaps holding each one back."
            figure={<RankFigure />}
            tint
          />
          <Card
            tag="Skill Sprint"
            title="Earn the skill"
            body="Short briefs you submit for real. A passing grade promotes the skill and files the evidence."
            figure={<LadderFigure />}
            delay={90}
            tint
          />
          <Card
            tag="Career Passport"
            title="Claims you can show"
            body="A record where every claim links back to a real project or graded submission."
            figure={<PassportFigure />}
            delay={180}
          />
        </div>

        {/* 3 · Editorial pair */}
        <div className="cl-pair">
          <Card
            tag="Applications"
            title="A tracker that stays accurate"
            body="Applying writes a real record, and the system refuses duplicates and backward status changes."
            figure={<PipelineFigure />}
            tint
          />
          <Card
            tag="Interview Arena"
            title="Reps, not tips"
            body="Practice answers scored on the same public rubric a panel uses."
            figure={<ArenaFigure />}
            delay={90}
            tint
          />
        </div>
      </div>
    </section>
  );
}
