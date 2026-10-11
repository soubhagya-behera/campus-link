/**
 * Transparent sprint grading rubric (RULE-BASED — this is not AI assessment).
 *
 * - 40 base + 25 all checklist tasks done (client attests; reviewer verifies link)
 * - +15 verifiable repo/deployed link present
 * - +15 write-up >= 40 words / +8 for >= 15 words (must explain a decision)
 * - +5 names quality attributes (tests, a11y/aria, perf, index, tradeoff)
 * Cap 100. Promotion threshold: 70.
 */
export interface RubricResult {
  score: number;
  feedback: string[];
}

export const RUBRIC_VERSION = "rubric-v1";

export const RUBRIC_DESCRIPTION =
  "Rule-based rubric (no AI): completion 25, verifiable link 15, write-up depth 15, " +
  "quality-attribute mention 5, on a 40 base. 70+ promotes the rewarded skill one level " +
  "and records the submission as a linked project (evidence).";

export const PROMOTION_THRESHOLD = 70;

export function gradeSubmission(
  repoUrl: string,
  note: string,
  tasksDone: number,
  taskCount: number,
): RubricResult {
  const feedback: string[] = [];
  let score = 40;

  if (tasksDone >= taskCount && taskCount > 0) {
    score += 25;
    feedback.push("All build tasks checked — full marks for follow-through.");
  } else {
    const left = Math.max(0, taskCount - tasksDone);
    feedback.push(
      `${left} task${left === 1 ? "" : "s"} left unchecked — reviewers notice unfinished checklists.`,
    );
  }

  if (/^(https?:\/\/)/i.test(repoUrl.trim()) && repoUrl.trim().length > 12) {
    score += 15;
    feedback.push("Working link submitted — evidence is verifiable.");
  } else {
    feedback.push("Add a real repo or deployed link so this counts as evidence.");
  }

  const words = note.trim().split(/\s+/).filter(Boolean).length;
  if (words >= 40) {
    score += 15;
    feedback.push("Strong write-up: you explained the *why*, not just the what.");
  } else if (words >= 15) {
    score += 8;
    feedback.push("Decent notes — push to 40+ words on tradeoffs for full credit.");
  } else {
    feedback.push("Write-up too thin — 2–3 sentences on your hardest decision minimum.");
  }

  if (/test|accessib|aria|explain|index|perf|tradeoff/i.test(note)) {
    score += 5;
    feedback.push("Bonus: you named quality attributes (tests, a11y, perf) explicitly.");
  }

  return { score: Math.min(100, score), feedback };
}
