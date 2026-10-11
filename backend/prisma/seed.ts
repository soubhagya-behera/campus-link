/**
 * DEVELOPMENT SEED — explicitly synthetic demonstration content.
 * Lives only in the local database; the UI marks seed-backed views accordingly.
 * Never presented as real placements, partnerships, or outcomes.
 *
 * Run: npm run prisma:seed
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SKILLS: { name: string; level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT" }[] = [
  { name: "TypeScript", level: "INTERMEDIATE" },
  { name: "React", level: "INTERMEDIATE" },
  { name: "UI Design", level: "BEGINNER" },
  { name: "Node.js", level: "BEGINNER" },
  { name: "PostgreSQL", level: "BEGINNER" },
  { name: "Python", level: "INTERMEDIATE" },
  { name: "Data Viz", level: "BEGINNER" },
  { name: "DSA", level: "INTERMEDIATE" },
  { name: "Communication", level: "INTERMEDIATE" },
];

async function main(): Promise<void> {
  // Demo student identity (fixed ids so the frontend can resolve it).
  await prisma.user.upsert({
    where: { email: "demo.student@campuslink.local" },
    update: {},
    create: {
      id: "demo-student-user",
      email: "demo.student@campuslink.local",
      passwordHash: "NOT_SET_DEMO_SEED",
      role: "STUDENT",
    },
  });
  await prisma.studentProfile.upsert({
    where: { id: "demo-student-profile" },
    update: {},
    create: {
      id: "demo-student-profile",
      userId: "demo-student-user",
      fullName: "Aarav Sharma",
      enrollmentNo: "CS2027-041",
      branch: "CSE",
      graduationYear: 2027,
      cgpa: 8.4,
    },
  });

  for (const s of SKILLS) {
    const skill = await prisma.skill.upsert({ where: { name: s.name }, update: {}, create: { name: s.name } });
    await prisma.studentSkill.upsert({
      where: { studentProfileId_skillId: { studentProfileId: "demo-student-profile", skillId: skill.id } },
      update: { level: s.level },
      create: { studentProfileId: "demo-student-profile", skillId: skill.id, level: s.level },
    });
  }

  const projects = [
    {
      id: "demo-proj-courseforge",
      title: "CourseForge — cohort learning marketplace",
      description: "Full-stack course marketplace. Built the entire React + TypeScript frontend.",
      skills: ["TypeScript", "React"],
    },
    {
      id: "demo-proj-messmate",
      title: "MessMate — hostel mess companion",
      description: "Menu planner and feedback loop. Ran user interviews; shipped a design system.",
      skills: ["React", "UI Design", "Communication"],
    },
    {
      id: "demo-proj-attendx",
      title: "AttendX — attendance forecasting",
      description: "Python pipeline predicting attendance dips, with a dashboard for wardens.",
      skills: ["Python"],
    },
  ];
  for (const p of projects) {
    await prisma.project.upsert({
      where: { id: p.id },
      update: { skills: p.skills },
      create: { ...p, studentProfileId: "demo-student-profile" },
    });
  }

  const companies = ["Zenith Pay", "Northloop Logistics", "CivicLens", "Finchline", "Papertrail Health"];
  const companyIds: Record<string, string> = {};
  for (const name of companies) {
    const c = await prisma.company.upsert({ where: { name }, update: {}, create: { name } });
    companyIds[name] = c.id;
  }

  const jobs = [
    {
      id: "demo-job-fe-intern",
      company: "Zenith Pay",
      title: "Frontend Engineering Intern",
      description: "Ship merchant-dashboard features in React + TypeScript. Weekly design pairing; own a11y for your surfaces.",
      location: "Bengaluru · Hybrid",
      type: "INTERNSHIP" as const,
      salary: "₹45K/mo",
      deadline: new Date("2026-10-25T00:00:00Z"),
      requiredSkills: [
        { skill: "React", minLevel: "INTERMEDIATE" },
        { skill: "TypeScript", minLevel: "INTERMEDIATE" },
        { skill: "UI Design", minLevel: "BEGINNER" },
      ],
      niceToHave: ["Communication"],
    },
    {
      id: "demo-job-fullstack-jr",
      company: "Northloop Logistics",
      title: "Junior Full-Stack Developer",
      description: "Own tracking-page features end to end across React and Node + Postgres.",
      location: "Remote",
      type: "FULL_TIME" as const,
      salary: "₹9–12 LPA",
      deadline: new Date("2026-11-02T00:00:00Z"),
      requiredSkills: [
        { skill: "React", minLevel: "INTERMEDIATE" },
        { skill: "Node.js", minLevel: "INTERMEDIATE" },
        { skill: "PostgreSQL", minLevel: "INTERMEDIATE" },
        { skill: "TypeScript", minLevel: "INTERMEDIATE" },
      ],
      niceToHave: ["DSA", "Communication"],
    },
    {
      id: "demo-job-data-intern",
      company: "CivicLens",
      title: "Data Analyst Intern",
      description: "Turn civic-complaint data into weekly insight packs. SQL daily; one stakeholder-readable chart pack weekly.",
      location: "Delhi · On-site",
      type: "INTERNSHIP" as const,
      salary: "₹30K/mo",
      deadline: new Date("2026-10-28T00:00:00Z"),
      requiredSkills: [
        { skill: "Python", minLevel: "INTERMEDIATE" },
        { skill: "PostgreSQL", minLevel: "BEGINNER" },
        { skill: "Data Viz", minLevel: "BEGINNER" },
      ],
      niceToHave: ["Communication"],
    },
    {
      id: "demo-job-be-intern",
      company: "Finchline",
      title: "Backend Engineering Intern",
      description: "Build ledger APIs in Node + Postgres with strict review bars. Deep SQL and load-test Fridays.",
      location: "Hyderabad · Hybrid",
      type: "INTERNSHIP" as const,
      salary: "₹40K/mo",
      deadline: new Date("2026-11-08T00:00:00Z"),
      requiredSkills: [
        { skill: "Node.js", minLevel: "INTERMEDIATE" },
        { skill: "PostgreSQL", minLevel: "INTERMEDIATE" },
        { skill: "DSA", minLevel: "INTERMEDIATE" },
      ],
      niceToHave: ["TypeScript"],
    },
    {
      id: "demo-job-ui-contract",
      company: "Papertrail Health",
      title: "Product Design Engineer (Contract)",
      description: "Prototype patient-facing flows; hand production-ready React to the platform team.",
      location: "Remote",
      type: "CONTRACT" as const,
      salary: "₹1.1L/mo",
      deadline: new Date("2026-10-20T00:00:00Z"),
      requiredSkills: [
        { skill: "React", minLevel: "ADVANCED" },
        { skill: "UI Design", minLevel: "ADVANCED" },
        { skill: "TypeScript", minLevel: "INTERMEDIATE" },
      ],
      niceToHave: ["Communication"],
    },
  ];
  for (const j of jobs) {
    const { company, ...rest } = j;
    await prisma.jobOpportunity.upsert({
      where: { id: j.id },
      update: {
        title: j.title,
        description: j.description,
        location: j.location,
        type: j.type,
        status: "OPEN",
        salary: j.salary,
        deadline: j.deadline,
        requiredSkills: j.requiredSkills,
        niceToHave: j.niceToHave,
      },
      create: { ...rest, status: "OPEN", companyId: companyIds[company] },
    });
  }

  const assessments = [
    {
      id: "demo-assess-react-a11y",
      title: "Accessible data table, production-grade",
      description: "Sortable, filterable React + TypeScript data table with full keyboard support and ARIA roles. Submit repo link + 5-line a11y write-up.",
      rewardSkill: "React",
    },
    {
      id: "demo-assess-sql-ledger",
      title: "Seven queries that save a ledger",
      description: "Seven queries over a messy ledger schema: window functions, a CTE refactor, one index justification with timings.",
      rewardSkill: "PostgreSQL",
    },
    {
      id: "demo-assess-viz-pack",
      title: "One chart pack that changes a decision",
      description: "Three charts + 60-word recommendation from open complaints data that a non-technical warden can act on.",
      rewardSkill: "Data Viz",
    },
  ];
  for (const a of assessments) {
    await prisma.assessment.upsert({ where: { id: a.id }, update: a, create: a });
  }

  // Seed applications (idempotent): shortlisted + applied.
  for (const [jobId, status] of [["demo-job-fe-intern", "SHORTLISTED"], ["demo-job-data-intern", "APPLIED"]] as const) {
    await prisma.application.upsert({
      where: { jobId_studentProfileId: { jobId, studentProfileId: "demo-student-profile" } },
      update: {},
      create: { jobId, studentProfileId: "demo-student-profile", status },
    });
  }

  // eslint-disable-next-line no-console
  console.log("Demo seed installed: 1 student, 9 skills, 3 projects, 5 companies, 5 jobs, 3 assessments, 2 applications.");
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error("Seed failed:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
