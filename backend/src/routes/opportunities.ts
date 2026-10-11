import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { parsePaging, sendInvalid } from "../lib/validate.js";
import { LEVEL } from "../lib/validate.js";

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
  salary: z.string().trim().max(60).optional(),
  deadline: z.string().datetime({ offset: true }).optional(),
  requiredSkills: z.array(requirementSchema).max(12).default([]),
  niceToHave: z.array(z.string().trim().min(1).max(60)).max(12).default([]),
});

/** GET /api/opportunities — real records with search/status/type filters + pagination. */
router.get("/", async (req, res, next) => {
  try {
    const { page, limit } = parsePaging(req);
    const status = String(req.query.status ?? "OPEN");
    const type = String(req.query.type ?? "").trim();
    const search = String(req.query.search ?? "").trim();
    const where = {
      ...(status === "ALL" ? {} : { status: status as never }),
      ...(type ? { type: type as never } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              { description: { contains: search, mode: "insensitive" as const } },
              { company: { name: { contains: search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };
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

/** GET /api/opportunities/:id */
router.get("/:id", async (req, res, next) => {
  try {
    const job = await prisma.jobOpportunity.findUnique({
      where: { id: req.params.id },
      include: { company: true, _count: { select: { apps: true } } },
    });
    if (!job) return res.status(404).json({ ok: false, error: "Opportunity not found" });
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
 * POST /api/opportunities — create a posting (placement use).
 * DEV LIMITATION: no auth yet; exposed for local development only.
 */
router.post("/", async (req, res, next) => {
  try {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) return sendInvalid(res, parsed.error);
    const { companyId, companyName } = parsed.data;
    if (!companyId && !companyName) {
      return res.status(400).json({ ok: false, error: "Provide companyId or companyName" });
    }
    const company = companyId
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

export default router;
