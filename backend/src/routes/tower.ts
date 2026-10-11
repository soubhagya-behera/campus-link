import { Router } from "express";
import prisma from "../lib/prisma.js";
import { LEVEL_RANK } from "../lib/match.js";
import { requireAuth, requireRole } from "../lib/auth.js";

const router = Router();

/**
 * GET /api/tower/stats — KPIs computed from persisted records only.
 * Includes an explicit seed marker so demo content is never mistaken for outcomes.
 */
router.get("/stats", requireAuth, requireRole("STAFF", "ADMIN"), async (_req, res, next) => {
  try {
    const [students, jobs, apps, byStatus, profiles] = await Promise.all([
      prisma.studentProfile.count(),
      prisma.jobOpportunity.count({ where: { status: "OPEN" } }),
      prisma.application.count(),
      prisma.application.groupBy({ by: ["status"], _count: { status: true } }),
      prisma.studentProfile.findMany({
        select: {
          id: true,
          fullName: true,
          branch: true,
          skills: { select: { level: true } },
          _count: { select: { apps: true } },
        },
      }),
    ]);

    const readiness = profiles.map((p) => {
      if (p.skills.length === 0) return { ...p, score: 0 };
      const avg = p.skills.reduce((s, x) => s + LEVEL_RANK[x.level], 0) / p.skills.length;
      return { id: p.id, fullName: p.fullName, branch: p.branch, score: Math.round((avg / 4) * 100), apps: p._count.apps };
    });
    const avgReadiness =
      readiness.length === 0
        ? 0
        : Math.round(readiness.reduce((s, r) => s + r.score, 0) / readiness.length);

    const demoSeedPresent = await prisma.user.count({
      where: { email: { startsWith: "demo." } },
    });

    res.json({
      ok: true,
      data: {
        students,
        openOpportunities: jobs,
        applications: apps,
        byStatus: Object.fromEntries(byStatus.map((b) => [b.status, b._count.status])),
        avgReadiness,
        readiness,
        demoSeedPresent: demoSeedPresent > 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
