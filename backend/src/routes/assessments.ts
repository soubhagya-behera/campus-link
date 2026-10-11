import { Router } from "express";
import prisma from "../lib/prisma.js";
import { RUBRIC_DESCRIPTION } from "../lib/rubric.js";
import { parsePaging } from "../lib/validate.js";

const router = Router();

/** GET /api/assessments — challenge catalogue (content; attempts are the persisted records). */
router.get("/", async (req, res, next) => {
  try {
    const { page, limit } = parsePaging(req);
    const [total, rows] = await Promise.all([
      prisma.assessment.count(),
      prisma.assessment.findMany({
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { attempts: true } } },
      }),
    ]);
    res.json({
      ok: true,
      rubric: RUBRIC_DESCRIPTION,
      data: rows.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        rewardSkill: a.rewardSkill,
        attemptCount: a._count.attempts,
      })),
      page,
      limit,
      total,
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/assessments/:id */
router.get("/:id", async (req, res, next) => {
  try {
    const a = await prisma.assessment.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { attempts: true } } },
    });
    if (!a) return res.status(404).json({ ok: false, error: "Assessment not found" });
    res.json({
      ok: true,
      rubric: RUBRIC_DESCRIPTION,
      data: {
        id: a.id,
        title: a.title,
        description: a.description,
        rewardSkill: a.rewardSkill,
        attemptCount: a._count.attempts,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
