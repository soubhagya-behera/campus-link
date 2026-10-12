import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import {
  MATCH_METHOD,
  READINESS_METHOD,
  isLevel,
  matchRequirements,
  readinessScore,
  type Requirement,
  type SkillInput,
} from "../lib/match.js";
import { LEVEL, parsePaging, sendInvalid } from "../lib/validate.js";
import { requireAuth, requireRole, resolveStudentScope } from "../lib/auth.js";

const router = Router();

/** Parse the Json requiredSkills column defensively (never trust raw JSON shape). */
function parseRequirements(raw: unknown): Requirement[] {
  if (!Array.isArray(raw)) return [];
  const out: Requirement[] = [];
  for (const item of raw.slice(0, 25)) {
    if (
      typeof item === "object" &&
      item !== null &&
      typeof (item as Record<string, unknown>).skill === "string" &&
      isLevel((item as Record<string, unknown>).minLevel)
    ) {
      const rec = item as Record<string, unknown>;
      const skill = (rec.skill as string).trim().slice(0, 60);
      if (skill) out.push({ skill, minLevel: rec.minLevel as Requirement["minLevel"] });
    }
  }
  return out;
}

/** GET /api/students — placement-only directory (STAFF/ADMIN). Includes the
 *  account email and record creation date staff need; no passwords or hashes. */
router.get("/", requireAuth, requireRole("STAFF", "ADMIN"), async (req, res, next) => {
  try {
    const { page, limit } = parsePaging(req);
    const search = String(req.query.search ?? "").trim();
    const branch = String(req.query.branch ?? "").trim();
    const where = {
      ...(branch ? { branch } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" as const } },
              { enrollmentNo: { contains: search, mode: "insensitive" as const } },
              { user: { email: { contains: search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.studentProfile.count({ where }),
      prisma.studentProfile.findMany({
        where,
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { email: true, role: true } },
          skills: { include: { skill: true } },
          _count: { select: { apps: true, projects: true } },
        },
      }),
    ]);
    res.json({
      ok: true,
      data: rows.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        email: p.user?.email ?? null,
        enrollmentNo: p.enrollmentNo,
        branch: p.branch,
        graduationYear: p.graduationYear,
        cgpa: p.cgpa,
        createdAt: p.createdAt,
        skillCount: p.skills.length,
        applicationCount: p._count.apps,
        projectCount: p._count.projects,
      })),
      page,
      limit,
      total,
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/students/:id — owner or placement only. Recruiters use job-scoped candidate views. */
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const id = resolveStudentScope(req, res, req.params.id);
    if (!id) return;
    const profile = await prisma.studentProfile.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, role: true } },
        skills: { include: { skill: true } },
        projects: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!profile) return res.status(404).json({ ok: false, error: "Student profile not found" });
    const evidenceBySkill = new Map<string, string[]>();
    for (const project of profile.projects) {
      for (const s of project.skills) {
        const key = s.toLowerCase();
        if (!evidenceBySkill.has(key)) evidenceBySkill.set(key, []);
        evidenceBySkill.get(key)?.push(project.id);
      }
    }
    res.json({
      ok: true,
      data: {
        id: profile.id,
        fullName: profile.fullName,
        email: profile.user?.email ?? null,
        enrollmentNo: profile.enrollmentNo,
        branch: profile.branch,
        institution: profile.institution,
        graduationYear: profile.graduationYear,
        cgpa: profile.cgpa,
        resumeUrl: profile.resumeUrl,
        createdAt: profile.createdAt,
        skills: profile.skills.map((ss) => ({
          id: ss.id,
          skill: ss.skill.name,
          level: ss.level,
          evidence: evidenceBySkill.get(ss.skill.name.toLowerCase()) ?? [],
        })),
        projects: profile.projects,
      },
    });
  } catch (err) {
    next(err);
  }
});

const skillsBody = z.object({
  skills: z
    .array(z.object({ skill: z.string().trim().min(1).max(60), level: LEVEL }))
    .min(1)
    .max(30),
});

/**
 * PATCH /api/students/:id/skills — record or update claimed levels.
 * Levels are self-reported until linked project evidence exists; the Twin shows the difference.
 */
