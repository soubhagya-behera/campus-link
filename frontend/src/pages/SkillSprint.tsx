import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Clock3, Send, Trophy } from "lucide-react";
import { useState } from "react";
import { Badge, Card, DemoTag, Empty, ErrorState, Loading, Meter, SectionTitle } from "../components/ui";
import { challengeContent } from "../data/challenges";
import { cn } from "../lib/cn";
import { ApiError, api } from "../lib/server";
import { useAssessments, useAttempts, useProfileId } from "../store/session";

export default function SkillSprint() {
  const profileId = useProfileId();
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
    score: number;
    feedback: string[];
    promotedTo: string | null;
  } | null>(null);

  const active = list.find((a) => a.id === (activeId ?? list[0]?.id)) ?? list[0];
  const content = active ? challengeContent(active.id) : { tasks: [], estimatedMins: 60 };
  const myAttempts = (attempts.data?.data ?? []).filter((a) => a.assessmentId === active?.id);
  const submitted = myAttempts.length > 0;

  const select = (id: string) => {
    setActiveId(id);
    setChecked(challengeContent(id).tasks.map(() => false));
    setRepoUrl("");
    setNote("");
    setError(null);
    setLastResult(null);
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
        score: r.attempt.score ?? 0,
        feedback: (r.attempt.feedback ?? "").split("\n").filter(Boolean),
        promotedTo: r.promotedTo,
      });
      setError(null);
      void qc.invalidateQueries({ queryKey: ["attempts"] });
      void qc.invalidateQueries({ queryKey: ["profile"] });
      void qc.invalidateQueries({ queryKey: ["readiness"] });
      void qc.invalidateQueries({ queryKey: ["matches"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Submission failed"),
  });

  if (assessments.isPending || attempts.isPending) {
    return (
      <div>
        <SectionTitle kicker="Skill Sprint" title="Earn the skill, don't just claim it" right={<DemoTag />} />
        <Loading label="Loading challenges and your persisted attempts…" />
      </div>
    );
  }
  if (assessments.isError) {
    return (
      <div>
        <SectionTitle kicker="Skill Sprint" title="Earn the skill, don't just claim it" right={<DemoTag />} />
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
        <SectionTitle kicker="Skill Sprint" title="Earn the skill, don't just claim it" right={<DemoTag />} />
        <Empty
          title="No challenges published"
          body="Sprint challenges are seeded with the demo data or added by the placement cell. Run the backend seed to get the starter set."
        />
      </div>
    );
  }

  const done = checked.filter(Boolean).length;
  const best = myAttempts.reduce((m, a) => Math.max(m, a.score ?? 0), 0);

  return (
    <div>
      <SectionTitle
        kicker="Skill Sprint"
        title="Earn the skill, don't just claim it"
        sub="Submissions are persisted and graded by a public, rule-based rubric — never presented as AI assessment. A score of 70+ promotes the skill and records evidence."
        right={<DemoTag />}
      />

      <div className="flex flex-wrap gap-2">
        {list.map((s) => {
          const mine = (attempts.data?.data ?? []).filter((a) => a.assessmentId === s.id);
          const top = mine.reduce((m, a) => Math.max(m, a.score ?? 0), 0);
          return (
            <button
              key={s.id}
              onClick={() => select(s.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                s.id === active.id
                  ? "border-signal-500/50 bg-signal-400/10 text-signal-200"
                  : "border-white/10 text-slate-400 hover:border-white/20 hover:text-white",
              )}
            >
              {mine.length > 0 && <Trophy size={14} className="text-signal-400" />}
              {s.title}
              {mine.length > 0 && <span className="font-mono text-[11px] text-signal-300">{top}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="rise lg:col-span-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="signal">rewards {active.rewardSkill}</Badge>
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500">
              <Clock3 size={12} /> ~{content.estimatedMins} min
            </span>
            {best > 0 && (
              <span className="font-mono text-[11px] text-signal-300">your best: {best}/100</span>
            )}
          </div>
          <h2 className="font-display mt-2 text-xl font-bold text-white">{active.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-400">{active.description}</p>

          <p className="font-mono mt-5 text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Build checklist · {done}/{content.tasks.length} (self-attested — the link is what reviewers verify)
          </p>
          <div className="mt-2">
            <Meter value={content.tasks.length ? (done / content.tasks.length) * 100 : 0} />
          </div>
          <ul className="mt-3 space-y-2">
            {content.tasks.map((t, i) => {
              const isChecked = checked[i] ?? false;
              return (
                <li key={i}>
                  <button
                    onClick={() => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                      isChecked
                        ? "border-signal-500/30 bg-signal-400/[0.06]"
                        : "border-white/8 bg-white/[0.02] hover:border-white/20",
                    )}
                  >
                    {isChecked ? (
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-signal-400" />
                    ) : (
                      <Circle size={18} className="mt-0.5 shrink-0 text-slate-500" />
                    )}
                    <span>
                      <span
                        className={cn(
                          "block text-sm font-medium",
                          isChecked ? "text-slate-200 line-through decoration-slate-600" : "text-white",
                        )}
                      >
                        {t.title}
                      </span>
                      <span className="block text-xs text-slate-500">{t.detail}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="rise rise-1 lg:col-span-2">
          {lastResult ? (
            <div>
              <p className="inline-flex items-center gap-2 font-semibold text-signal-300">
                <Trophy size={16} /> Persisted · {lastResult.score}/100
              </p>
              <div className="mt-3">
                <Meter value={lastResult.score} />
              </div>
              <ul className="mt-3 space-y-2">
                {lastResult.feedback.map((f, i) => (
                  <li key={i} className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5 text-sm text-slate-300">
                    {f}
                  </li>
                ))}
              </ul>
              {lastResult.promotedTo ? (
                <p className="mt-3 rounded-xl border border-signal-500/25 bg-signal-400/[0.05] p-3 text-sm text-slate-300">
                  <span className="font-semibold text-signal-300">{active.rewardSkill} → {lastResult.promotedTo}. </span>
                  Evidence recorded as a project — Twin and Mirror already refreshed from the server.
                </p>
              ) : (
                <p className="mt-3 text-sm text-slate-400">
                  Below the 70 promotion bar — no skill change, but the attempt is on record. Iterate and
                  re-submit.
                </p>
              )}
              <button
                onClick={() => setLastResult(null)}
                className="mt-3 text-sm font-medium text-signal-300 hover:underline"
              >
                Submit another attempt
              </button>
            </div>
          ) : (
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
                Submit evidence
              </p>
              <label className="mt-3 block text-sm text-slate-300">
                Repo / deployed link
                <input
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/you/sprint-table"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white placeholder:text-slate-600"
                />
              </label>
              <label className="mt-3 block text-sm text-slate-300">
                Write-up — hardest decision + tradeoff (min 10 words)
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={5}
                  placeholder="The trickiest call was… I chose X over Y because…"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white placeholder:text-slate-600"
                />
              </label>
              {error && (
                <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/10 p-2.5 text-sm text-amber-200">
                  {error}
                </p>
              )}
              <button
                onClick={() => {
                  setError(null);
                  if (content.tasks.length > 0 && done < content.tasks.length) {
                    setError("Check all build tasks first — reviewers treat unchecked boxes as unfinished work.");
                    return;
                  }
                  if (repoUrl.trim().length < 8 || note.trim().split(/\s+/).filter(Boolean).length < 10) {
                    setError("Add a repo link and at least a 10-word write-up so this counts as evidence.");
                    return;
                  }
                  submit.mutate();
                }}
                disabled={submit.isPending}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-signal-400 px-3 py-2.5 text-sm font-semibold text-ink-950 hover:bg-signal-300 disabled:opacity-50"
              >
                <Send size={14} /> {submit.isPending ? "Saving…" : "Submit sprint for review"}
              </button>
              <p className="mt-2 text-xs text-slate-500">
                {(assessments.data?.rubric ?? "").slice(0, 220)}
              </p>
              {submitted && (
                <p className="mt-2 text-xs text-slate-500">
                  {myAttempts.length} persisted attempt{myAttempts.length > 1 ? "s" : ""} on record for this
                  challenge.
                </p>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
