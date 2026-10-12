import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import {
  ARENA_BANK_VERSION,
  ARENA_METHOD,
  ARENA_PROMPTS,
  gradeAnswer,
  pointsForScore,
  promptIdsValidWith,
} from "../lib/arena.js";
import { parsePaging, sendInvalid } from "../lib/validate.js";
import { requireAuth, resolveStudentScope } from "../lib/auth.js";

const router = Router();

/**
 * GET /api/arena/prompts — any authenticated user. Staff-managed active
 * questions; the static curated bank only while the table is still empty.
 */
router.get("/prompts", requireAuth, async (_req, res, next) => {
  try {
    const rows = await prisma.arenaPrompt.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });
    if (rows.length === 0) {
      res.json({ ok: true, version: ARENA_BANK_VERSION, method: ARENA_METHOD, source: "static", data: ARENA_PROMPTS });
      return;
    }
    res.json({
      ok: true,
      version: ARENA_BANK_VERSION,
      method: ARENA_METHOD,
      source: "database",
      data: rows.map((p) => ({ id: p.id, category: p.category, prompt: p.prompt, hint: p.hint ?? "" })),
    });
  } catch (err) {
    next(err);
  }
});

const createBody = z.object({
  studentProfileId: z.string().trim().min(1),
  type: z.enum(["HR", "TECHNICAL", "MANAGERIAL", "MOCK"]).default("MOCK"),
  promptIds: z.array(z.string().trim().min(1)).min(1).max(5),
});

/**
 * POST /api/arena/sessions — start a persisted practice session.
 * score null means in progress; a scored session is complete.
 */
router.post("/sessions", requireAuth, async (req, res, next) => {
  try {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) return sendInvalid(res, parsed.error);
    if (req.auth?.role !== "STUDENT") {
      return res.status(403).json({ ok: false, error: "Only students hold practice sessions" });
    }
    const studentProfileId = resolveStudentScope(req, res, parsed.data.studentProfileId);
    if (!studentProfileId) return;
    const { type, promptIds } = parsed.data;
    const profile = await prisma.studentProfile.findUnique({ where: { id: studentProfileId } });
    if (!profile) return res.status(404).json({ ok: false, error: "Student profile not found" });
    const managed = await prisma.arenaPrompt.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    if (!promptIdsValidWith(promptIds, managed.map((p) => p.id))) {
      return res.status(400).json({ ok: false, error: "Unknown or duplicate prompt ids (see GET /api/arena/prompts)" });
    }
    const session = await prisma.interviewSession.create({
      data: {
        studentProfileId,
        type: type as never,
        transcript: JSON.stringify({ promptIds, answers: [] }),
      },
    });
    res.status(201).json({ ok: true, bankVersion: ARENA_BANK_VERSION, data: session });
  } catch (err) {
    next(err);
  }
});

