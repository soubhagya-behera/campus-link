import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireAuth, resolveStudentScope } from "../lib/auth.js";

const router = Router();

/**
 * GET /api/students/:id/passport — proof-of-Skill passport assembled ONLY from
 * persisted records. Provenance vocabulary (honest by construction):
 * - "self-reported": skill levels recorded via PATCH /skills (includes levels
 *   later promoted by the rubric — the setter is not tracked per change).
 * - "user-submitted": project evidence added by the student.
 * - "sprint-submission": project evidence auto-recorded from a passing
 *   rubric-graded attempt (title prefix "Sprint: ").
 * - "rubric-assessed": evaluated attempts with the public rubric version.
 * There is NO "independently verified" state in this system: no verifier
 * role or verification process exists, so none is claimed.
 */
router.get("/:id/passport", requireAuth, async (req, res, next) => {
  try {
    const id = resolveStudentScope(req, res, req.params.id);
    if (!id) return;
    const profile = await prisma.studentProfile.findUnique({
      where: { id },
      include: {
        skills: { include: { skill: true } },
        projects: { orderBy: { createdAt: "desc" } },
        attempts: {
          where: { status: "EVALUATED" },
          orderBy: { submittedAt: "desc" },
          include: { assessment: { select: { id: true, title: true, rewardSkill: true } } },
        },
      },
    });
    if (!profile) return res.status(404).json({ ok: false, error: "Student profile not found" });

    const evidenceBySkill = new Map<string, typeof profile.projects>();
    for (const project of profile.projects) {
      for (const s of project.skills) {
        const key = s.toLowerCase();
        if (!evidenceBySkill.has(key)) evidenceBySkill.set(key, []);
        evidenceBySkill.get(key)?.push(project);
      }
    }

    res.json({
      ok: true,
      data: {
        student: {
          id: profile.id,
          fullName: profile.fullName,
          enrollmentNo: profile.enrollmentNo,
          branch: profile.branch,
          graduationYear: profile.graduationYear,
          cgpa: profile.cgpa,
        },
        skills: profile.skills.map((ss) => {
          const evidence = evidenceBySkill.get(ss.skill.name.toLowerCase()) ?? [];
          return {
            skill: ss.skill.name,
            level: ss.level,
            levelProvenance: "self-reported" as const,
            evidence: evidence.map((p) => ({
              projectId: p.id,
              title: p.title,
              url: p.url,
              source: p.title.startsWith("Sprint: ") ? ("sprint-submission" as const) : ("user-submitted" as const),
              recordedAt: p.createdAt,
            })),
          };
        }),
        attempts: profile.attempts.map((a) => ({
          id: a.id,
          assessment: a.assessment,
          score: a.score,
          provenance: "rubric-assessed" as const,
          submittedAt: a.submittedAt,
        })),
        verification: {
          independentlyVerifiedItems: 0,
          note: "No independent verification process exists; all evidence is either user-submitted or rubric-assessed.",
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
