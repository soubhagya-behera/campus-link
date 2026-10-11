import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { nextLevel } from "../lib/match.js";
import { PROMOTION_THRESHOLD, RUBRIC_DESCRIPTION, gradeSubmission } from "../lib/rubric.js";
import { sendInvalid } from "../lib/validate.js";

const router = Router();

/** GET /api/attempts?studentProfileId=&assessmentId= — persisted submissions + scores. */
router.get("/", async (req, res, next) => {
  try {
    const studentProfileId = String(req.query.studentProfileId ?? "").trim();
    const assessmentId = String(req.query.assessmentId ?? "").trim();
    const rows = await prisma.assessmentAttempt.findMany({
      where: {
        ...(studentProfileId ? { studentProfileId } : {}),
        ...(assessmentId ? { assessmentId } : {}),
      },
      orderBy: { startedAt: "desc" },
      take: 50,
      include: { assessment: { select: { id: true, title: true, rewardSkill: true } } },
    });
    res.json({ ok: true, rubric: RUBRIC_DESCRIPTION, data: rows });
  } catch (err) {
    next(err);
  }
});

const submitBody = z.object({
  assessmentId: z.string().trim().min(1),
  studentProfileId: z.string().trim().min(1),
  // Checklist progress is self-attested; the submitted link lets a reviewer verify.
  repoUrl: z.string().trim().max(500).default(""),
  note: z.string().trim().max(4000).default(""),
  tasksDone: z.number().int().min(0).max(50),
  taskCount: z.number().int().min(1).max(50),
});

/**
 * POST /api/attempts — grade with the public rubric and, on 70+, promote the
 * rewarded skill one level and record the submission as a project (evidence),
 * all in one transaction.
 */
router.post("/", async (req, res, next) => {
  try {
    const parsed = submitBody.safeParse(req.body);
    if (!parsed.success) return sendInvalid(res, parsed.error);
    const { assessmentId, studentProfileId, repoUrl, note, tasksDone, taskCount } = parsed.data;

    const [assessment, profile] = await Promise.all([
      prisma.assessment.findUnique({ where: { id: assessmentId } }),
      prisma.studentProfile.findUnique({ where: { id: studentProfileId } }),
    ]);
    if (!assessment) return res.status(404).json({ ok: false, error: "Assessment not found" });
    if (!profile) return res.status(404).json({ ok: false, error: "Student profile not found" });
    if (tasksDone > taskCount) {
      return res.status(400).json({ ok: false, error: "tasksDone cannot exceed taskCount" });
    }

    const { score, feedback } = gradeSubmission(repoUrl, note, tasksDone, taskCount);

    const result = await prisma.$transaction(async (tx) => {
      const attempt = await tx.assessmentAttempt.create({
        data: {
          assessmentId,
          studentProfileId,
          score,
          status: "EVALUATED",
          repoUrl: repoUrl || null,
          note: note || null,
          feedback: feedback.join("\n"),
          submittedAt: new Date(),
        },
      });

      let promotedTo: string | null = null;
      let evidenceProjectId: string | null = null;
      if (score >= PROMOTION_THRESHOLD) {
        const skill = await tx.skill.upsert({
          where: { name: assessment.rewardSkill },
          update: {},
          create: { name: assessment.rewardSkill },
        });
        const existing = await tx.studentSkill.findUnique({
          where: { studentProfileId_skillId: { studentProfileId, skillId: skill.id } },
        });
        // Missing skill starts at INTERMEDIATE on a passing review; known skills promote one level.
        promotedTo = existing ? (nextLevel(existing.level) ?? existing.level) : "INTERMEDIATE";
        await tx.studentSkill.upsert({
          where: { studentProfileId_skillId: { studentProfileId, skillId: skill.id } },
          update: { level: promotedTo as never },
          create: { studentProfileId, skillId: skill.id, level: promotedTo as never },
        });
        const evidence = await tx.project.create({
          data: {
            studentProfileId,
            title: `Sprint: ${assessment.title}`,
            description: `Reviewed submission (${score}/100). ${note.slice(0, 280)}`,
            url: repoUrl || undefined,
            skills: [assessment.rewardSkill],
          },
        });
        evidenceProjectId = evidence.id;
      }
      return { attempt, promotedTo, evidenceProjectId };
    });

    res.status(201).json({
      ok: true,
      rubric: RUBRIC_DESCRIPTION,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
