import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, Circle, Clock3, Send, Trophy } from "lucide-react";
import { useState } from "react";
import { Badge, Card, DemoTag, Empty, ErrorState, Loading, Meter, NoStudentState, SectionTitle } from "../components/ui";
import "../components/student.css";
import SprintResult from "./SprintResult";
import { challengeContent } from "../data/challenges";
import { cn } from "../lib/cn";
import { ApiError, api } from "../lib/server";
import { useAssessments, useAttempts, useProfileId, useSessionUser } from "../store/session";

/**
 * Short display titles, presentation only. Canonical ids, rewarded skills,
 * descriptions, checklists and durations always come from the API and the
 * challenge map — never edited here, never sent anywhere.
 */
const DISPLAY_TITLE: Record<string, string> = {
  "demo-assess-react-a11y": "Accessible data table",
  "demo-assess-sql-ledger": "SQL performance challenge",
  "demo-assess-viz-pack": "Data storytelling",
};

function displayTitle(id: string, full: string): string {
  return DISPLAY_TITLE[id] ?? full;
}

function summaryOf(description: string | null, max = 120): string {
  if (!description) return "";
  return description.length > max ? `${description.slice(0, max).trimEnd()}…` : description;
}

function isHttpUrl(value: string): boolean {
  return /^(https?:\/\/)/i.test(value.trim()) && value.trim().length > 12;
}

