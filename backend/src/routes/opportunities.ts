import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { parsePaging, sendInvalid } from "../lib/validate.js";
import { LEVEL } from "../lib/validate.js";
import { requireAuth } from "../lib/auth.js";

const router = Router();

const requirementSchema = z.object({
  skill: z.string().trim().min(1).max(60),
  minLevel: LEVEL,
});

const createBody = z.object({
  companyName: z.string().trim().min(2).max(120).optional(),
  companyId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().min(10).max(5000),
  location: z.string().trim().max(120).optional(),
  type: z.enum(["INTERNSHIP", "FULL_TIME", "PART_TIME", "CONTRACT"]).default("FULL_TIME"),
  status: z.enum(["DRAFT", "OPEN", "CLOSED"]).default("OPEN"),
  seniority: z.string().trim().min(1).max(40).optional(),
  salary: z.string().trim().max(60).optional(),
  deadline: z.string().datetime({ offset: true }).optional(),
  requiredSkills: z.array(requirementSchema).max(12).default([]),
  niceToHave: z.array(z.string().trim().min(1).max(60)).max(12).default([]),
});

/**
 * GET /api/opportunities — authenticated reads. Students see only OPEN,
 * non-expired postings (filters for other statuses are ignored for them).
 * Recruiters see OPEN postings plus their own company's any-status postings.
 * Placement sees everything per filters.
 */
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { page, limit } = parsePaging(req);
    const role = req.auth?.role;
    const status = String(req.query.status ?? "OPEN");
    const type = String(req.query.type ?? "").trim();
    const search = String(req.query.search ?? "").trim();
    const now = new Date();
    const clauses: object[] = [];
    if (type) clauses.push({ type: type as never });
    if (search) {
      clauses.push({
        OR: [
          { title: { contains: search, mode: "insensitive" as const } },
          { description: { contains: search, mode: "insensitive" as const } },
          { company: { name: { contains: search, mode: "insensitive" as const } } },
        ],
      });
    }
    const fresh = { OR: [{ deadline: null }, { deadline: { gte: now } }] };
    if (role === "STUDENT") {
      clauses.push({ status: "OPEN" as never }, fresh);
    } else if (role === "RECRUITER") {
      const own = req.auth?.companyId ? { companyId: req.auth.companyId } : null;
      clauses.push({
        OR: [{ status: "OPEN" as never, ...fresh }, ...(own ? [own] : [])],
      });
    } else if (status !== "ALL") {
      clauses.push({ status: status as never });
    }
    const where = clauses.length > 0 ? { AND: clauses } : {};
    const [total, rows] = await Promise.all([
      prisma.jobOpportunity.count({ where }),
      prisma.jobOpportunity.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { company: true, _count: { select: { apps: true } } },
      }),
    ]);
    res.json({
      ok: true,
      data: rows.map((j) => ({
        id: j.id,
        title: j.title,
        company: j.company.name,
        companyId: j.companyId,
        location: j.location,
        type: j.type,
        status: j.status,
        seniority: j.seniority,
        salary: j.salary,
        deadline: j.deadline,
        description: j.description,
        requiredSkills: j.requiredSkills,
        niceToHave: j.niceToHave,
        applicationCount: j._count.apps,
        createdAt: j.createdAt,
      })),
      page,
      limit,
      total,
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/opportunities/:id — same visibility rules as the list (404 when hidden). */
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const job = await prisma.jobOpportunity.findUnique({
      where: { id: req.params.id },
      include: { company: true, _count: { select: { apps: true } } },
    });
    if (!job) return res.status(404).json({ ok: false, error: "Opportunity not found" });
    const role = req.auth?.role;
    const fresh = !job.deadline || job.deadline >= new Date();
    const visible =
      role === "STAFF" ||
      role === "ADMIN" ||
      (job.status === "OPEN" && fresh) ||
      (role === "RECRUITER" && req.auth?.companyId === job.companyId);
    if (!visible) return res.status(404).json({ ok: false, error: "Opportunity not found" });
    res.json({
      ok: true,
      data: {
        id: job.id,
        title: job.title,
        company: job.company.name,
        companyId: job.companyId,
        location: job.location,
        type: job.type,
        status: job.status,
        seniority: job.seniority,
        salary: job.salary,
        deadline: job.deadline,
        description: job.description,
        requiredSkills: job.requiredSkills,
        niceToHave: job.niceToHave,
        applicationCount: job._count.apps,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/opportunities — placement, or recruiter for their OWN company
 * (client-supplied company is ignored for recruiters). Students denied.
 */
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const role = req.auth?.role;
    if (role !== "RECRUITER" && role !== "STAFF" && role !== "ADMIN") {
      return res.status(403).json({ ok: false, error: "Insufficient permissions" });
    }
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) return sendInvalid(res, parsed.error);
    const { companyId, companyName } = parsed.data;
    if (role === "RECRUITER" && !req.auth?.companyId) {
      return res.status(403).json({ ok: false, error: "Recruiter account has no company association" });
    }
    if (!companyId && !companyName) {
      return res.status(400).json({ ok: false, error: "Provide companyId or companyName" });
    }
    const company =
      role === "RECRUITER"
        ? await prisma.company.findUnique({ where: { id: req.auth?.companyId as string } })
        : companyId
          ? await prisma.company.findUnique({ where: { id: companyId } })
          : await prisma.company.upsert({
              where: { name: companyName as string },
              update: {},
              create: { name: companyName as string },
            });
    if (!company) return res.status(404).json({ ok: false, error: "Company not found" });

    const job = await prisma.jobOpportunity.create({
      data: {
        companyId: company.id,
        title: parsed.data.title,
        description: parsed.data.description,
        location: parsed.data.location,
        type: parsed.data.type,
        status: parsed.data.status,
        seniority: parsed.data.seniority,
        salary: parsed.data.salary,
        deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : undefined,
        requiredSkills: parsed.data.requiredSkills,
        niceToHave: [...new Set(parsed.data.niceToHave)],
      },
      include: { company: true },
    });
    res.status(201).json({ ok: true, data: { ...job, company: job.company.name } });
  } catch (err) {
    next(err);
  }
});

const patchBody = z
  .object({
    title: z.string().trim().min(3).max(140).optional(),
    description: z.string().trim().min(10).max(5000).optional(),
    location: z.string().trim().max(120).nullable().optional(),
    type: z.enum(["INTERNSHIP", "FULL_TIME", "PART_TIME", "CONTRACT"]).optional(),
    status: z.enum(["DRAFT", "OPEN", "CLOSED"]).optional(),
    seniority: z.string().trim().min(1).max(40).nullable().optional(),
    salary: z.string().trim().max(60).nullable().optional(),
    deadline: z.string().datetime({ offset: true }).nullable().optional(),
    requiredSkills: z.array(requirementSchema).max(12).optional(),
    niceToHave: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), {
    message: "Provide at least one field to update",
  });

/**
 * PATCH /api/opportunities/:id — placement, or recruiter for their OWN
 * company's postings only. No delete endpoint: CLOSED is the terminal state.
 */
router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const role = req.auth?.role;
    if (role !== "RECRUITER" && role !== "STAFF" && role !== "ADMIN") {
      return res.status(403).json({ ok: false, error: "Insufficient permissions" });
    }
    const parsed = patchBody.safeParse(req.body);
    if (!parsed.success) return sendInvalid(res, parsed.error);
    const existing = await prisma.jobOpportunity.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ ok: false, error: "Opportunity not found" });
    if (role === "RECRUITER" && existing.companyId !== req.auth?.companyId) {
      return res.status(403).json({ ok: false, error: "Insufficient permissions" });
    }
    const b = parsed.data;
    const updated = await prisma.jobOpportunity.update({
      where: { id: existing.id },
      data: {
        ...(b.title !== undefined ? { title: b.title } : {}),
        ...(b.description !== undefined ? { description: b.description } : {}),
        ...(b.location !== undefined ? { location: b.location } : {}),
        ...(b.type !== undefined ? { type: b.type } : {}),
        ...(b.status !== undefined ? { status: b.status } : {}),
        ...(b.seniority !== undefined ? { seniority: b.seniority } : {}),
        ...(b.salary !== undefined ? { salary: b.salary } : {}),
        ...(b.deadline !== undefined ? { deadline: b.deadline ? new Date(b.deadline) : null } : {}),
        ...(b.requiredSkills !== undefined ? { requiredSkills: b.requiredSkills } : {}),
        ...(b.niceToHave !== undefined ? { niceToHave: [...new Set(b.niceToHave)] } : {}),
      },
      include: { company: true },
    });
    res.json({ ok: true, data: { ...updated, company: updated.company.name } });
  } catch (err) {
    next(err);
  }
});

export default router;
