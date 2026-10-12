/**
 * Announcement audience targeting. Status semantics reuse the application
 * workflow exactly: APPLIED/SHORTLISTED are literal statuses, and
 * INTERVIEW_SELECTED maps to HIRED (the defined selection outcome) — no new
 * status is invented. ALL means every registered student profile.
 */

export const AUDIENCES = ["ALL", "APPLIED", "SHORTLISTED", "INTERVIEW_SELECTED"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const CATEGORIES = ["GENERAL", "MEETING", "INTERVIEW", "DEADLINE", "UPDATE"] as const;

/** Statuses that count as "applied to this drive" for each audience. */
const STATUS_FOR_AUDIENCE: Partial<Record<Audience, string>> = {
  APPLIED: "APPLIED",
  SHORTLISTED: "SHORTLISTED",
  INTERVIEW_SELECTED: "HIRED",
};

export function statusForAudience(audience: Audience): string | null {
  return STATUS_FOR_AUDIENCE[audience] ?? null;
}

/** Minimal store surface: real Prisma transactions satisfy this structurally. */
export interface AudienceStore {
  application: {
    findMany(args: unknown): Promise<{ studentProfileId: string }[]>;
  };
  studentProfile: {
    findMany(args: unknown): Promise<{ id: string }[]>;
  };
}

/**
 * Distinct student profile ids matching an audience, computed from live
 * records. The publish route and the preview-count route share this, so the
 * displayed count is exactly what delivery materializes. Never trusts a
 * client-supplied recipient list.
 */
export async function resolveRecipientIds(
  store: AudienceStore,
  audience: Audience,
  jobId: string | null,
): Promise<string[]> {
  if (audience === "ALL") {
    const rows = await store.studentProfile.findMany({ select: { id: true } });
    return [...new Set(rows.map((r) => r.id))];
  }
  const status = statusForAudience(audience);
  if (!status || !jobId) return [];
  const rows = await store.application.findMany({
    where: { jobId, status },
    select: { studentProfileId: true },
    distinct: ["studentProfileId"],
  });
  return [...new Set(rows.map((r) => r.studentProfileId))];
}