router.patch("/:id/skills", requireAuth, async (req, res, next) => {
  try {
    const parsed = skillsBody.safeParse(req.body);
    if (!parsed.success) return sendInvalid(res, parsed.error);
    const id = resolveStudentScope(req, res, req.params.id);
    if (!id) return;
    const profile = await prisma.studentProfile.findUnique({ where: { id } });
    if (!profile) return res.status(404).json({ ok: false, error: "Student profile not found" });

    const seen = new Set<string>();
    const deduped = parsed.data.skills.filter((s) => {
      const k = s.skill.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    await prisma.$transaction(async (tx) => {
      for (const s of deduped) {
        const skill = await tx.skill.upsert({
          where: { name: s.skill },
          update: {},
          create: { name: s.skill },
        });
        await tx.studentSkill.upsert({
          where: {
            studentProfileId_skillId: { studentProfileId: profile.id, skillId: skill.id },
          },
          update: { level: s.level },
          create: { studentProfileId: profile.id, skillId: skill.id, level: s.level },
        });
      }
    });
    res.json({ ok: true, updated: deduped.length });
  } catch (err) {
    next(err);
  }
});

const skillPatchBody = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    level: LEVEL.optional(),
  })
  .refine((b) => b.name !== undefined || b.level !== undefined, {
    message: "Provide a name and/or level to update",
  });

/**
 * PATCH /api/students/:id/skills/:skillId — rename and/or re-level one
 * recorded skill. Names stay unique per student (case-insensitive): a clash
 * with another of their skills is 409. Renaming only re-links the catalog
 * entry — projects keep their skill names, so evidence is never destroyed.
 */
router.patch("/:id/skills/:skillId", requireAuth, async (req, res, next) => {
  try {
    const parsed = skillPatchBody.safeParse(req.body);
    if (!parsed.success) return sendInvalid(res, parsed.error);
    const id = resolveStudentScope(req, res, req.params.id);
    if (!id) return;
    const link = await prisma.studentSkill.findUnique({
      where: { id: req.params.skillId },
      include: { skill: true },
    });
    if (!link || link.studentProfileId !== id) {
      return res.status(404).json({ ok: false, error: "Recorded skill not found" });
    }
    let skillId = link.skillId;
    if (parsed.data.name !== undefined && parsed.data.name.toLowerCase() !== link.skill.name.toLowerCase()) {
      const clash = await prisma.studentSkill.findFirst({
        where: {
          studentProfileId: id,
          skill: { name: { equals: parsed.data.name, mode: "insensitive" } },
        },
        select: { id: true },
      });
      if (clash) {
        return res.status(409).json({ ok: false, error: "That skill is already recorded — adjust its level instead." });
      }
      const target = await prisma.skill.upsert({
        where: { name: parsed.data.name },
        update: {},
        create: { name: parsed.data.name },
      });
      skillId = target.id;
    }
    const updated = await prisma.studentSkill.update({
      where: { id: link.id },
      data: {
        skillId,
        ...(parsed.data.level !== undefined ? { level: parsed.data.level } : {}),
      },
      include: { skill: true },
    });
    res.json({ ok: true, data: { id: updated.id, skill: updated.skill.name, level: updated.level } });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/students/:id/skills/:skillId — remove one recorded skill.
 * Deletes only the link row: projects, attempts and sessions are untouched,
 * so history and evidence survive. Afterwards the skill simply stops
 * matching until re-recorded.
 */
router.delete("/:id/skills/:skillId", requireAuth, async (req, res, next) => {
  try {
    const id = resolveStudentScope(req, res, req.params.id);
    if (!id) return;
    const link = await prisma.studentSkill.findUnique({ where: { id: req.params.skillId } });
    if (!link || link.studentProfileId !== id) {
      return res.status(404).json({ ok: false, error: "Recorded skill not found" });
    }
    await prisma.studentSkill.delete({ where: { id: link.id } });
    res.json({ ok: true, data: { id: link.id } });
  } catch (err) {
    next(err);
  }
});

const projectBody = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).optional(),
  url: z.string().trim().url().max(500).optional(),
  skills: z.array(z.string().trim().min(1).max(60)).max(15).default([]),
});

/** POST /api/students/:id/projects — owner or placement only. */
router.post("/:id/projects", requireAuth, async (req, res, next) => {
  try {
    const parsed = projectBody.safeParse(req.body);
    if (!parsed.success) return sendInvalid(res, parsed.error);
    const id = resolveStudentScope(req, res, req.params.id);
    if (!id) return;
    const profile = await prisma.studentProfile.findUnique({ where: { id } });
    if (!profile) return res.status(404).json({ ok: false, error: "Student profile not found" });

    const skillNames = [...new Set(parsed.data.skills.map((s) => s.trim()).filter(Boolean))];
    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          studentProfileId: profile.id,
          title: parsed.data.title,
          description: parsed.data.description,
          url: parsed.data.url,
          skills: skillNames,
        },
      });
      // Ensure every claimed skill exists as a record (default BEGINNER — evidence, not mastery).
      for (const name of skillNames) {
        const skill = await tx.skill.upsert({ where: { name }, update: {}, create: { name } });
        await tx.studentSkill.upsert({
          where: { studentProfileId_skillId: { studentProfileId: profile.id, skillId: skill.id } },
          update: {},
          create: { studentProfileId: profile.id, skillId: skill.id, level: "BEGINNER" },
        });
      }
      return created;
    });
    res.status(201).json({ ok: true, data: project });
  } catch (err) {
    next(err);
  }
});

