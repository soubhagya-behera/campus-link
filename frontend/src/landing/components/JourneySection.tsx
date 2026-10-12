import { useRef } from "react";
import { useReveal, useScrollProgress } from "../hooks/useReveal";
import { Reveal } from "./bits";

interface Stop {
  readonly title: string;
  readonly body: string;
}

const STOPS: readonly Stop[] = [
  { title: "Skills", body: "Record what you can do and the level you can defend." },
  { title: "Projects", body: "Attach the work that proves it. Unproven skills stay in progress." },
  { title: "Readiness", body: "One score from your records, with the inputs shown underneath." },
  { title: "Opportunities", body: "Roles ranked against your evidence, with the gaps named." },
];

function PathStop({ stop, index }: { stop: Stop; index: number }) {
  const { ref, inView } = useReveal<HTMLLIElement>({ threshold: 0.4 });
  return (
    <li ref={ref} className={`cl-stop${inView ? " is-in" : ""}`}>
      <span className="cl-stop-rail" aria-hidden="true" />
      <span className="cl-stop-dot" aria-hidden="true" />
      <div>
        <span className="cl-stop-index">{String(index + 1).padStart(2, "0")}</span>
        <h3>{stop.title}</h3>
        <p>{stop.body}</p>
      </div>
    </li>
  );
}

export default function JourneySection() {
  const section = useRef<HTMLDivElement | null>(null);
  useScrollProgress(section, "--cl-journey", "through");

  return (
    <section
      className="cl-band cl-band--dark cl-journey"
      id="journey"
      aria-labelledby="journey-title"
    >
      <div className="cl-shell" ref={section}>
        <Reveal className="cl-journey-head">
          <p className="cl-eyebrow">How it works</p>
          <h2 className="cl-h2" id="journey-title">
            One path, four steps, one record.
          </h2>
          <p className="cl-lede">
            Everything you add strengthens the same profile. Nothing is scored twice.
          </p>
        </Reveal>

        <div className="cl-pathway-wrap">
          <div className="cl-pathway-rail" aria-hidden="true">
            <span className="cl-pathway-fill" />
            <span className="cl-pathway-bead" />
          </div>
          <ol className="cl-pathway">
            {STOPS.map((stop, i) => (
              <PathStop key={stop.title} stop={stop} index={i} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
