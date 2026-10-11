import { Router } from "express";
import prisma from "../lib/prisma.js";

const router = Router();

/**
 * GET /api/demo/identity — development signpost, NOT authentication.
 * Returns the seeded demo student profile id when the demo seed has been run.
 * Real auth does not exist yet; every write route takes an explicit
 * studentProfileId and must not be treated as access-controlled.
 */
router.get("/identity", async (_req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { email: "demo.student@campuslink.local" },
      include: { studentProfile: { select: { id: true, fullName: true } } },
    });
    if (!user?.studentProfile) {
      return res.status(404).json({
        ok: false,
        error: "Demo seed not installed. Run: npm run prisma:seed",
      });
    }
    res.json({
      ok: true,
      devOnly: true,
      notice: "Development identity — no authentication is implemented.",
      data: { studentProfileId: user.studentProfile.id, fullName: user.studentProfile.fullName },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