export default function SkillSprint() {
  const profileId = useProfileId();
  const user = useSessionUser();
  const assessments = useAssessments();
  const attempts = useAttempts();
  const qc = useQueryClient();

  const list = assessments.data?.data ?? [];
  const [activeId, setActiveId] = useState<string | null>(null);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [repoUrl, setRepoUrl] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    assessmentId: string;
    score: number;
    feedback: string[];
    promotedTo: string | null;
  } | null>(null);
  // Drafts intentionally do not survive refresh (no draft API): only the
  // persisted result is restored. The form opens explicitly via "Submit
  // another attempt", never by default over a saved result.
  const [formOpen, setFormOpen] = useState(false);

  const active = list.find((a) => a.id === (activeId ?? list[0]?.id)) ?? list[0];
  const content = active ? challengeContent(active.id) : { tasks: [], estimatedMins: 60 };
  const myAttempts = (attempts.data?.data ?? []).filter((a) => a.assessmentId === active?.id);

  const select = (id: string) => {
    setActiveId(id);
    setChecked(challengeContent(id).tasks.map(() => false));
    setRepoUrl("");
    setNote("");
    setError(null);
    setLastResult(null);
    setFormOpen(false);
  };

  const submit = useMutation({
    mutationFn: () =>
      api.submitAttempt({
        assessmentId: active.id,
        studentProfileId: profileId as string,
        repoUrl: repoUrl.trim(),
        note: note.trim(),
        tasksDone: checked.filter(Boolean).length,
        taskCount: content.tasks.length,
      }),
    onSuccess: (r) => {
      setLastResult({
        assessmentId: active.id,
        score: r.attempt.score ?? 0,
        feedback: (r.attempt.feedback ?? "").split("\n").filter(Boolean),
        promotedTo: r.promotedTo,
      });
      setFormOpen(false);
      setError(null);
      void qc.invalidateQueries({ queryKey: ["attempts"] });
      void qc.invalidateQueries({ queryKey: ["profile"] });
      void qc.invalidateQueries({ queryKey: ["readiness"] });
      void qc.invalidateQueries({ queryKey: ["matches"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Submission failed"),
  });

  if (user && !user.studentProfileId) {
    return <NoStudentState kicker="Skill Sprint" title="Build skills. Show your work." />;
  }

  if (assessments.isPending || attempts.isPending) {
    return (
      <div>
        <SectionTitle kicker="Skill Sprint" title="Build skills. Show your work." right={<DemoTag />} />
        <Loading label="Loading challenges and your attempts…" />
      </div>
    );
  }
  if (assessments.isError) {
    return (
      <div>
        <SectionTitle kicker="Skill Sprint" title="Build skills. Show your work." right={<DemoTag />} />
        <ErrorState
          message={assessments.error instanceof Error ? assessments.error.message : "Challenges failed to load"}
          onRetry={() => void qc.invalidateQueries({ queryKey: ["assessments"] })}
        />
      </div>
    );
  }
  if (!active) {
    return (
      <div>
        <SectionTitle kicker="Skill Sprint" title="Build skills. Show your work." right={<DemoTag />} />
        <Empty
          title="No challenges published"
          body="New challenges appear here as soon as they are published."
        />
      </div>
    );
  }

  const done = checked.filter(Boolean).length;
  const best = myAttempts.reduce((m, a) => Math.max(m, a.score ?? 0), 0);
  // Latest persisted result for this challenge (attempts arrive newest-first).
  // This is what survives refresh; drafts never do.
  const latestScored = myAttempts.find((a) => a.score != null) ?? null;
  const fresh = lastResult && lastResult.assessmentId === active.id ? lastResult : null;
  const openForm = () => {
    setFormOpen(true);
    setLastResult(null);
    setError(null);
  };
  const showForm = formOpen || (!fresh && !latestScored);

  const trySubmit = () => {
    setError(null);
    if (content.tasks.length > 0 && done < content.tasks.length) {
      setError("Check all build tasks first — reviewers treat unchecked boxes as unfinished work.");
      return;
    }
    if (!isHttpUrl(repoUrl)) {
      setError("Add a repo or deployed link starting with http(s) so reviewers can verify it.");
      return;
    }
    if (note.trim().split(/\s+/).filter(Boolean).length < 10) {
      setError("Add at least a 10-word write-up so this counts as evidence.");
      return;
    }
    submit.mutate();
  };

  return (
    <div className="sw sw-enter">
      <SectionTitle
        kicker="Skill Sprint"
        title="Build skills. Show your work."
        sub="Pick a challenge, do the work, submit your link and write-up — the server grades it against a fixed rubric."
        right={<DemoTag />}
      />

      {/* 1 · choose */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="list">
        {list.map((s) => {
          const c = challengeContent(s.id);
          const mine = (attempts.data?.data ?? []).filter((a) => a.assessmentId === s.id);
          const top = mine.reduce((m, a) => Math.max(m, a.score ?? 0), 0);
          const selected = s.id === active.id;
          return (
            <button
              key={s.id}
              role="listitem"
              onClick={() => select(s.id)}
              aria-pressed={selected}
              aria-label={`View challenge: ${displayTitle(s.id, s.title)}`}
              className={cn(
                "sw-tab rounded-[14px] border p-4 text-left transition-colors",
                selected
                  ? "border-[var(--ws-forest)] bg-[var(--ws-surface)] shadow-[0_1px_2px_rgb(32_40_34/0.04),0_2px_8px_-4px_rgb(32_40_34/0.08)]"
                  : "border-[var(--ws-line)] bg-[var(--ws-surface)] hover:border-[var(--ws-forest)]",
              )}
            >
              <span className="flex flex-wrap items-center gap-2">
                <Badge tone={selected ? "signal" : "neutral"}>rewards {s.rewardSkill}</Badge>
                {mine.length > 0 && (
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--ws-forest)]">
                    <Trophy size={12} aria-hidden="true" /> best {top}
                  </span>
                )}
              </span>
              <span className="font-display mt-2 block text-base font-bold leading-snug text-[var(--ws-ink)]">
                {displayTitle(s.id, s.title)}
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-[var(--ws-mute)]">
                {summaryOf(s.description)}
              </span>
              <span className="mt-2 flex items-center gap-3 font-mono text-[11px] text-[var(--ws-faint)]">
                <span className="inline-flex items-center gap-1">
                  <Clock3 size={12} aria-hidden="true" /> ~{c.estimatedMins} min
                </span>
                <span>{c.tasks.length} steps</span>
                <span className="ml-auto font-semibold text-[var(--ws-forest)]">
                  {selected ? "Selected" : "View challenge"}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* 2–3 · read + do */}
      <Card className="rise mt-4 sw-card">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="signal">rewards {active.rewardSkill}</Badge>
          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--ws-faint)]">
            <Clock3 size={12} aria-hidden="true" /> ~{content.estimatedMins} min
          </span>
          {best > 0 && (
            <span className="font-mono text-[11px] text-[var(--ws-forest)]">your best: {best}/100</span>
          )}
        </div>
        <h2 className="font-display mt-2 text-xl font-bold text-[var(--ws-ink)]">
          {displayTitle(active.id, active.title)}
        </h2>
        {active.description && (
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[var(--ws-mute)]">{active.description}</p>
        )}

        <p className="font-mono mt-4 text-[11px] uppercase tracking-[0.18em] text-[var(--ws-faint)]">
          Build checklist · {done}/{content.tasks.length} (self-attested)
        </p>
        <div className="mt-2 max-w-xl">
          <Meter value={content.tasks.length ? (done / content.tasks.length) * 100 : 0} />
        </div>
        <ul className="mt-2 space-y-2">
          {content.tasks.map((t, i) => {
            const isChecked = checked[i] ?? false;
            return (
              <li key={i}>
                <button
                  onClick={() => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))}
                  aria-pressed={isChecked}
                  className={cn(
                    "sw-check flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                    isChecked
                      ? "border-[var(--ws-forest)] bg-[var(--ws-lime-wash)]"
                      : "border-[var(--ws-line)] bg-[var(--ws-surface)]",
                  )}
                >
                  {isChecked ? (
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[var(--ws-forest)]" aria-hidden="true" />
                  ) : (
                    <Circle size={18} className="mt-0.5 shrink-0 text-[var(--ws-faint)]" aria-hidden="true" />
                  )}
                  <span>
                    <span className="block text-sm font-medium text-[var(--ws-ink)]">{t.title}</span>
                    <span className="block text-xs leading-relaxed text-[var(--ws-mute)]">{t.detail}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <details className="mt-3 rounded-xl border border-[var(--ws-line)] p-3">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--ws-forest)]">
            How scoring works
          </summary>
          <p className="mt-2 text-sm leading-relaxed text-[var(--ws-mute)]">
            {(assessments.data?.rubric ?? "").slice(0, 240)} Reaching the threshold promotes the
            rewarded skill one level and records your submission as project evidence. Rule-based
            grading only — not AI assessment, not independent verification.
          </p>
        </details>
      </Card>

      {/* 4–6 · submit + result */}
      <Card className="rise mt-4 sw-card">
        {showForm ? (
          <div>
            <h3 className="font-display text-base font-bold text-[var(--ws-ink)]">Submit your work</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block text-sm font-medium text-[var(--ws-ink)]">
                Repo / deployed link
                <input
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/you/sprint-table"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  className="sw-input mt-1 min-h-[44px] w-full rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-3 py-2 text-sm text-[var(--ws-ink)]"
                />
              </label>
              <label className="block text-sm font-medium text-[var(--ws-ink)]">
                Write-up — hardest decision + tradeoff (min 10 words)
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="The trickiest call was… I chose X over Y because…"
                  className="sw-textarea mt-1 min-h-[44px] w-full rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-3 py-2 text-sm leading-relaxed text-[var(--ws-ink)]"
                />
              </label>
            </div>
            {error && (
              <p role="alert" className="mt-2 rounded-lg border border-[#e8c6bf] bg-[var(--ws-err-bg)] p-2.5 text-sm text-[var(--ws-err)]">
                {error}
              </p>
            )}
            <button
              onClick={trySubmit}
              disabled={submit.isPending}
              className="sw-btn mt-3 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-signal-400 px-4 py-2.5 text-sm font-semibold text-ink-950 hover:bg-signal-300 disabled:opacity-50"
            >
              <Send size={14} aria-hidden="true" /> {submit.isPending ? "Submitting…" : "Submit for review"}
            </button>
            <p className="mt-2 text-xs text-[var(--ws-faint)]">
              {myAttempts.length} saved attempt{myAttempts.length === 1 ? "" : "s"} for this challenge.
            </p>
          </div>
        ) : fresh ? (
          <div>
            <p className="inline-flex items-center gap-2 font-semibold text-[var(--ws-forest)]">
              <Trophy size={16} aria-hidden="true" /> Saved · {fresh.score}/100
            </p>
            <div className="mt-3 max-w-xl">
              <Meter value={fresh.score} />
            </div>
            <ul className="mt-3 space-y-2">
              {fresh.feedback.map((f, i) => (
                <li key={i} className="rounded-lg border border-[var(--ws-line)] p-2.5 text-sm leading-relaxed text-[var(--ws-ink)]">
                  {f}
                </li>
              ))}
            </ul>
            {fresh.promotedTo ? (
              <p className="mt-3 rounded-xl border border-[var(--ws-forest)] bg-[var(--ws-lime-wash)] p-3 text-sm leading-relaxed text-[var(--ws-ink)]">
                <span className="font-semibold text-[var(--ws-forest)]">
                  {active.rewardSkill} → {fresh.promotedTo}.{" "}
                </span>
                Evidence recorded as a project — Twin and Mirror already refreshed from the server.
              </p>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-[var(--ws-mute)]">
                Below the promotion bar — no skill change, but the attempt is on record.
              </p>
            )}
            <button
              onClick={openForm}
              className="sw-link mt-3 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-[var(--ws-forest)] hover:underline"
            >
              Submit another attempt <ChevronDown size={14} className="-rotate-90" aria-hidden="true" />
            </button>
          </div>
        ) : latestScored ? (
          <SprintResult
            score={latestScored.score ?? 0}
            feedback={(latestScored.feedback ?? "").split("\n").filter(Boolean)}
            submittedAt={latestScored.submittedAt}
            rewardSkill={latestScored.assessment?.rewardSkill ?? active.rewardSkill}
            onNewAttempt={openForm}
          />
        ) : null}
      </Card>
    </div>
  );
}
