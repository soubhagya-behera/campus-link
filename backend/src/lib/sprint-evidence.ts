/**
 * Sprint evidence projects: one row per (student, assessment).
 *
 * A passing rubric score (70+) records the submission as a project so skills
 * gain linked evidence. Re-submits must refresh that same row — creating a
 * new project per passing attempt would stack duplicates that inflate
 * evidence counts and readiness. Manually added projects carry
 * `assessmentId: null` and are never matched here.
 */

export interface SprintEvidenceInput {
  studentProfileId: string;
  assessmentId: string;
  assessmentTitle: string;
  rewardSkill: string;
  score: number;
  note: string;
  repoUrl: string | null;
}

/** Minimal surface of the Prisma project delegate used below. Real
 *  transactions satisfy this structurally, and tests supply an in-memory
 *  fake — no database needed to prove the reuse rule. */
export interface SprintEvidenceStore {
  project: {
    findFirst(args: {
      where: { studentProfileId: string; assessmentId: string };
    }): Promise<{ id: string } | null>;
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
    update(args: {
      where: { id: string };
      data: Record<string, unknown>;
    }): Promise<{ id: string }>;
  };
}

function evidenceFields(input: SprintEvidenceInput): Record<string, unknown> {
  return {
    title: `Sprint: ${input.assessmentTitle}`,
    description: `Reviewed submission (${input.score}/100). ${input.note.slice(0, 280)}`,
    url: input.repoUrl || undefined,
    skills: [input.rewardSkill],
  };
}

/**
 * Create the sprint evidence project, or refresh the existing one for this
 * student and assessment. Returns the project id and whether a row was
 * created (false means an existing row was updated).
 */
export async function upsertSprintEvidence(
  tx: SprintEvidenceStore,
  input: SprintEvidenceInput,
): Promise<{ evidenceProjectId: string; evidenceCreated: boolean }> {
  const existing = await tx.project.findFirst({
    where: { studentProfileId: input.studentProfileId, assessmentId: input.assessmentId },
  });
  if (existing) {
    const updated = await tx.project.update({
      where: { id: existing.id },
      data: evidenceFields(input),
    });
    return { evidenceProjectId: updated.id, evidenceCreated: false };
  }
  const created = await tx.project.create({
    data: {
      studentProfileId: input.studentProfileId,
      assessmentId: input.assessmentId,
      ...evidenceFields(input),
    },
  });
  return { evidenceProjectId: created.id, evidenceCreated: true };
}
