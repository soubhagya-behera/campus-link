/**
 * Explainable opportunity matching.
 *
 * METHOD (documented limitation: this is a transparent rule-based heuristic,
 * not an AI prediction and not a hiring guarantee):
 * - Each required skill contributes weight = rank(minLevel) x 2 points.
 * - Met requirement: full weight + up to +1 for linked project evidence (max 2 items counted).
 * - One level below: 75% of the weight (partial credit). Worse: 0.
 * - Each nice-to-have at INTERMEDIATE+: +1 point (its weight is also 1 in the denominator).
 * - score = round(100 x points / max).
 * Inputs are persisted records only: StudentSkill levels + Project.skills evidence.
 */
export type SkillLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";

export const LEVEL_RANK: Record<SkillLevel, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
  EXPERT: 4,
};

const ORDER: SkillLevel[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"];

export function isLevel(v: unknown): v is SkillLevel {
  return typeof v === "string" && (ORDER as string[]).includes(v);
}

export function nextLevel(level: SkillLevel): SkillLevel | null {
  const i = ORDER.indexOf(level);
  return i < ORDER.length - 1 ? ORDER[i + 1] : null;
}

export interface Requirement {
  skill: string;
  minLevel: SkillLevel;
}

export interface SkillInput {
  skill: string;
  level: SkillLevel;
  /** project ids evidencing this skill */
  evidence: string[];
}

export interface MatchFactor {
  kind: "met" | "gap" | "bonus";
  label: string;
  detail: string;
}

export interface JobMatchResult {
  score: number;
  met: Requirement[];
  gaps: Requirement[];
  bonuses: string[];
  factors: MatchFactor[];
  nextStep: string;
  method: string;
}

export const MATCH_METHOD =
  "Rule-based: required skills weighted by seniority, partial credit one level below, " +
  "evidence bonus capped at +1 per skill, nice-to-haves +1. Not an AI prediction; " +
  "ignores location, compensation fit, and recruiter judgement.";

export function matchRequirements(
  required: Requirement[],
  niceToHave: string[],
  skills: SkillInput[],
): JobMatchResult {
  const bySkill = new Map(skills.map((s) => [s.skill.toLowerCase(), s]));
  const met: Requirement[] = [];
  const gaps: Requirement[] = [];
  const factors: MatchFactor[] = [];
  let points = 0;
  let max = 0;

  for (const req of required) {
    const weight = LEVEL_RANK[req.minLevel];
    max += weight * 2;
    const have = bySkill.get(req.skill.toLowerCase());
    if (have && LEVEL_RANK[have.level] >= LEVEL_RANK[req.minLevel]) {
      met.push(req);
      const evidenceBonus = Math.min(have.evidence.length, 2) * 0.5;
      points += weight * 2 + evidenceBonus;
      factors.push({
        kind: "met",
        label: `${req.skill} · ${have.level}`,
        detail:
          have.evidence.length > 0
            ? `Backed by ${have.evidence.length} linked project${have.evidence.length > 1 ? "s" : ""} in PostgreSQL`
            : "Level recorded, but no linked project evidence yet",
      });
    } else {
      gaps.push(req);
      if (have && LEVEL_RANK[have.level] === LEVEL_RANK[req.minLevel] - 1) {
        points += weight * 0.75;
      }
      factors.push({
        kind: "gap",
        label: have
          ? `${req.skill} · ${have.level} → needs ${req.minLevel}`
          : `${req.skill} · missing → needs ${req.minLevel}`,
        detail: have
          ? "One focused sprint closes this gap"
          : "No record yet — a sprint plus project evidence creates first signal",
      });
    }
  }

  const bonuses: string[] = [];
  for (const nice of niceToHave) {
    max += 1;
    const have = bySkill.get(nice.toLowerCase());
    if (have && LEVEL_RANK[have.level] >= 2) {
      bonuses.push(nice);
      points += 1;
      factors.push({
        kind: "bonus",
        label: `${nice} · bonus signal`,
        detail: "Nice-to-have that lifts the file above the pile",
      });
    }
  }

  const raw = max === 0 ? 0 : Math.round((points / max) * 100);
  // Percentages are bounded: over-qualification still reads as a full match.
  const score = Math.min(100, raw);
  const topGap = gaps[0];
  const nextStep = topGap
    ? `Close “${topGap.skill}” with a targeted sprint to lift this match`
    : "Strong fit on recorded skills — apply and prep the interview loop";

  return { score, met, gaps, bonuses, factors, nextStep, method: MATCH_METHOD };
}

/** Readiness from persisted inputs: 50% mean proficiency + 30% evidence coverage + 20% momentum. */
export function readinessScore(
  skills: { level: SkillLevel; evidenced: boolean }[],
  applicationsCount: number,
  evaluatedAttempts: number,
): number {
  if (skills.length === 0) return 0;
  const avg = skills.reduce((s, x) => s + LEVEL_RANK[x.level], 0) / skills.length;
  const proficiency = (avg / 4) * 50;
  const evidence = (skills.filter((s) => s.evidenced).length / skills.length) * 30;
  const momentum = Math.min(20, applicationsCount * 4 + evaluatedAttempts * 6);
  return Math.round(proficiency + evidence + momentum);
}

export const READINESS_METHOD =
  "Readiness = 50% mean recorded skill level + 30% share of skills with linked project evidence + " +
  "20% capped activity (applications, evaluated sprints). Rule-based; unverified claims earn no evidence points.";
