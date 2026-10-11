import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { parsePaging, sendInvalid } from "../lib/validate.js";

const router = Router();

type Status = "APPLIED" | "SHORTLISTED" | "REJECTED" | "HIRED" | "WITHDRAWN";

/** Enforced forward-only workflow (authorship: placement cell or the applicant). */
const TRANSITIONS: Record<Status, Status[]> = {
  APPLIED: ["SHORTLISTED", "REJECTED", "WITHDRAWN"],
  SHORTLISTED: ["HIRED", "REJECTED", "WITHDRAWN"],
  REJECTED: [],
  HIRED: [],
  WITHDRAWN: [],
};

export function canTransition(from: Status, to: Status): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** GET /api/applications?studentProfileId=&status=&page=&limit= */
router.get("/", async (req, res, next) => {
  try {
    const { page, limit } = parsePaging(req);
    const studentProfileId = String(req.query.studentProfileId ?? "").trim();
    const status = String(req.query.status ?? "").trim();
    const where = {
      ...(studentProfileId ? { studentProfileId } : {}),
      ...(status ? { status: status as never } : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.application.count({ where }),
      prisma.application.findMany({
        where,
        orderBy: { appliedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { job: { include: { company: true } } },
      }),
    ]);
    res.json({
      ok: true,
      data: rows.map((a) => ({
        id: a.id,
        status: a.status,
        appliedAt: a.appliedAt,
        updatedAt: a.updatedAt,
        job: {
          id: a.job.id,
          title: a.job.title,
          company: a.job.company.name,
          location: a.job.location,
          type: a.job.type,
          salary: a.job.salary,
          deadline: a.job.deadline,
        },
      })),
      page,
      limit,
      total,
    });
  } catch (err) {
    next(err);
  }
});

const createBody = z.object({
  jobId: z.string().trim().min(1),
  studentProfileId: z.string().trim().min(1),
});

/** POST /api/applications — 201 created, 404 unknown job/profile, 409 duplicate. */
router.post("/", async (req, res, next) => {
  try {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) return sendInvalid(res, parsed.error);
    const { jobId, studentProfileId } = parsed.data;

    const [job, profile] = await Promise.all([
      prisma.jobOpportunity.findUnique({ where: { id: jobId } }),
      prisma.studentProfile.findUnique({ where: { id: studentProfileId } }),
    ]);
    if (!job) return res.status(404).json({ ok: false, error: "Opportunity not found" });
    if (!profile) return res.status(404).json({ ok: false, error: "Student profile not found" });
    if (job.status !== "OPEN") {
      return res.status(422).json({ ok: false, error: `Opportunity is ${job.status}, not OPEN` });
    }
    const existing = await prisma.application.findUnique({
      where: { jobId_studentProfileId: { jobId, studentProfileId } },
    });
    if (existing) {
      return res.status(409).json({ ok: false, error: "Already applied to this opportunity" });
    }
    const app = await prisma.application.create({ data: { jobId, studentProfileId } });
    res.status(201).json({ ok: true, data: app });
  } catch (err) {
    next(err);
  }
});

const patchBody = z.object({
  status: z.enum(["APPLIED", "SHORTLISTED", "REJECTED", "HIRED", "WITHDRAWN"]),
});

/** PATCH /api/applications/:id — guarded status transitions, else 422. */
router.patch("/:id", async (req, res, next) => {
  try {
    const parsed = patchBody.safeParse(req.body);
    if (!parsed.success) return sendInvalid(res, parsed.error);
    const current = await prisma.application.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ ok: false, error: "Application not found" });
    const to = parsed.data.status as Status;
    if (current.status === to) return res.json({ ok: true, data: current });
    if (!canTransition(current.status as Status, to)) {
      return res.status(422).json({
        ok: false,
        error: `Invalid transition: ${current.status} → ${to}. Terminal states cannot change.`,
      });
    }
    const updated = await prisma.application.update({
      where: { id: current.id },
      data: { status: to },
    });
    res.json({ ok: true, data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
