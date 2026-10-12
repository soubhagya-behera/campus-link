import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { ARENA_CATEGORIES } from "../lib/arena.js";
import { parsePaging, sendInvalid } from "../lib/validate.js";
import { requireAuth, requireRole } from "../lib/auth.js";

const router = Router();
const staff = [requireAuth, requireRole("STAFF", "ADMIN")];

const category = z.enum(ARENA_CATEGORIES);

const createBody = z.object({
  prompt: z.string().trim().min(10).max(1000),
  category,
  hint: z.string().trim().max(500).optional(),
  isActive: z.boolean().default(true),
});

/** GET /api/arena/bank — placement only: every question incl. inactive. */
router.get("/bank", ...staff, async (_req, res, next) => {
  try {
    const rows = await prisma.arenaPrompt.findMany({ orderBy: { createdAt: "asc" } });
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
});

/** POST /api/arena/bank — placement only: add a question (no dummy rows). */
router.post("/bank", ...staff, async (req, res, next) => {
  try {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) return sendInvalid(res, parsed.error);
    const created = await prisma.arenaPrompt.create({
      data: {
        prompt: parsed.data.prompt,
        category: parsed.data.category as never,
        hint: parsed.data.hint || null,
        isActive: parsed.data.isActive,
        authorId: req.auth?.id ?? null,
      },
    });
    res.status(201).json({ ok: true, data: created });
  } catch (err) {
    next(err);
  }
});

const patchBody = z
  .object({
    prompt: z.string().trim().min(10).max(1000).optional(),
    category: category.optional(),
    hint: z.string().trim().max(500).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), {
    message: "Provide at least one field to update",
  });

/** PATCH /api/arena/bank/:id — placement only. Past sessions keep their
 *  answers and scores; only the live prompt text changes. */
router.patch("/bank/:id", ...staff, async (req, res, next) => {
  try {
    const parsed = patchBody.safeParse(req.body);
    if (!parsed.success) return sendInvalid(res, parsed.error);
    const existing = await prisma.arenaPrompt.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ ok: false, error: "Question not found" });
    const b = parsed.data;
    const updated = await prisma.arenaPrompt.update({
      where: { id: existing.id },
      data: {
        ...(b.prompt !== undefined ? { prompt: b.prompt } : {}),
        ...(b.category !== undefined ? { category: b.category as never } : {}),
        ...(b.hint !== undefined ? { hint: b.hint || null } : {}),
        ...(b.isActive !== undefined ? { isActive: b.isActive } : {}),
      },
    });
    res.json({ ok: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/arena/bank/:id — placement only, and only when no practice
 * session references the question. Deactivation is the safe default;
 * deletion is refused rather than destroying history.
 */
router.delete("/bank/:id", ...staff, async (req, res, next) => {
  try {
    const existing = await prisma.arenaPrompt.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ ok: false, error: "Question not found" });
    const used = await prisma.interviewSession.count({
      where: { transcript: { contains: existing.id } },
    });
    if (used > 0) {
      return res.status(409).json({
        ok: false,
        error: `Used by ${used} practice session${used === 1 ? "" : "s"} — deactivate instead of deleting.`,
      });
    }
    await prisma.arenaPrompt.delete({ where: { id: existing.id } });
    res.json({ ok: true, data: { id: existing.id } });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/arena/activity — placement only: real practice records with
 * student, question, timing, answer, score and awarded points. Optional
 * filters: ?studentProfileId=&type=&promptId= (prompt matched inside the
 * stored transcript).
 */
router.get("/activity", ...staff, async (req, res, next) => {
  try {
    const { page, limit } = parsePaging(req);
    const studentProfileId = String(req.query.studentProfileId ?? "").trim();
    const type = String(req.query.type ?? "").trim();
    const promptId = String(req.query.promptId ?? "").trim();
    const where = {
      ...(studentProfileId ? { studentProfileId } : {}),
      ...(type ? { type: type as never } : {}),
      ...(promptId ? { transcript: { contains: promptId } } : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.interviewSession.count({ where }),
      prisma.interviewSession.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          student: { select: { id: true, fullName: true, enrollmentNo: true } },
          ledger: { select: { points: true } },
        },
      }),
    ]);
    res.json({
      ok: true,
      data: rows.map((s) => {
        let answers: { promptId: string; text: string }[] = [];
        let promptIds: string[] = [];
        try {
          const t = JSON.parse(s.transcript ?? "{}") as {
            promptIds?: unknown;
            answers?: { promptId?: unknown; text?: unknown }[];
          };
          if (Array.isArray(t.promptIds)) {
            promptIds = t.promptIds.filter((x): x is string => typeof x === "string");
          }
          if (Array.isArray(t.answers)) {
            answers = t.answers
              .filter((a) => typeof a?.promptId === "string" && typeof a?.text === "string")
              .map((a) => ({ promptId: a.promptId as string, text: a.text as string }));
          }
        } catch {
          // Corrupt transcripts surface as empty rather than breaking the list.
        }
        return {
          id: s.id,
          student: s.student,
          type: s.type,
          promptIds,
          answers,
          score: s.score,
          points: s.ledger?.points ?? 0,
          feedback: s.feedback,
          createdAt: s.createdAt,
        };
      }),
      page,
      limit,
      total,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
