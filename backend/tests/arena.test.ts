import { describe, expect, it } from "vitest";
import {
  ARENA_PROMPTS,
  gradeAnswer,
  promptIdsValid,
} from "../src/lib/arena.js";
import { PROMOTION_THRESHOLD, gradeSubmission } from "../src/lib/rubric.js";

const STRONG =
  "The trickiest call was roving tabindex over aria-activedescendant because tests showed " +
  "screen reader verbosity dropped. I chose client pagination over virtualization since 5k rows " +
  "rendered under 60ms in perf traces, a tradeoff I verified with explain profiling runs. " +
  "In that situation my task was clear, the action I took is described above, and the result " +
  "was a calmer table for every user.";

describe("arena grading", () => {
  it("scores a strong structured answer at offer-grade", () => {
    const r = gradeAnswer(STRONG);
    expect(r.score).toBeGreaterThanOrEqual(75);
    expect(r.notes.length).toBeGreaterThan(0);
  });

  it("penalizes thin, unquantified answers", () => {
    const r = gradeAnswer("it went fine I think");
    expect(r.score).toBeLessThan(55);
  });

  it("caps at 100", () => {
    const r = gradeAnswer(`${STRONG} ${STRONG}`);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("bank has stable unique ids", () => {
    const ids = ARENA_PROMPTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(promptIdsValid([ids[0]])).toBe(true);
    expect(promptIdsValid([])).toBe(false);
    expect(promptIdsValid(["nope"])).toBe(false);
    expect(promptIdsValid([ids[0], ids[0], ids[1], ids[2], ids[0], ids[1]])).toBe(false);
  });

  it("grades deterministically, so a retry after a failed submit shows the same score", () => {
    const first = gradeAnswer(STRONG);
    const second = gradeAnswer(STRONG);
    expect(second).toEqual(first);
  });

  it("grades the exact submitted text, independent of history", () => {
    // Retrying the same answer against a reused session must not drift: the
    // score is a pure function of the text, never of prior attempts.
    const short = "it went fine I think";
    expect(gradeAnswer(short)).toEqual(gradeAnswer(`  ${short}  `));
    expect(gradeAnswer(STRONG).score).toBe(gradeAnswer(STRONG).score);
  });
});

describe("rubric promotion boundary", () => {
  it("promotes at exactly the threshold", () => {
    // 40 base + 15 link + 15 write-up(40+ words) + 0 quality = 70
    const words = Array.from({ length: 45 }, (_, i) => `word${i}`).join(" ");
    const r = gradeSubmission("https://example.com/repo-link-here", words, 0, 4);
    expect(r.score).toBe(PROMOTION_THRESHOLD);
  });

  it("withholds promotion one point below", () => {
    // 40 base + 15 link + 8 write-up (30 words) + 5 quality-word = 68
    const words = `${Array.from({ length: 29 }, (_, i) => `word${i}`).join(" ")} tradeoff studied`;
    const r = gradeSubmission("https://example.com/repo-link-here", words, 0, 4);
    expect(r.score).toBeLessThan(PROMOTION_THRESHOLD);
  });
});
