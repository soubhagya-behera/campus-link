import { ChevronDown, Trophy } from "lucide-react";
import { Meter } from "../components/ui";

/**
 * A sprint result restored from persisted history (e.g. after refresh).
 * Score and feedback are the server's saved values. Promotion is never
 * claimed here: this snapshot does not carry the promotion outcome, so
 * above-threshold scores point at Career Twin where the recorded skill and
 * evidence live.
 */
export default function SprintResult({
  score,
  feedback,
  submittedAt,
  rewardSkill,
  onNewAttempt,
}: {
  score: number;
  feedback: string[];
  submittedAt: string | null;
  rewardSkill: string;
  onNewAttempt: () => void;
}) {
  const met = score >= 70;
  return (
    <div>
      <p className="inline-flex items-center gap-2 font-semibold text-[var(--ws-forest)]">
        <Trophy size={16} aria-hidden="true" /> Saved result · {score}/100
      </p>
      <div className="mt-3 max-w-xl">
        <Meter value={score} />
      </div>
      <ul className="mt-3 space-y-2">
        {feedback.map((f, i) => (
          <li key={i} className="rounded-lg border border-[var(--ws-line)] p-2.5 text-sm leading-relaxed text-[var(--ws-ink)]">
            {f}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm leading-relaxed text-[var(--ws-mute)]">
        {met ? (
          <>
            Above the 70 promotion bar{rewardSkill ? ` for ${rewardSkill}` : ""} — see Career Twin for
            the recorded skill and evidence.
          </>
        ) : (
          "Below the promotion bar — no skill change, but the attempt is on record."
        )}
        {submittedAt ? ` Submitted ${submittedAt.slice(0, 10)}.` : ""}
      </p>
      <button
        onClick={onNewAttempt}
        className="mt-3 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-[var(--ws-forest)] hover:underline"
      >
        Submit another attempt <ChevronDown size={14} className="-rotate-90" aria-hidden="true" />
      </button>
    </div>
  );
}