const answersBody = z.object({
  answers: z
    .array(
      z.object({
        promptId: z.string().trim().min(1),
        text: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(5),
});

/**
 * POST /api/arena/sessions/:id/answers — grade answers with the public
 * rule-based method and persist score + feedback on the session.
 */
router.post("/sessions/:id/answers", requireAuth, async (req, res, next) => {
  try {
    const parsed = answersBody.safeParse(req.body);
    if (!parsed.success) return sendInvalid(res, parsed.error);
    const session = await prisma.interviewSession.findUnique({ where: { id: req.params.id } });
    if (!session) return res.status(404).json({ ok: false, error: "Interview session not found" });
    // Owner-only: placement may read history, never answer for a student.
    if (req.auth?.role !== "STUDENT" || req.auth.studentProfileId !== session.studentProfileId) {
      return res.status(403).json({ ok: false, error: "Insufficient permissions" });
    }

    let planned: string[] = [];
    try {
      const t = JSON.parse(session.transcript ?? "{}") as { promptIds?: unknown };
      if (Array.isArray(t.promptIds)) planned = t.promptIds.filter((x): x is string => typeof x === "string");
    } catch {
      return res.status(422).json({ ok: false, error: "Session transcript is corrupted; start a new session" });
    }
    const seen = new Set<string>();
    for (const a of parsed.data.answers) {
      if (!planned.includes(a.promptId)) {
        return res.status(400).json({ ok: false, error: `Prompt ${a.promptId} is not part of this session` });
      }
      if (seen.has(a.promptId)) {
        return res.status(400).json({ ok: false, error: `Duplicate answer for ${a.promptId}` });
      }
      seen.add(a.promptId);
    }

    const graded = parsed.data.answers.map((a) => ({ promptId: a.promptId, text: a.text, ...gradeAnswer(a.text) }));
    const score = Math.round(graded.reduce((s, g) => s + g.score, 0) / graded.length);
    const feedback = graded
      .map((g) => `${g.promptId}: ${g.score}/100 — ${g.notes.join(" ")}`)
      .join("\n");

    const updated = await prisma.interviewSession.update({
      where: { id: session.id },
      data: {
        transcript: JSON.stringify({ promptIds: planned, answers: graded.map((g) => ({ promptId: g.promptId, text: g.text })) }),
        feedback,
        score,
      },
    });
    // One ledger row per session: re-grading updates it, so retries can never
    // mint duplicate rewards. Points derive from the server score only.
    const pointsEarned = pointsForScore(score);
    await prisma.arenaPointLedger.upsert({
      where: { sessionId: session.id },
      update: { points: pointsEarned },
      create: { studentProfileId: session.studentProfileId, sessionId: session.id, points: pointsEarned },
    });
    const ledger = await prisma.arenaPointLedger.findMany({
      where: { studentProfileId: session.studentProfileId },
      select: { points: true },
    });
    const totalPoints = ledger.reduce((s, l) => s + l.points, 0);
    res.json({ ok: true, method: ARENA_METHOD, bankVersion: ARENA_BANK_VERSION, data: updated, pointsEarned, totalPoints });
  } catch (err) {
    next(err);
  }
});

/** GET /api/arena/sessions — owner or placement; recruiters have no access. */
router.get("/sessions", requireAuth, async (req, res, next) => {
  try {
    const { page, limit } = parsePaging(req);
    const requested = String(req.query.studentProfileId ?? "").trim();
    if (req.auth?.role === "RECRUITER") {
      return res.status(403).json({ ok: false, error: "Insufficient permissions" });
    }
    const studentProfileId =
      req.auth?.role === "STUDENT"
        ? resolveStudentScope(req, res, requested || (req.auth.studentProfileId ?? ""))
        : requested;
    if (req.auth?.role === "STUDENT" && !studentProfileId) return;
    const where = studentProfileId ? { studentProfileId } : {};
    const [total, rows] = await Promise.all([
      prisma.interviewSession.count({ where }),
      prisma.interviewSession.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    // Students see their own accumulated practice points alongside history.
    let totalPoints: number | null = null;
    if (req.auth?.role === "STUDENT" && studentProfileId) {
      const ledger = await prisma.arenaPointLedger.findMany({
        where: { studentProfileId },
        select: { points: true },
      });
      totalPoints = ledger.reduce((s, l) => s + l.points, 0);
    }
    res.json({ ok: true, method: ARENA_METHOD, data: rows, page, limit, total, totalPoints });
  } catch (err) {
    next(err);
  }
});

/** GET /api/arena/sessions/:id — owner or placement only. */
router.get("/sessions/:id", requireAuth, async (req, res, next) => {
  try {
    const session = await prisma.interviewSession.findUnique({ where: { id: req.params.id } });
    if (!session) return res.status(404).json({ ok: false, error: "Interview session not found" });
    const role = req.auth?.role;
    const allowed =
      role === "STAFF" ||
      role === "ADMIN" ||
      (role === "STUDENT" && req.auth?.studentProfileId === session.studentProfileId);
    if (!allowed) return res.status(403).json({ ok: false, error: "Insufficient permissions" });
    res.json({ ok: true, method: ARENA_METHOD, data: session });
  } catch (err) {
    next(err);
  }
});

export default router;
