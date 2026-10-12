import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Award,
  Banknote,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  MapPin,
  Plus,
  Sparkles,
} from "lucide-react";
import { Badge, Card, Meter } from "../components/ui";
import { cn } from "../lib/cn";
import type { ApplicationRecord, JobMatch, MatchFactor } from "../lib/server";

const TYPE_LABEL: Record<string, string> = {
  INTERNSHIP: "Internship",
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
};

/**
 * Whether a "met" factor is backed by linked project evidence. The API
 * signals this only inside the factor prose ("Backed by N linked …" vs
 * "no linked project evidence yet"), so this checks the documented prefix
 * rather than guessing. Proposed separately: an `evidenced` boolean on met
 * requirements, so the UI never parses display strings.
 */
function isDemonstrated(f: MatchFactor): boolean {
  return f.kind === "met" && f.detail.startsWith("Backed by");
}

function skillOf(label: string): string {
  return label.split("·")[0]?.trim() || label;
}

function needsOf(label: string): string | null {
  const i = label.indexOf("needs ");
  return i >= 0 ? label.slice(i + "needs ".length).trim() : null;
}

function levelOf(label: string): string | null {
  const parts = label.split("·").map((s) => s.trim());
  const level = parts[1] ?? "";
  return /^[A-Z]+$/.test(level) ? level : null;
}

interface JobCardProps {
  match: JobMatch;
  /** The student's application for this job, if any row exists. Status is
   *  authoritative: only APPLIED/SHORTLISTED count as active. Terminal states
   *  (WITHDRAWN/REJECTED/HIRED) must never render as "Applied". */
  application?: ApplicationRecord | null;
  applying: boolean;
  flash: "ok" | "dup" | "closed" | null;
  onApply: (jobId: string) => void;
}

/**
 * One opportunity, in the order a student actually asks questions: what is
 * it, who offers it, what are the terms, what do they expect, how do I fit,
 * what's missing, what next. Only fields the API returns are shown — no
 * work-mode, experience-year or eligibility rows are invented.
 */
