import { AddressInfo } from "node:net";
import express, { type Express } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/prisma.js", () => ({
  default: {
    session: { findUnique: vi.fn() },
    studentProfile: { count: vi.fn(), findMany: vi.fn() },
  },
}));

const { default: prisma } = await import("../src/lib/prisma.js") as unknown as {
  default: {
    session: { findUnique: ReturnType<typeof vi.fn> };
    studentProfile: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  };
};
const { default: studentsRouter } = await import("../src/routes/students.js");

const ROW = {
  id: "sp-1",
  fullName: "Ada Lovelace",
  enrollmentNo: "21BFH987",
  branch: "CSE",
  graduationYear: 2027,
  cgpa: 8.4,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  user: { email: "ada@college.edu", role: "STUDENT" },
  skills: [{ skill: { name: "React" } }],
  _count: { apps: 2, projects: 1 },
};

function authAs(session: null | { role: string; studentProfileId?: string | null }) {
  const findUnique = prisma.session.findUnique as ReturnType<typeof vi.fn>;
  if (!session) {
    findUnique.mockResolvedValue(null);
    return;
  }
  findUnique.mockResolvedValue({
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
  (prisma.studentProfile.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);
  (prisma.studentProfile.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([ROW]);
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

function list(qs = "") {
  return fetch(`${base}/api/students${qs}`, {
    headers: { Cookie: "campuslink_session=tok" },
  }).then(async (r) => ({ status: r.status, body: (await r.json()) as Record<string, unknown> }));
}

describe("GET /api/students directory", () => {
  it("lets placement read summaries with email and creation date, no secrets", async () => {
    authAs({ role: "STAFF" });
    const r = await list();
    expect(r.status).toBe(200);
    const row = (r.body.data as Record<string, unknown>[])[0];
    expect(row.fullName).toBe("Ada Lovelace");
    expect(row.email).toBe("ada@college.edu");
    expect(row.enrollmentNo).toBe("21BFH987");
    expect(row.createdAt).toBe("2026-10-01T00:00:00.000Z");
    expect("passwordHash" in row).toBe(false);
    expect("password" in row).toBe(false);
  });

  it("searches name, roll number and email in one OR clause", async () => {
    authAs({ role: "ADMIN" });
    await list("?search=ada");
    const where = (prisma.studentProfile.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
    const ors = where.OR as Record<string, unknown>[];
    expect(ors).toHaveLength(3);
    expect(JSON.stringify(ors.some((o) => "user" in o))).toBe("true");
  });

  it("refuses students and signed-out callers", async () => {
    authAs({ role: "STUDENT", studentProfileId: "sp-1" });
    expect((await list()).status).toBe(403);
    authAs(null);
    const r = await fetch(`${base}/api/students`);
    expect(r.status).toBe(401);
  });
});
