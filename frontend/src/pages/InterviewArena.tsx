import { Mic, RotateCcw, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Card, DemoTag, Empty, SectionTitle } from "../components/ui";
import { cn } from "../lib/cn";

/** Practice content (not data): fixed starter prompts. Rounds are not persisted. */
const ARENA_PROMPTS = [
  {
    id: "arena-1",
    category: "Behavioral",
    prompt: "Walk me through your strongest project — what broke, and what did you change?",
    hint: "Use STAR: Situation → Task → Action → Result with one number.",
  },
  {
    id: "arena-2",
    category: "Technical",
    prompt: "Explain how React re-renders, and how you'd keep a 5k-row table fast.",
    hint: "Keys, memo, virtualization — name the tradeoff you chose.",
  },
  {
    id: "arena-3",
    category: "Situational",
    prompt: "Your PM cuts scope 48h before demo day. What ships, what waits?",
    hint: "Show a decision framework, not just effort.",
  },
];

function scoreAnswer(text: string): { score: number; notes: string[] } {
  const notes: string[] = [];
  let score = 35;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words >= 80) {
    score += 30;
    notes.push("Substantive answer with real detail (+30).");
  } else if (words >= 40) {
    score += 18;
    notes.push("Decent length — push past 80 words for full credit (+18).");
  } else {
    notes.push("Too short — interviewers read brevity as vagueness. Aim 60–90 seconds spoken.");
  }
  if (/\d/.test(text)) {
    score += 15;
    notes.push("You used a number — quantified impact lands (+15).");
  } else {
    notes.push("Add one metric (users, %, latency, revenue) to sound hired.");
  }
  if (/because|therefore|tradeoff|however|instead/i.test(text)) {
    score += 10;
    notes.push("Reasoning language detected — you explained judgment (+10).");
  }
  if (/star|situation|task|action|result/i.test(text)) {
    score += 10;
    notes.push("Structured like STAR — easy to follow (+10).");
  }
  return { score: Math.min(100, score), notes };
}

export default function InterviewArena() {
  const [activeId, setActiveId] = useState(ARENA_PROMPTS[0].id);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<{ score: number; notes: string[] } | null>(null);
  const [rounds, setRounds] = useState(0);

  const prompt = useMemo(() => ARENA_PROMPTS.find((p) => p.id === activeId) ?? ARENA_PROMPTS[0], [activeId]);

  const submit = () => {
    if (answer.trim().split(/\s+/).length < 10) return;
    setResult(scoreAnswer(answer));
    setRounds((r) => r + 1);
  };

  return (
    <div>
      <SectionTitle
        kicker="Interview Arena"
        title="Reps, not tips"
        sub="Starter practice with transparent rule-based scoring (length, quantification, reasoning, structure) — not an AI interviewer, and rounds are practice-only, not persisted."
        right={<DemoTag />}
      />

      <div className="flex flex-wrap items-center gap-2">
        {ARENA_PROMPTS.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setActiveId(p.id);
              setAnswer("");
              setResult(null);
            }}
            className={cn(
              "rounded-full border px-3.5 py-2 text-sm font-medium",
              p.id === activeId
                ? "border-signal-500/50 bg-signal-400/10 text-signal-200"
                : "border-white/10 text-slate-400 hover:text-white",
            )}
          >
            {p.category}
          </button>
        ))}
        <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
          <Mic size={12} /> {rounds} round{rounds === 1 ? "" : "s"} completed
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="rise">
          <Badge tone="sky">{prompt.category}</Badge>
          <p className="font-display mt-3 text-xl font-bold leading-snug text-white">“{prompt.prompt}”</p>
          <p className="mt-2 text-sm text-slate-400">Coach hint: {prompt.hint}</p>
          <textarea
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value);
              setResult(null);
            }}
            rows={9}
            placeholder="Type your answer as you'd speak it — 60 to 90 seconds…"
            className="mt-4 w-full rounded-xl border border-white/10 bg-ink-800 p-3 text-sm leading-relaxed text-white placeholder:text-slate-600"
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={submit}
              disabled={answer.trim().split(/\s+/).length < 10}
              className="inline-flex items-center gap-2 rounded-lg bg-signal-400 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-signal-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={14} /> Get feedback
            </button>
            <button
              onClick={() => {
                setAnswer("");
                setResult(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-400 hover:text-white"
            >
              <RotateCcw size={13} /> Reset
            </button>
          </div>
        </Card>

        <div>
          {!result ? (
            <Empty
              title="Your coach is waiting"
              body="Submit an answer and it gets scored on substance, quantification, reasoning, and structure — the four things panels actually grade."
            />
          ) : (
            <Card className="rise">
              <div className="flex items-center justify-between">
                <p className="font-display text-3xl font-bold text-white">
                  {result.score}
                  <span className="text-base text-slate-500">/100</span>
                </p>
                <Badge tone={result.score >= 75 ? "signal" : result.score >= 55 ? "sky" : "amber"}>
                  {result.score >= 75 ? "Offer-grade" : result.score >= 55 ? "Panel-ready" : "Needs reps"}
                </Badge>
              </div>
              <ul className="mt-3 space-y-2">
                {result.notes.map((n, i) => (
                  <li key={i} className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5 text-sm text-slate-300">
                    {n}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
