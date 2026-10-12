import { Router } from "express";
import prisma from "../lib/prisma.js";
import { parsePaging } from "../lib/validate.js";
import { requireAuth } from "../lib/auth.js";
import type { Request, Response } from "express";

/** Students read their own inbox only; placement uses the announcements list. */
function ownId(req: Request, res: Response): string | null {
  if (req.auth?.role !== "STUDENT" || !req.auth.studentProfileId) {
    res.status(403).json({ ok: false, error: "Student notifications only" });
    return null;
  }
  return req.auth.studentProfileId;
}

const router = Router();

/** GET /api/notifications — the caller's own inbox, newest first. Students only. */
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const id = ownId(req, res);
    if (!id) return;
    const { page, limit } = parsePaging(req);
    const where = { studentProfileId: id };
    const [total, rows] = await Promise.all([
      prisma.announcementRecipient.count({ where }),
      prisma.announcementRecipient.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          announcement: { include: { company: true, job: true } },
        },
      }),
    ]);
    res.json({ ok: true, data: rows, page, limit, total });
  } catch (err) {
    next(err);
  }
});

/** GET /api/notifications/unread-count — the caller's unread badge number. */
router.get("/unread-count", requireAuth, async (req, res, next) => {
  try {
    const id = ownId(req, res);
    if (!id) return;
    const count = await prisma.announcementRecipient.count({
      where: { studentProfileId: id, readAt: null },
    });
    res.json({ ok: true, data: { count } });
  } catch (err) {
    next(err);
  }
});

/** POST /api/notifications/:id/read — mark one own notification read. */
router.post("/:id/read", requireAuth, async (req, res, next) => {
  try {
    const id = ownId(req, res);
    if (!id) return;
    const row = await prisma.announcementRecipient.findUnique({ where: { id: req.params.id } });
    if (!row) return res.status(404).json({ ok: false, error: "Notification not found" });
    if (row.studentProfileId !== id) {
      return res.status(403).json({ ok: false, error: "Insufficient permissions" });
    }
    const updated =
      row.readAt ?? (await prisma.announcementRecipient.update({
        where: { id: row.id },
        data: { readAt: new Date() },
      }));
    res.json({ ok: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/** POST /api/notifications/read-all — mark the caller's unread as read. */
router.post("/read-all", requireAuth, async (req, res, next) => {
  try {
    const id = ownId(req, res);
    if (!id) return;
    const result = await prisma.announcementRecipient.updateMany({
      where: { studentProfileId: id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ ok: true, data: { updated: result.count } });
  } catch (err) {
    next(err);
  }
});

export default router;