export default function JobCard({ match: m, application, applying, flash, onApply }: JobCardProps) {
  const [open, setOpen] = useState(false);
  const [live, setLive] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setLive(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const job = m.job;
  const status = application?.status ?? null;
  const isActive = status === "APPLIED" || status === "SHORTLISTED";

  const met = m.factors.filter((f) => f.kind === "met");
  const bonuses = m.factors.filter((f) => f.kind === "bonus");
  const gaps = m.factors.filter((f) => f.kind === "gap");

  const meta: { icon: typeof MapPin; label: string; value: string }[] = [
    ...(job.location ? [{ icon: MapPin, label: "Location", value: job.location }] : []),
    { icon: Briefcase, label: "Employment type", value: TYPE_LABEL[job.type] ?? job.type },
    ...(job.salary ? [{ icon: Banknote, label: "Compensation", value: job.salary }] : []),
    ...(job.deadline
      ? [{ icon: CalendarClock, label: "Apply by", value: job.deadline.slice(0, 10) }]
      : []),
    ...(job.seniority ? [{ icon: Award, label: "Seniority", value: job.seniority }] : []),
  ];

  return (
    <Card className="rise sw-card">
      {/* 1–3 · what, who, terms */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-bold leading-snug text-[var(--ws-ink)]">
            {job.title}
          </h3>
          <p className="mt-0.5 text-sm text-[var(--ws-mute)]">
            {job.company}
            {job.location ? ` · ${job.location}` : ""}
          </p>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {meta.map((d) => (
              <div key={d.label} className="flex min-w-0 items-center gap-2 text-sm">
                <d.icon size={15} className="shrink-0 text-[var(--ws-faint)]" aria-hidden="true" />
                <dt className="sr-only">{d.label}</dt>
                <dd className="truncate text-[var(--ws-ink)]" title={`${d.label}: ${d.value}`}>
                  {d.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge tone={m.score >= 70 ? "signal" : m.score >= 40 ? "sky" : "amber"}>
            {m.score}% match
          </Badge>
          <div className="w-28">
            <Meter value={live ? m.score : 0} tone={m.score >= 70 ? "signal" : "sky"} />
          </div>
        </div>
      </div>

      {/* summary + actions */}
      <p className={cn("mt-3 max-w-3xl text-sm leading-relaxed text-[var(--ws-mute)]", !open && "line-clamp-2")}>
        {job.description}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isActive ? (
          <Link
            to="/applications"
            className="sw-link inline-flex items-center gap-1.5 rounded-lg border border-[var(--ws-forest)] bg-[var(--ws-lime-wash)] px-4 py-2 text-sm font-semibold text-[var(--ws-forest)]"
          >
            <CheckCircle2 size={14} /> Applied — track
          </Link>
        ) : status === "WITHDRAWN" ? (
          <>
            <span
              role="status"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-4 py-2 text-sm font-semibold text-[var(--ws-mute)]"
            >
              Withdrawn
            </span>
            <Link
              to="/applications"
              className="sw-link inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[var(--ws-line)] px-4 py-2 text-sm font-semibold text-[var(--ws-forest)]"
            >
              View in tracker <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </>
        ) : status ? (
          <>
            <span
              role="status"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-4 py-2 text-sm font-semibold text-[var(--ws-mute)]"
            >
              {status === "HIRED" ? "Hired" : status === "REJECTED" ? "Not shortlisted" : status}
            </span>
            <Link
              to="/applications"
              className="sw-link inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[var(--ws-line)] px-4 py-2 text-sm font-semibold text-[var(--ws-forest)]"
            >
              View in tracker <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </>
        ) : (
          <button
            onClick={() => onApply(job.id)}
            disabled={applying}
            className="sw-btn inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-signal-400 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-signal-300 disabled:opacity-50"
          >
            <Plus size={14} /> {applying ? "Applying…" : "Apply now"}
          </button>
        )}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="sw-btn-secondary inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-4 py-2 text-sm font-semibold text-[var(--ws-forest)]"
        >
          {open ? "Hide details" : "View details"}
          <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} aria-hidden="true" />
        </button>
      </div>

      {flash === "ok" && (
        <p className="mt-2 text-sm font-medium text-[var(--ws-forest)]" role="status">
          Application sent — find it in your tracker.
        </p>
      )}
      {flash === "dup" && (
        <p className="mt-2 text-sm font-medium text-[var(--ws-warn)]" role="status">
          Already applied — you&apos;re tracking this role.
        </p>
      )}
      {flash === "closed" && (
        <p className="mt-2 text-sm font-medium text-[var(--ws-warn)]" role="status">
          This posting is no longer open, so applications are closed.
        </p>
      )}

      {/* 4 · what the company expects (real fields only) */}
      {open && (
        <div className="mt-4 border-t border-[var(--ws-line)] pt-4">
          <h4 className="font-display text-base font-bold text-[var(--ws-ink)]">Job details</h4>
          <p className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-[var(--ws-ink)]">
            {job.description}
          </p>
          {m.job.required.length > 0 && (
            <>
              <h5 className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ws-faint)]">
                Required skills
              </h5>
              <ul className="mt-2 space-y-1.5">
                {m.job.required.map((r) => (
                  <li key={r.skill} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-[var(--ws-ink)]">{r.skill}</span>
                    <Badge tone="neutral">{r.minLevel}</Badge>
                  </li>
                ))}
              </ul>
            </>
          )}
          {m.job.niceToHave.length > 0 && (
            <>
              <h5 className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ws-faint)]">
                Preferred skills
              </h5>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {m.job.niceToHave.map((s) => (
                  <Badge key={s} tone={m.bonuses.includes(s) ? "signal" : "neutral"}>
                    {m.bonuses.includes(s) ? `✓ ${s} — you have this` : s}
                  </Badge>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 5–7 · your fit, gaps, next step */}
      <div className="mt-4 border-t border-[var(--ws-line)] pt-4">
        <h4 className="font-display text-base font-bold text-[var(--ws-ink)]">Your fit</h4>
        <div className="mt-2 grid gap-4 md:grid-cols-2">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ws-faint)]">
              Matches ({met.length + bonuses.length})
            </p>
            <ul className="mt-2 space-y-1.5">
              {met.map((f, i) => {
                const demonstrated = isDemonstrated(f);
                const level = levelOf(f.label);
                return (
                  <li key={`m${i}`} className="flex gap-2 text-sm">
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[var(--ws-forest)]" aria-hidden="true" />
                    <span>
                      <span className="font-medium text-[var(--ws-ink)]">
                        {skillOf(f.label)}
                        {level ? ` · ${level}` : ""}
                      </span>
                      <span className="block text-[var(--ws-mute)]">
                        {demonstrated ? "demonstrated in your project" : "recorded in your profile — not yet demonstrated"}
                      </span>
                    </span>
                  </li>
                );
              })}
              {bonuses.map((f, i) => (
                <li key={`b${i}`} className="flex gap-2 text-sm">
                  <Sparkles size={15} className="mt-0.5 shrink-0 text-[var(--ws-sky)]" aria-hidden="true" />
                  <span>
                    <span className="font-medium text-[var(--ws-ink)]">{skillOf(f.label)}</span>
                    <span className="block text-[var(--ws-mute)]">preferred skill — you have this</span>
                  </span>
                </li>
              ))}
              {met.length === 0 && bonuses.length === 0 && (
                <li className="text-sm text-[var(--ws-mute)]">No met requirements yet — a stretch role.</li>
              )}
            </ul>
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ws-faint)]">
              Skill gaps ({gaps.length})
            </p>
            <ul className="mt-2 space-y-1.5">
              {gaps.map((f, i) => {
                const needs = needsOf(f.label);
                return (
                  <li key={i} className="flex gap-2 text-sm">
                    <CircleAlert size={15} className="mt-0.5 shrink-0 text-[var(--ws-warn)]" aria-hidden="true" />
                    <span>
                      <span className="font-medium text-[var(--ws-ink)]">{skillOf(f.label)}</span>
                      <span className="block text-[var(--ws-mute)]">
                        not yet demonstrated{needs ? ` — needs ${needs}` : ""}
                      </span>
                    </span>
                  </li>
                );
              })}
              {gaps.length === 0 && (
                <li className="text-sm text-[var(--ws-mute)]">No gaps — strong fit on stated requirements.</li>
              )}
            </ul>
          </div>
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--ws-ink)]">
          <span className="font-semibold text-[var(--ws-forest)]">Next step:</span> {m.nextStep}{" "}
          <Link
            to="/sprint"
            className="sw-link inline-flex items-center gap-0.5 font-medium text-[var(--ws-forest)] hover:underline"
          >
            open sprints <ArrowRight size={12} aria-hidden="true" />
          </Link>
        </p>
      </div>
    </Card>
  );
}
