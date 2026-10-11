import { Router } from "express";
import prisma from "../lib/prisma.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true, service: "campuslink-backend", time: new Date().toISOString() });
});

router.get("/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: "up" });
  } catch {
    res.status(503).json({ ok: false, db: "down" });
  }
});

export default router;
