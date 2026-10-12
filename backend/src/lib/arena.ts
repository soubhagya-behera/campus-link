/**
 * Interview Arena practice (RULE-BASED — no speech recognition, no transcription,
 * no LLM, no AI interviewer). Prompts are static curated content (not data);
 * sessions, answers, scores, and feedback are persisted records.
 *
 * Grading (gradeAnswer): 35 base + up to 30 substance + 15 quantification +
 * 10 reasoning language + 10 structure. Cap 100. A session score is the mean
 * of its answered prompts. Unanswered sessions have score null (in progress).
 */
export const ARENA_BANK_VERSION = "arena-bank-v1";

export interface ArenaPrompt {
  id: string;
  category: "Behavioral" | "Technical" | "Situational";
  prompt: string;
  hint: string;
}

export const ARENA_PROMPTS: ArenaPrompt[] = [
  {
    id: "arena-behavioral-1",
    category: "Behavioral",
    prompt: "Walk me through your strongest project — what broke, and what did you change?",
    hint: "Use STAR: Situation → Task → Action → Result with one number.",
  },
  {
    id: "arena-technical-1",
    category: "Technical",
    prompt: "Explain how React re-renders, and how you'd keep a 5k-row table fast.",
    hint: "Keys, memo, virtualization — name the tradeoff you chose.",
  },
  {
    id: "arena-situational-1",
    category: "Situational",
    prompt: "Your PM cuts scope 48h before demo day. What ships, what waits?",
    hint: "Show a decision framework, not just effort.",
  },
];

export interface GradedAnswer {
  promptId: string;
  score: number;
  notes: string[];
}

export const ARENA_METHOD =
  "Rule-based answer scoring (arena-bank-v1): substance 30, quantification 15, " +
  "reasoning language 10, structure 10, on a 35 base; session score is the mean " +
  "of answered prompts. Practice only — not an assessment of hiring readiness.";

export function gradeAnswer(text: string): { score: number; notes: string[] } {
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

export function promptIdsValid(ids: string[]): boolean {
  const known = new Set(ARENA_PROMPTS.map((p) => p.id));
  return ids.length > 0 && ids.length <= 5 && ids.every((id) => known.has(id));
}

/** Staff-managed categories — the same three the static bank always used. */
export const ARENA_CATEGORIES = ["Behavioral", "Technical", "Situational"] as const;

/**
 * Prompt ids valid for a new session: the static bank plus every active
 * database question. Static ids stay accepted so existing history keeps
 * working after staff edits or deactivations.
 */
export function promptIdsValidWith(ids: string[], managedIds: string[]): boolean {
  const known = new Set([...ARENA_PROMPTS.map((p) => p.id), ...managedIds]);
  return ids.length > 0 && ids.length <= 5 && ids.every((id) => known.has(id));
}

/**
 * Practice points, derived server-side from the graded score — never accepted
 * from the client. floor(score/10) on 0–100, so a perfect round earns 10.
 * Documented here so the UI, tests and staff screens can never disagree.
 */
export function pointsForScore(score: number): number {
  if (!Number.isFinite(score) || score <= 0) return 0;
  return Math.max(0, Math.min(10, Math.floor(score / 10)));
}
