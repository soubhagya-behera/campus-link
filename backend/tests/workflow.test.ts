import { describe, expect, it } from "vitest";
import { canTransition } from "../src/routes/applications.js";
import { PROMOTION_THRESHOLD, gradeSubmission } from "../src/lib/rubric.js";

describe("application transitions", () => {
  it("allows the documented forward workflow", () => {
    expect(canTransition("APPLIED", "SHORTLISTED")).toBe(true);
    expect(canTransition("APPLIED", "WITHDRAWN")).toBe(true);
    expect(canTransition("SHORTLISTED", "HIRED")).toBe(true);
    expect(canTransition("SHORTLISTED", "REJECTED")).toBe(true);
  });

  it("rejects backward jumps and terminal-state changes", () => {
    expect(canTransition("SHORTLISTED", "APPLIED")).toBe(false);
    expect(canTransition("APPLIED", "HIRED")).toBe(false);
    expect(canTransition("REJECTED", "APPLIED")).toBe(false);
    expect(canTransition("HIRED", "WITHDRAWN")).toBe(false);
    expect(canTransition("WITHDRAWN", "APPLIED")).toBe(false);
  });

  it("keeps WITHDRAWN terminal in every direction, so a withdrawn row can never reactivate", () => {
    for (const to of ["APPLIED", "SHORTLISTED", "REJECTED", "HIRED", "WITHDRAWN"] as const) {
      expect(canTransition("WITHDRAWN", to)).toBe(false);
    }
  });
});

describe("sprint rubric", () => {
  const goodNote =
    "The trickiest call was roving tabindex over aria-activedescendant because tests showed " +
    "screen reader verbosity dropped. I chose client pagination over virtualization since 5k rows " +
    "rendered under 60ms in perf traces, a tradeoff I verified with explain profiling runs.";

  it("scores a complete, verifiable, well-written submission above threshold", () => {
    const r = gradeSubmission("https://github.com/demo/table", goodNote, 4, 4);
    expect(r.score).toBeGreaterThanOrEqual(PROMOTION_THRESHOLD);
    expect(r.feedback.length).toBeGreaterThan(0);
  });

  it("penalizes missing links and thin write-ups", () => {
    const r = gradeSubmission("not-a-link", "did the stuff", 1, 4);
    expect(r.score).toBeLessThan(PROMOTION_THRESHOLD);
  });

  it("caps at 100", () => {
    const r = gradeSubmission("https://example.com/x", `${goodNote} ${goodNote}`, 10, 10);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});
