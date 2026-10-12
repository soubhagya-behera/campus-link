import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Mic, RotateCcw, Send } from "lucide-react";
import { useState } from "react";
import { Badge, Card, DemoTag, Empty, ErrorState, Loading, NoStudentState, SectionTitle } from "../components/ui";
import "../components/student.css";
import { cn } from "../lib/cn";
import { ApiError } from "../lib/server";
import {
  createArenaSession,
  submitArenaAnswers,
  type ArenaSession,
} from "../lib/arena";
import { useArenaPrompts, useArenaSessions, useProfileId, useSessionUser } from "../store/session";

/** Server session types per prompt category (backend enum HR/TECHNICAL/MANAGERIAL/MOCK). */
const TYPE_FOR_CATEGORY: Record<string, string> = {
  Behavioral: "HR",
  Technical: "TECHNICAL",
  Situational: "MOCK",
};

interface Transcript {
  promptIds?: unknown;
  answers?: { promptId?: unknown; text?: unknown }[];
}

/** Prompt ids planned by a session; [] when the transcript is unreadable. */
function sessionPromptIds(s: ArenaSession): string[] {
  try {
    const t = JSON.parse(s.transcript ?? "{}") as Transcript;
    return Array.isArray(t.promptIds) ? t.promptIds.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Last saved answer text for a prompt, so a returning round starts where it left off. */
function savedAnswer(s: ArenaSession | undefined): string {
  if (!s) return "";
  try {
    const t = JSON.parse(s.transcript ?? "{}") as Transcript;
    const first = Array.isArray(t.answers) ? t.answers[0] : undefined;
    return typeof first?.text === "string" ? first.text : "";
  } catch {
    return "";
  }
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Interview Arena — reps with persisted, server-graded rounds.
 *
 * Prompts come from GET /api/arena/prompts; every submission creates a
 * practice session and posts the answer for rule-based grading, so rounds
 * and feedback survive refresh via GET /api/arena/sessions. No local
 * scoring: the numbers shown are always the server's.
 */
export default function InterviewArena() {
  const user = useSessionUser();
  const profileId = useProfileId();
  const prompts = useArenaPrompts();
  const history = useArenaSessions();
  const qc = useQueryClient();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [earned, setEarned] = useState<{ points: number; total: number } | null>(null);

  // Unconditional: hooks must run in the same order on every render, so the
  // mutation lives above the loading/error/empty early returns below.
  const submit = useMutation({
    mutationFn: async (input: { promptId: string; category: string; text: string }) => {
      if (!profileId) throw new Error("No student profile linked to this account.");
      // Reuse an in-progress session only when a previous submit created one
      // but grading failed; otherwise each round gets a fresh persisted row.
      let sid = sessionId;
      if (!sid) {
        const created = await createArenaSession({
          studentProfileId: profileId,
          type: TYPE_FOR_CATEGORY[input.category] ?? "MOCK",
          promptIds: [input.promptId],
        });
        sid = created.id;
        setSessionId(sid);
      }
      return submitArenaAnswers(sid, [{ promptId: input.promptId, text: input.text }]);
    },
    onSuccess: (r) => {
      setError(null);
      setSessionId(null);
      // Points come from the server response only — never computed locally.
      setEarned({ points: r.pointsEarned, total: r.totalPoints });
      void qc.invalidateQueries({ queryKey: ["arena-sessions"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Submission failed"),
  });

  if (user && !user.studentProfileId) {
    return <NoStudentState kicker="Interview Arena" title="Reps, not tips" />;
  }

  if (prompts.isPending || history.isPending) {
    return (
      <div>
        <SectionTitle kicker="Interview Arena" title="Reps, not tips" right={<DemoTag />} />
        <Loading label="Loading prompts and your persisted rounds…" />
      </div>
    );
  }
  if (prompts.isError) {
    return (
      <div>
        <SectionTitle kicker="Interview Arena" title="Reps, not tips" right={<DemoTag />} />
        <ErrorState
          message={prompts.error instanceof Error ? prompts.error.message : "Prompts failed to load"}
          onRetry={() => void qc.invalidateQueries({ queryKey: ["arena-prompts"] })}
        />
      </div>
    );
  }

  const bank = prompts.data?.data ?? [];
  const method = prompts.data?.method ?? "";
  const sessions = history.data?.data ?? [];
  if (bank.length === 0) {
    return (
      <div>
        <SectionTitle kicker="Interview Arena" title="Reps, not tips" right={<DemoTag />} />
        <Empty title="No practice prompts" body="The prompt bank is empty right now. Try again later." />
      </div>
    );
  }

  const active = bank.find((p) => p.id === activeId) ?? bank[0];
  const rounds = sessions.filter((s) => s.score !== null).length;
  const prior = sessions.filter((s) => sessionPromptIds(s).includes(active.id));
  const latest = prior.find((s) => s.score !== null);

  /**
   * Submitted lock: the textarea currently holds the exact text the server
   * already graded for this prompt, so there is nothing new to submit.
   * Derived from persisted history (not local flags), so refresh keeps the
   * lock and repeat clicks cannot mint duplicate rounds. Only the explicit
   * "Practice another answer" action below lifts it.
   */
  const submitted =
    latest?.score != null && answer.trim() !== "" && savedAnswer(latest) === answer.trim();

  /**
   * Distinct draft actions (they must never behave identically):
   * - resetDraft: discard the current UNsubmitted draft text and transient
   *   error state. Never touches persisted sessions or the saved result.
   *   Disabled while submitted, so it can never unlock a graded answer.
   * - newRound: explicit start of a fresh attempt (clears the graded text and
   *   unlocks the input). Creates no server session until the next submit.
   */
  const resetDraft = () => {
    setAnswer("");
    setSessionId(null);
    setError(null);
    setEarned(null);
  };

  const newRound = () => {
    setAnswer("");
    setSessionId(null);
    setError(null);
    setEarned(null);
  };

  const select = (id: string) => {
    // Re-clicking the active tab must be a no-op: refilling the saved answer
    // here is what made Reset look like it "restored" the submitted state.
    if (id === activeId) {
      setError(null);
      return;
    }
    setActiveId(id);
    setError(null);
    setSessionId(null);
    setEarned(null);
    const last = sessions.find((s) => sessionPromptIds(s).includes(id));
    setAnswer(savedAnswer(last));
  };

  const trySubmit = () => {
    if (submitted || submit.isPending) return;
    setError(null);
    if (wordCount(answer) < 10) {
      setError("Write at least 10 words — short answers cannot be graded fairly.");
      return;
    }
    submit.mutate({ promptId: active.id, category: active.category, text: answer.trim() });
  };

  const feedback = (latest?.feedback ?? "").split("\n").filter(Boolean);

  return (
    <div className="sw sw-enter">
      <SectionTitle
        kicker="Interview Arena"
        title="Reps, not tips"
        sub="Starter practice graded by the server's transparent rule-based rubric — not an AI interviewer. Every submitted round is persisted and survives refresh."
        right={<DemoTag />}
      />

      <div className="flex flex-wrap items-center gap-2">
        {bank.map((p) => (
          <button
            key={p.id}
            onClick={() => select(p.id)}
            className={cn(
              "sw-tab rounded-full border px-3.5 py-2 text-sm font-medium",
              p.id === active.id
                ? "border-signal-500/50 bg-signal-400/10 text-signal-200"
                : "border-white/10 text-slate-400 hover:text-white",
            )}
          >
            {p.category}
          </button>
        ))}
        <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
          <Mic size={12} /> {rounds} persisted round{rounds === 1 ? "" : "s"} · {history.data?.totalPoints ?? 0} pts
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="rise sw-card">
          <Badge tone="sky">{active.category}</Badge>
          <p className="font-display mt-3 text-xl font-bold leading-snug text-white">“{active.prompt}”</p>
          <p className="mt-2 text-sm text-slate-400">Coach hint: {active.hint}</p>
          <textarea
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value);
              if (error) setError(null);
            }}
            rows={9}
            readOnly={submitted}
            placeholder="Type your answer as you'd speak it — 60 to 90 seconds…"
            aria-describedby="arena-answer-help"
            className="sw-textarea mt-4 w-full rounded-xl border border-white/10 bg-ink-800 p-3 text-sm leading-relaxed text-white placeholder:text-slate-600"
          />
          <p id="arena-answer-help" className="mt-1.5 text-xs leading-relaxed text-slate-500">
            Minimum 10 words to submit · aim for 60–90 seconds spoken (≈130–200 words) for full
            substance credit. Submitted answers lock — Reset only discards an unsubmitted draft,
            Practice another answer starts a fresh attempt.
          </p>
          {error ? (
            <p role="alert" className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/10 p-2.5 text-sm text-amber-200">
              {error}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {submitted ? (
              <>
                <span
                  role="status"
                  className="inline-flex items-center gap-2 rounded-lg border border-signal-500/40 bg-signal-400/10 px-4 py-2 text-sm font-semibold text-signal-300"
                >
                  <CheckCircle2 size={14} /> Submitted — score saved below
                </span>
                <button
                  onClick={newRound}
                  disabled={submit.isPending}
                  title="Clear this answer and start a fresh attempt (no session is created until you submit)"
                  className="sw-btn inline-flex items-center gap-1.5 rounded-lg bg-signal-400 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-signal-300 disabled:opacity-50"
                >
                  <Send size={14} /> Practice another answer
                </button>
              </>
            ) : (
              <button
                onClick={trySubmit}
                disabled={submit.isPending || wordCount(answer) < 10}
                className="sw-btn inline-flex items-center gap-2 rounded-lg bg-signal-400 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-signal-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send size={14} /> {submit.isPending ? "Grading…" : "Get feedback"}
              </button>
            )}
            <button
              onClick={resetDraft}
              disabled={submit.isPending || submitted}
              title={
                submitted
                  ? "This answer is already submitted — use Practice another answer for a new attempt"
                  : "Discard the current draft (saved rounds are kept)"
              }
              className="sw-btn-secondary inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-400 hover:text-white disabled:opacity-50"
            >
              <RotateCcw size={13} /> Reset
            </button>
          </div>
          {method ? <p className="mt-3 text-xs leading-relaxed text-slate-500">{method.slice(0, 240)}</p> : null}
        </Card>

        <div>
          {!latest ? (
            <Empty
              title={history.isFetching ? "Loading your rounds…" : "Your coach is waiting"}
              body="Submit an answer and the server scores it on substance, quantification, reasoning, and structure — the four things panels actually grade. Scored rounds stay on record."
            />
          ) : (
            <Card className="rise sw-card">
              <div className="flex items-center justify-between">
                <p className="font-display text-3xl font-bold text-white">
                  {latest.score}
                  <span className="text-base text-slate-500">/100</span>
                </p>
                <Badge tone={(latest.score ?? 0) >= 75 ? "signal" : (latest.score ?? 0) >= 55 ? "sky" : "amber"}>
                  {(latest.score ?? 0) >= 75 ? "Offer-grade" : (latest.score ?? 0) >= 55 ? "Panel-ready" : "Needs reps"}
                </Badge>
              </div>
              <ul className="mt-3 space-y-2">
                {feedback.map((n, i) => (
                  <li key={i} className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5 text-sm text-slate-300">
                    {n}
                  </li>
                ))}
              </ul>
              <p className="mt-3 font-mono text-[11px] text-slate-500">
                Persisted round · {latest.createdAt.slice(0, 10)}
                {prior.length > 1 ? ` · ${prior.length} rounds on this prompt` : ""}
                {earned ? ` · +${earned.points} pts earned (${earned.total} total)` : ""}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
