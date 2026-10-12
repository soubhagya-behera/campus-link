import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { parsePaging, sendInvalid } from "../lib/validate.js";
import { requireAuth, resolveStudentScope } from "../lib/auth.js";

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

/**
 * GET /api/applications — students see only their own (derived from auth;
 * an explicit other id is 403). Recruiters must filter by ?jobId= one of
 * their own company's postings (candidate view for their jobs only).
 * Placement sees everything.
 */
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { page, limit } = parsePaging(req);
    const role = req.auth?.role;
    const studentProfileId = String(req.query.studentProfileId ?? "").trim();
    const jobId = String(req.query.jobId ?? "").trim();
    const status = String(req.query.status ?? "").trim();
    const where: Record<string, unknown> = {
      ...(status ? { status: status as never } : {}),
    };
    if (role === "STUDENT") {
      if (studentProfileId && studentProfileId !== req.auth?.studentProfileId) {
        return res.status(403).json({ ok: false, error: "Insufficient permissions" });
      }
      if (!req.auth?.studentProfileId) {
        return res.status(403).json({ ok: false, error: "No student profile linked to this account" });
      }
      where.studentProfileId = req.auth.studentProfileId;
    } else if (role === "RECRUITER") {
      if (!jobId) {
        return res.status(403).json({ ok: false, error: "Filter by one of your opportunities (?jobId=)" });
      }
      const job = await prisma.jobOpportunity.findUnique({ where: { id: jobId } });
      if (!job || job.companyId !== req.auth?.companyId) {
        return res.status(403).json({ ok: false, error: "Insufficient permissions" });
      }
      where.jobId = jobId;
    } else {
      if (studentProfileId) where.studentProfileId = studentProfileId;
      if (jobId) where.jobId = jobId;
    }
    const [total, rows] = await Promise.all([
      prisma.application.count({ where }),
      prisma.application.findMany({
        where,
        orderBy: { appliedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          job: { include: { company: true } },
          student: { select: { id: true, fullName: true, enrollmentNo: true, branch: true } },
        },
      }),
    ]);
    res.json({
      ok: true,
      data: rows.map((a) => ({
        id: a.id,
        status: a.status,
        appliedAt: a.appliedAt,
        updatedAt: a.updatedAt,
        student: a.student,
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

/** Shared public shape for one application (list and single-read agree). */
export function publicApplication(a: {
  id: string;
  status: unknown;
  appliedAt: unknown;
  updatedAt: unknown;
  student: unknown;
  job: {
    id: string;
    title: string;
    company: { name: string };
    location: unknown;
    type: unknown;
    salary: unknown;
    deadline: unknown;
  };
}) {
  return {
    id: a.id,
    status: a.status,
    appliedAt: a.appliedAt,
    updatedAt: a.updatedAt,
    student: a.student,
    job: {
      id: a.job.id,
      title: a.job.title,
      company: a.job.company.name,
      location: a.job.location,
      type: a.job.type,
      salary: a.job.salary,
      deadline: a.job.deadline,
    },
  };
}

/**
 * GET /api/applications/:id — one application with candidate + job.
 * Placement sees any; students their own; recruiters applicants to their own
 * company's postings only. Powers the staff applicant-review screen.
 */
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const current = await prisma.application.findUnique({
      where: { id: req.params.id },
      include: {
        job: { include: { company: true } },
        student: { select: { id: true, fullName: true, enrollmentNo: true, branch: true } },
      },
    });
    if (!current) return res.status(404).json({ ok: false, error: "Application not found" });
    const role = req.auth?.role;
    const isOwner = role === "STUDENT" && req.auth?.studentProfileId === current.studentProfileId;
    const isJobRecruiter = role === "RECRUITER" && req.auth?.companyId === current.job.companyId;
    const isPlacement = role === "STAFF" || role === "ADMIN";
    if (!isOwner && !isJobRecruiter && !isPlacement) {
      return res.status(403).json({ ok: false, error: "Insufficient permissions" });
    }
    res.json({ ok: true, data: publicApplication(current) });
  } catch (err) {
    next(err);
  }
});

/** POST /api/applications — students apply as themselves (derived id);
 * placement may file for any profile; recruiters cannot apply. */
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) return sendInvalid(res, parsed.error);
    const role = req.auth?.role;
    if (role === "RECRUITER") {
      return res.status(403).json({ ok: false, error: "Recruiters cannot file applications" });
    }
    const studentProfileId =
      role === "STUDENT"
        ? resolveStudentScope(req, res, parsed.data.studentProfileId)
        : parsed.data.studentProfileId;
    if (!studentProfileId) return;
    const { jobId } = parsed.data;

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
    const app = await prisma.application.create({ data: { jobId, studentProfileId } }).catch((err: unknown) => {
      // Concurrent duplicate submits race the pre-check; the unique constraint
      // is the final arbiter and maps to the same 409.
      if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
        return null;
      }
      throw err;
    });
    if (!app) {
      return res.status(409).json({ ok: false, error: "Already applied to this opportunity" });
    }
    res.status(201).json({ ok: true, data: app });
  } catch (err) {
    next(err);
  }
});

const patchBody = z.object({
  status: z.enum(["APPLIED", "SHORTLISTED", "REJECTED", "HIRED", "WITHDRAWN"]),
});

/**
 * PATCH /api/applications/:id — guarded transitions AND guarded actors:
 * - WITHDRAWN: the applicant (own record) or placement.
 * - SHORTLISTED / REJECTED: recruiter of the posting's company, or placement.
 * - HIRED: placement only. APPLIED: no one (no backward moves).
 * Anything else is 403 — enforced here, not in the UI.
 */
router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const parsed = patchBody.safeParse(req.body);
    if (!parsed.success) return sendInvalid(res, parsed.error);
    const current = await prisma.application.findUnique({
      where: { id: req.params.id },
      include: { job: { select: { companyId: true } } },
    });
    if (!current) return res.status(404).json({ ok: false, error: "Application not found" });
    const to = parsed.data.status as Status;
    const role = req.auth?.role;
    const isOwner = role === "STUDENT" && req.auth?.studentProfileId === current.studentProfileId;
    const isJobRecruiter =
      role === "RECRUITER" && req.auth?.companyId === current.job.companyId;
    const isPlacement = role === "STAFF" || role === "ADMIN";
    if (!isOwner && !isJobRecruiter && !isPlacement) {
      return res.status(403).json({ ok: false, error: "Insufficient permissions" });
    }
    if (current.status === to) return res.json({ ok: true, data: current });
    if (!canTransition(current.status as Status, to)) {
      return res.status(422).json({
        ok: false,
        error: `Invalid transition: ${current.status} → ${to}. Terminal states cannot change.`,
      });
    }
    const actorAllowed =
      (to === "WITHDRAWN" && (isOwner || isPlacement)) ||
      ((to === "SHORTLISTED" || to === "REJECTED") && (isJobRecruiter || isPlacement)) ||
      (to === "HIRED" && isPlacement);
    if (!actorAllowed) {
      return res.status(403).json({ ok: false, error: "This transition requires a different role" });
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
