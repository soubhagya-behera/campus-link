import { describe, expect, it } from "vitest";
import { upsertSprintEvidence, type SprintEvidenceStore } from "../src/lib/sprint-evidence.js";

interface Row {
  id: string;
  studentProfileId: string;
  assessmentId: string | null;
  title: string;
}

/** In-memory stand-in for the Prisma project delegate: records calls. */
function fakeStore(seed: Row[] = []): SprintEvidenceStore & { rows: Row[]; calls: string[] } {
  const rows: Row[] = [...seed];
  const calls: string[] = [];
  let n = rows.length;
  return {
    rows,
    calls,
    project: {
      findFirst: async ({ where }: { where: { studentProfileId: string; assessmentId: string } }) => {
        calls.push("findFirst");
        const hit = rows.find(
          (r) => r.studentProfileId === where.studentProfileId && r.assessmentId === where.assessmentId,
        );
        return hit ? { id: hit.id } : null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.push("create");
        n += 1;
        rows.push({
          id: `p${n}`,
          studentProfileId: data.studentProfileId as string,
          assessmentId: (data.assessmentId as string | null) ?? null,
          title: data.title as string,
        });
        return { id: `p${n}` };
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        calls.push("update");
        const row = rows.find((r) => r.id === where.id);
        if (!row) throw new Error("missing row");
        row.title = data.title as string;
        return { id: row.id };
      },
    },
  };
}

const INPUT = {
  studentProfileId: "student-1",
  assessmentId: "assess-1",
  assessmentTitle: "Tables",
  rewardSkill: "React",
  score: 85,
  note: "Roving tabindex over virtualization for screen-reader verbosity.",
  repoUrl: "https://github.com/demo/tables",
};

describe("sprint evidence reuse", () => {
  it("creates one evidence project on the first passing attempt", async () => {
    const store = fakeStore();
    const r = await upsertSprintEvidence(store, INPUT);
    expect(r.evidenceCreated).toBe(true);
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0].assessmentId).toBe("assess-1");
    expect(store.calls).toEqual(["findFirst", "create"]);
  });

  it("a second passing attempt updates the same project instead of duplicating it", async () => {
    const store = fakeStore();
    const first = await upsertSprintEvidence(store, INPUT);
    const second = await upsertSprintEvidence(store, { ...INPUT, score: 92 });
    expect(second.evidenceProjectId).toBe(first.evidenceProjectId);
    expect(second.evidenceCreated).toBe(false);
    expect(store.rows).toHaveLength(1);
    expect(store.calls).toEqual(["findFirst", "create", "findFirst", "update"]);
  });

  it("ignores manually created projects and other assessments or students", async () => {
    const store = fakeStore([
      { id: "manual", studentProfileId: "student-1", assessmentId: null, title: "Sprint: Tables" },
      { id: "other-a", studentProfileId: "student-1", assessmentId: "assess-2", title: "Sprint: Other" },
      { id: "other-s", studentProfileId: "student-2", assessmentId: "assess-1", title: "Sprint: Tables" },
    ]);
    const r = await upsertSprintEvidence(store, INPUT);
    expect(r.evidenceCreated).toBe(true);
    expect(store.rows).toHaveLength(4);
    // Manual and foreign rows are untouched.
    expect(store.rows.find((x) => x.id === "manual")?.title).toBe("Sprint: Tables");
  });
});
