import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { AUDIENCES, CATEGORIES, resolveRecipientIds } from "../lib/announcements.js";
import { parsePaging, sendInvalid } from "../lib/validate.js";
import { requireAuth, requireRole } from "../lib/auth.js";

const router = Router();

const publishBody = z.object({
  title: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(5000),
  audience: z.enum(AUDIENCES),
  jobId: z.string().trim().min(1).optional(),
  companyId: z.string().trim().min(1).optional(),
  category: z.enum(CATEGORIES).default("GENERAL"),
  isUrgent: z.boolean().default(false),
  eventAt: z.string().datetime({ offset: true }).optional(),
  venue: z.string().trim().max(120).optional(),
  meetingUrl: z.string().trim().url().max(500).optional(),
});

/**
 * POST /api/announcements — placement only. Validates, resolves recipients
 * from live records, then materializes the announcement + recipient rows in
 * one transaction. Empty audiences are refused (422) before anything is
 * written. Returns the persisted recipient count, never a client claim.
 */
router.post("/", requireAuth, requireRole("STAFF", "ADMIN"), async (req, res, next) => {
  try {
    const parsed = publishBody.safeParse(req.body);
    if (!parsed.success) return sendInvalid(res, parsed.error);
    const b = parsed.data;
    if (b.audience !== "ALL" && !b.jobId) {
      return res.status(400).json({ ok: false, error: "This audience needs a company drive." });
    }

    let companyId = b.companyId ?? null;
    if (b.jobId) {
      const job = await prisma.jobOpportunity.findUnique({
        where: { id: b.jobId },
        include: { company: true },
      });
      if (!job) return res.status(404).json({ ok: false, error: "Company drive not found" });
      companyId = job.companyId;
    } else if (companyId) {
      const company = await prisma.company.findUnique({ where: { id: companyId } });
      if (!company) return res.status(404).json({ ok: false, error: "Company not found" });
    }

    const recipientIds = await resolveRecipientIds(prisma, b.audience, b.jobId ?? null);
    if (recipientIds.length === 0) {
      return res.status(422).json({ ok: false, error: "No students match this audience — nothing was published." });
    }

    const created = await prisma.$transaction(async (tx) => {
      const announcement = await tx.announcement.create({
        data: {
          title: b.title,
          message: b.message,
          category: b.category as never,
          isUrgent: b.isUrgent,
          audience: b.audience as never,
          authorId: req.auth!.id,
          companyId,
          jobId: b.jobId ?? null,
          eventAt: b.eventAt ? new Date(b.eventAt) : null,
          venue: b.venue || null,
          meetingUrl: b.meetingUrl || null,
        },
        include: { company: true, job: true },
      });
      await tx.announcementRecipient.createMany({
        data: recipientIds.map((studentProfileId) => ({
          announcementId: announcement.id,
          studentProfileId,
        })),
        skipDuplicates: true,
      });
      return announcement;
    });

    res.status(201).json({ ok: true, data: { announcement: created, recipientCount: recipientIds.length } });
  } catch (err) {
    next(err);
  }
});

/** GET /api/announcements/recipients/preview?audience=&jobId= — placement only. */
router.get("/recipients/preview", requireAuth, requireRole("STAFF", "ADMIN"), async (req, res, next) => {
  try {
    const audience = String(req.query.audience ?? "").trim().toUpperCase();
    if (!(AUDIENCES as readonly string[]).includes(audience)) {
      return res.status(400).json({ ok: false, error: "Unknown audience" });
    }
    const jobId = String(req.query.jobId ?? "").trim() || null;
    if (audience !== "ALL" && !jobId) {
      return res.status(400).json({ ok: false, error: "This audience needs a company drive." });
    }
    if (jobId && !(await prisma.jobOpportunity.findUnique({ where: { id: jobId } }))) {
      return res.status(404).json({ ok: false, error: "Company drive not found" });
    }
    const ids = await resolveRecipientIds(prisma, audience as never, jobId);
    res.json({ ok: true, data: { recipientCount: ids.length } });
  } catch (err) {
    next(err);
  }
});

/** GET /api/announcements — placement only: history with recipient + unread counts. */
router.get("/", requireAuth, requireRole("STAFF", "ADMIN"), async (req, res, next) => {
  try {
    const { page, limit } = parsePaging(req);
    const [total, rows] = await Promise.all([
      prisma.announcement.count(),
      prisma.announcement.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          company: true,
          job: true,
          _count: { select: { recipients: true } },
        },
      }),
    ]);
    const unreadRows = await prisma.announcementRecipient.groupBy({
      by: ["announcementId"],
      where: { readAt: null },
      _count: { announcementId: true },
    });
    const unreadById = new Map(unreadRows.map((r) => [r.announcementId, r._count.announcementId]));
    const unreadTotal = unreadRows.reduce((s, r) => s + r._count.announcementId, 0);
    res.json({
      ok: true,
      data: rows.map((a) => ({
        ...a,
        recipientCount: a._count.recipients,
        unreadCount: unreadById.get(a.id) ?? 0,
      })),
      meta: {
        published: total,
        totalRecipients: rows.reduce((s, a) => s + a._count.recipients, 0),
        unreadTotal,
      },
      page,
      limit,
      total,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
