import { AddressInfo } from "node:net";
import express, { type Express } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/prisma.js", () => ({
  default: {
    session: { findUnique: vi.fn() },
    studentSkill: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
    skill: { upsert: vi.fn() },
  },
}));

const { default: prisma } = await import("../src/lib/prisma.js") as unknown as {
  default: Record<string, Record<string, ReturnType<typeof vi.fn>>>;
};
const { default: studentsRouter } = await import("../src/routes/students.js");

const LINK = { id: "link-1", studentProfileId: "sp-1", skillId: "sk-docker", skill: { id: "sk-docker", name: "Docker" } };

function authAs(session: null | { role: string; studentProfileId?: string | null }) {
  if (!session) {
    prisma.session.findUnique.mockResolvedValue(null);
    return;
  }
  prisma.session.findUnique.mockResolvedValue({
    tokenHash: "x",
    revokedAt: null,
    expiresAt: new Date(Date.now() + 3600_000),
    user: {
      id: "u-1",
      email: "tester@college.local",
      isActive: true,
      role: session.role,
      companyId: null,
      studentProfile: session.studentProfileId ? { id: session.studentProfileId } : null,
    },
  });
}

let app: Express;
let server: ReturnType<Express["listen"]>;
let base = "";

beforeEach(async () => {
  vi.clearAllMocks();
  prisma.studentSkill.findUnique.mockResolvedValue(LINK);
  prisma.studentSkill.findFirst.mockResolvedValue(null);
  prisma.skill.upsert.mockResolvedValue({ id: "sk-k8s", name: "Kubernetes" });
  prisma.studentSkill.update.mockResolvedValue({ id: "link-1", skill: { name: "Kubernetes" }, level: "BEGINNER" });
  app = express();
  app.use(express.json());
  app.use("/api/students", studentsRouter);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ ok: false, error: "Internal server error" });
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((e) => (e ? reject(e) : resolve()));
  });
});

function call(method: string, path: string, body?: unknown) {
  return fetch(`${base}${path}`, {
    method,
    headers: { Cookie: "campuslink_session=tok", "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, body: (await r.json()) as Record<string, unknown> }));
}

describe("skill rename", () => {
  it("renames and re-levels an owned skill", async () => {
    authAs({ role: "STUDENT", studentProfileId: "sp-1" });
    const r = await call("PATCH", "/api/students/sp-1/skills/link-1", { name: "Kubernetes", level: "INTERMEDIATE" });
    expect(r.status).toBe(200);
    expect(prisma.skill.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: "Kubernetes" } }),
    );
  });

  it("rejects a case-insensitive duplicate name with 409", async () => {
    authAs({ role: "STUDENT", studentProfileId: "sp-1" });
    prisma.studentSkill.findFirst.mockResolvedValue({ id: "link-2" });
    const r = await call("PATCH", "/api/students/sp-1/skills/link-1", { name: "kubernetes" });
    expect(r.status).toBe(409);
    expect(prisma.studentSkill.update).not.toHaveBeenCalled();
  });

  it("rejects empty names and cross-student edits", async () => {
    authAs({ role: "STUDENT", studentProfileId: "sp-1" });
    expect((await call("PATCH", "/api/students/sp-1/skills/link-1", { name: " " })).status).toBe(400);
    expect((await call("PATCH", "/api/students/sp-1/skills/link-1", {})).status).toBe(400);
    authAs({ role: "STUDENT", studentProfileId: "sp-other" });
    expect((await call("PATCH", "/api/students/sp-1/skills/link-1", { level: "EXPERT" })).status).toBe(403);
  });
});

describe("skill delete", () => {
  it("deletes only the link row, preserving projects and history", async () => {
    authAs({ role: "STUDENT", studentProfileId: "sp-1" });
    prisma.studentSkill.delete.mockResolvedValue(LINK);
    const r = await call("DELETE", "/api/students/sp-1/skills/link-1");
    expect(r.status).toBe(200);
    expect(prisma.studentSkill.delete).toHaveBeenCalledWith({ where: { id: "link-1" } });
  });

  it("404s unknown rows and 403s other students' rows", async () => {
    authAs({ role: "STUDENT", studentProfileId: "sp-1" });
    prisma.studentSkill.findUnique.mockResolvedValue(null);
    expect((await call("DELETE", "/api/students/sp-1/skills/nope")).status).toBe(404);
    prisma.studentSkill.findUnique.mockResolvedValue({ ...LINK, studentProfileId: "sp-other" });
    expect((await call("DELETE", "/api/students/sp-1/skills/link-1")).status).toBe(404);
  });
});