async function loadSkillInputs(studentProfileId: string): Promise<SkillInput[]> {
  const [links, projects] = await Promise.all([
    prisma.studentSkill.findMany({
      where: { studentProfileId },
      include: { skill: true },
    }),
    prisma.project.findMany({ where: { studentProfileId } }),
  ]);
  const evidenceBySkill = new Map<string, string[]>();
  for (const p of projects) {
    for (const s of p.skills) {
      const key = s.toLowerCase();
      if (!evidenceBySkill.has(key)) evidenceBySkill.set(key, []);
      evidenceBySkill.get(key)?.push(p.id);
    }
  }
  return links.map((l) => ({
    skill: l.skill.name,
    level: l.level,
    evidence: evidenceBySkill.get(l.skill.name.toLowerCase()) ?? [],
  }));
}

/**
 * GET /api/students/:id/matches — ranked opportunities with inspectable scoring.
 * Query: ?status=OPEN (default), ?limit=20, ?includeExpired=false.
 * Past-deadline OPEN postings are treated as expired and excluded by default;
 * they are never recommended as available. Tie-break is deterministic:
 * score desc, deadline asc (nulls last), id asc.
 */
router.get("/:id/matches", requireAuth, async (req, res, next) => {
  try {
    const id = resolveStudentScope(req, res, req.params.id);
    if (!id) return;
    const profile = await prisma.studentProfile.findUnique({ where: { id } });
    if (!profile) return res.status(404).json({ ok: false, error: "Student profile not found" });
    const status = String(req.query.status ?? "OPEN");
    const includeExpired = String(req.query.includeExpired ?? "false").toLowerCase() === "true";
    const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const now = new Date();

    const [skillInputs, jobs] = await Promise.all([
      loadSkillInputs(profile.id),
      prisma.jobOpportunity.findMany({
        where: status === "ALL" ? {} : { status: status as never },
        orderBy: { createdAt: "desc" },
        take: limit * 3,
        include: { company: true },
      }),
    ]);

    const ranked = jobs
      .filter((job) => includeExpired || !job.deadline || job.deadline >= now)
      .map((job) => {
        const required = parseRequirements(job.requiredSkills);
        const result = matchRequirements(required, job.niceToHave, skillInputs);
        return {
          job: {
            id: job.id,
            title: job.title,
            company: job.company.name,
            location: job.location,
            type: job.type,
            status: job.status,
            seniority: job.seniority,
            salary: job.salary,
            deadline: job.deadline,
            description: job.description,
            required,
            niceToHave: job.niceToHave,
          },
          ...result,
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const da = a.job.deadline ? new Date(a.job.deadline).getTime() : Number.POSITIVE_INFINITY;
        const db = b.job.deadline ? new Date(b.job.deadline).getTime() : Number.POSITIVE_INFINITY;
        if (da !== db) return da - db;
        return a.job.id < b.job.id ? -1 : a.job.id > b.job.id ? 1 : 0;
      })
      .slice(0, limit);

    res.json({ ok: true, method: MATCH_METHOD, data: ranked });
  } catch (err) {
    next(err);
  }
});

/** GET /api/students/:id/readiness — owner or placement only. */
router.get("/:id/readiness", requireAuth, async (req, res, next) => {
  try {
    const id = resolveStudentScope(req, res, req.params.id);
    if (!id) return;
    const profile = await prisma.studentProfile.findUnique({ where: { id } });
    if (!profile) return res.status(404).json({ ok: false, error: "Student profile not found" });
    const [skillInputs, appCount, evaluated] = await Promise.all([
      loadSkillInputs(profile.id),
      prisma.application.count({ where: { studentProfileId: profile.id } }),
      prisma.assessmentAttempt.count({
        where: { studentProfileId: profile.id, status: "EVALUATED" },
      }),
    ]);
    const score = readinessScore(
      skillInputs.map((s) => ({ level: s.level, evidenced: s.evidence.length > 0 })),
      appCount,
      evaluated,
    );
    res.json({
      ok: true,
      data: {
        score,
        method: READINESS_METHOD,
        inputs: {
          recordedSkills: skillInputs.length,
          evidencedSkills: skillInputs.filter((s) => s.evidence.length > 0).length,
          applications: appCount,
          evaluatedSprints: evaluated,
        },
        skills: skillInputs,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
