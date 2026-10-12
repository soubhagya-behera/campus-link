import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Badge, Card } from "../components/ui";
import "../components/staff.css";
import type { ApplicationRecord, AttemptRecord, ProjectRecord } from "../lib/server";

export interface ArenaRound {
  id: string;
  type: string;
  score: number | null;
  feedback: string | null;
  createdAt: string;
}

/** Accessible show-more wrapper so long histories never dominate the page. */
function ExpandableList<T>({
  items,
  initial,
  keyOf,
  renderItem,
  expandLabel,
}: {
  items: T[];
  initial: number;
  keyOf: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  expandLabel: (total: number) => string;
}) {
  const [open, setOpen] = useState(false);
  const visible = open ? items : items.slice(0, initial);
  return (
    <>
      <ul className="mt-2 space-y-2">
        {visible.map((item) => (
          <li key={keyOf(item)}>{renderItem(item)}</li>
        ))}
      </ul>
      {items.length > initial && (
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-[var(--ws-forest)] hover:underline st-link"
        >
          {open ? "Show less" : expandLabel(items.length)}
          <ChevronDown size={14} aria-hidden="true" className={open ? "rotate-180" : ""} />
        </button>
      )}
    </>
  );
}

/**
 * Evidence grouped the way staff read it: durable proof (projects + graded
 * sprints) in one column, practice volume and application trail in the other.
 * Each column flows at its own natural height — no forced equal rows, no
 * blank areas. Long histories collapse behind explicit controls; nothing is
 * discarded, every number comes from persisted records.
 *
 * The four section cards are also exported individually so the staff student
 * profile can interleave them with its own summary cards in two independent
 * flowing columns.
 */
export default function ApplicantEvidence({
  projects,
  evaluated,
  arena,
  history,
}: {
  projects: ProjectRecord[];
  evaluated: AttemptRecord[];
  arena: ArenaRound[];
  history: ApplicationRecord[];
}) {
  return (
    <div className="mt-4 grid items-start gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <ProjectsCard projects={projects} />
        <SprintCard evaluated={evaluated} />
      </div>
      <div className="space-y-4">
        <ArenaCard arena={arena} />
        <HistoryCard history={history} />
      </div>
    </div>
  );
}

export function ProjectsCard({ projects }: { projects: ProjectRecord[] }) {
  return (
    <Card className="st-card p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ws-faint)]">
        Projects · {projects.length}
      </p>
      {projects.length === 0 ? (
        <p className="mt-1 text-sm text-[var(--ws-mute)]">No projects on record.</p>
      ) : (
        <ExpandableList
          items={projects}
          initial={4}
          keyOf={(p) => p.id}
          expandLabel={(total) => `Show all ${total} projects`}
          renderItem={(p) => (
            <div className="rounded-xl border border-[var(--ws-line)] p-3">
              <p className="text-sm font-semibold text-[var(--ws-ink)]">{p.title}</p>
              {p.description && <p className="mt-0.5 text-xs leading-relaxed text-[var(--ws-mute)]">{p.description}</p>}
              {p.url && (
                <a href={p.url} target="_blank" rel="noreferrer" className="mt-1 block break-all font-mono text-[11px] text-[var(--ws-forest)] hover:underline">
                  {p.url}
                </a>
              )}
              {p.skills.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {p.skills.map((s) => (
                    <Badge key={s} tone="sky">{s}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        />
      )}
    </Card>
  );
}

export function SprintCard({ evaluated }: { evaluated: AttemptRecord[] }) {
  return (
    <Card className="st-card p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ws-faint)]">
        Skill Sprint · {evaluated.length} evaluated
      </p>
      {evaluated.length === 0 ? (
        <p className="mt-1 text-sm text-[var(--ws-mute)]">No evaluated submissions.</p>
      ) : (
        <ExpandableList
          items={evaluated}
          initial={3}
          keyOf={(a) => a.id}
          expandLabel={(total) => `Show all ${total} submissions`}
          renderItem={(a) => (
            <div className="rounded-xl border border-[var(--ws-line)] p-3 text-sm">
              <p className="font-medium text-[var(--ws-ink)]">
                {a.assessment?.title ?? "Challenge"} · <span className="font-mono">{a.score}/100</span>
              </p>
              {a.feedback && <p className="mt-0.5 text-xs leading-relaxed text-[var(--ws-mute)]">{a.feedback.split("\n")[0]}</p>}
              {a.repoUrl && (
                <a href={a.repoUrl} target="_blank" rel="noreferrer" className="mt-0.5 block break-all font-mono text-[11px] text-[var(--ws-forest)] hover:underline">
                  {a.repoUrl}
                </a>
              )}
            </div>
          )}
        />
      )}
    </Card>
  );
}

export function ArenaCard({ arena }: { arena: ArenaRound[] }) {
  const scoredArena = arena.filter((s) => s.score !== null);
  const bestArena = scoredArena.reduce((m, s) => Math.max(m, s.score ?? 0), 0);
  const latestArena = scoredArena[0];
  return (
    <Card className="st-card p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ws-faint)]">
        Interview Arena · {scoredArena.length} practice rounds
      </p>
      <p className="mt-1 text-xs text-[var(--ws-mute)]">Practice only — not a hiring assessment.</p>
      {scoredArena.length === 0 ? (
        <p className="mt-1 text-sm text-[var(--ws-mute)]">No scored rounds.</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-[var(--ws-ink)]">
            Latest <span className="font-bold">{latestArena?.score}/100</span>
            <span className="text-[var(--ws-mute)]"> · best {bestArena}/100</span>
          </p>
          <ExpandableList
            items={scoredArena}
            initial={0}
            keyOf={(s) => s.id}
            expandLabel={(total) => `Show all ${total} rounds`}
            renderItem={(s) => (
              <div className="rounded-xl border border-[var(--ws-line)] p-3 text-sm">
                <p className="font-medium text-[var(--ws-ink)]">
                  {s.type} · <span className="font-mono">{s.score}/100</span>
                  <span className="ml-2 font-mono text-[11px] text-[var(--ws-faint)]">{s.createdAt.slice(0, 10)}</span>
                </p>
                {s.feedback && <p className="mt-0.5 text-xs leading-relaxed text-[var(--ws-mute)]">{s.feedback.split("\n")[0]}</p>}
              </div>
            )}
          />
        </>
      )}
    </Card>
  );
}

export function HistoryCard({ history }: { history: ApplicationRecord[] }) {
  return (
    <Card className="st-card p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ws-faint)]">
        Application history · {history.length}
      </p>
      {history.length === 0 ? (
        <p className="mt-1 text-sm text-[var(--ws-mute)]">No other applications.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {history.slice(0, 8).map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-[var(--ws-ink)]">{h.job.title}</span>
              <span className="text-xs text-[var(--ws-mute)]">{h.job.company} · {h.appliedAt.slice(0, 10)}</span>
              <Badge tone={h.status === "SHORTLISTED" || h.status === "HIRED" ? "signal" : h.status === "APPLIED" ? "sky" : h.status === "REJECTED" ? "rose" : "neutral"}>{h.status}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
