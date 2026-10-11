import { describe, expect, it } from "vitest";
import {
  matchRequirements,
  readinessScore,
  type SkillInput,
} from "../src/lib/match.js";

const SKILLS: SkillInput[] = [
  { skill: "React", level: "INTERMEDIATE", evidence: ["p1", "p2"] },
  { skill: "TypeScript", level: "INTERMEDIATE", evidence: ["p1"] },
  { skill: "UI Design", level: "BEGINNER", evidence: [] },
];

describe("matchRequirements", () => {
  it("scores a perfect, evidenced fit at 100", () => {
    const r = matchRequirements(
      [
        { skill: "React", minLevel: "INTERMEDIATE" },
        { skill: "TypeScript", minLevel: "INTERMEDIATE" },
      ],
      [],
      SKILLS,
    );
    expect(r.score).toBe(100);
    expect(r.gaps).toHaveLength(0);
    expect(r.met).toHaveLength(2);
  });

  it("flags gaps and gives partial credit one level below", () => {
    const r = matchRequirements(
      [
        { skill: "React", minLevel: "ADVANCED" },
        { skill: "PostgreSQL", minLevel: "INTERMEDIATE" },
      ],
      [],
      SKILLS,
    );
    expect(r.gaps.map((g) => g.skill).sort()).toEqual(["PostgreSQL", "React"]);
    // React INTERMEDIATE vs ADVANCED earns partial credit, so score > 0
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(60);
    expect(r.nextStep).toContain("React");
  });

  it("rewards evidenced skills over claimed ones", () => {
    const evidenced = matchRequirements(
      [{ skill: "React", minLevel: "INTERMEDIATE" }],
      [],
      [{ skill: "React", level: "INTERMEDIATE", evidence: ["p1", "p2", "p3"] }],
    );
    const claimed = matchRequirements(
      [{ skill: "React", minLevel: "INTERMEDIATE" }],
      [],
      [{ skill: "React", level: "INTERMEDIATE", evidence: [] }],
    );
    expect(evidenced.score).toBe(100); // capped
    expect(evidenced.score).toBeGreaterThanOrEqual(claimed.score);
    expect(claimed.factors[0].detail).toContain("no linked project evidence");
  });

  it("adds nice-to-have bonuses and documents the method", () => {
    const r = matchRequirements(
      [{ skill: "React", minLevel: "INTERMEDIATE" }],
      ["TypeScript", "Go"],
      SKILLS,
    );
    expect(r.bonuses).toEqual(["TypeScript"]);
    expect(r.method).toContain("Rule-based");
  });

  it("matches skill names case-insensitively", () => {
    const r = matchRequirements([{ skill: "react", minLevel: "BEGINNER" }], [], SKILLS);
    expect(r.met).toHaveLength(1);
  });
});

describe("readinessScore", () => {
  it("returns 0 with no recorded skills", () => {
    expect(readinessScore([], 3, 2)).toBe(0);
  });

  it("rewards evidence and activity monotonically", () => {
    const base = readinessScore(
      [
        { level: "INTERMEDIATE", evidenced: false },
        { level: "BEGINNER", evidenced: false },
      ],
      0,
      0,
    );
    const better = readinessScore(
      [
        { level: "INTERMEDIATE", evidenced: true },
        { level: "BEGINNER", evidenced: false },
      ],
      2,
      1,
    );
    expect(better).toBeGreaterThan(base);
  });
});
