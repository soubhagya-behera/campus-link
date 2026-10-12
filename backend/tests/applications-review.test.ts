import { AddressInfo } from "node:net";
import express, { type Express } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/prisma.js", () => ({
  default: {
    session: { findUnique: vi.fn() },
    application: { findUnique: vi.fn() },
  },
}));

// Imported after the mock so the route (and auth) bind to the fake client.
const { default: prisma } = await import("../src/lib/prisma.js") as unknown as {
  default: { session: { findUnique: ReturnType<typeof vi.fn> }; application: { findUnique: ReturnType<typeof vi.fn> } };
};
const { default: applicationsRouter } = await import("../src/routes/applications.js");

const ROW = {
  id: "app-1",
  status: "APPLIED",
  appliedAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-02T00:00:00Z"),
  studentProfileId: "sp-1",
  student: { id: "sp-1", fullName: "Ada Lovelace", enrollmentNo: "21BFH987", branch: "CSE" },
  job: {
    id: "job-1",
    companyId: "co-1",
    title: "Frontend Intern",
    company: { name: "Zenith Pay" },
    location: "Bengaluru",
    type: "INTERNSHIP",
    salary: null,
    deadline: null,
  },
};

function authAs(session: null | {
  role: string;
  companyId?: string | null;
  studentProfileId?: string | null;
}) {
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
      companyId: session.companyId ?? null,
      studentProfile: session.studentProfileId ? { id: session.studentProfileId } : null,
    },
  });
}

let app: Express;
let server: ReturnType<Express["listen"]>;
let base = "";

beforeEach(async () => {
  vi.clearAllMocks();
  (prisma.application.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(ROW);
  app = express();
  app.use(express.json());
  app.use("/api/applications", applicationsRouter);
  // JSON error surface so failures assert on bodies, not HTML.
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

function get(id: string, authed = true) {
  return fetch(`${base}/api/applications/${id}`, {
    headers: authed ? { Cookie: "campuslink_session=tok" } : {},
  }).then(async (r) => ({ status: r.status, body: (await r.json()) as Record<string, unknown> }));
}

describe("GET /api/applications/:id", () => {
  it("lets placement read any application with candidate + job data", async () => {
    authAs({ role: "STAFF" });
    const r = await get("app-1");
    expect(r.status).toBe(200);
    const data = r.body.data as Record<string, unknown>;
    expect(data.id).toBe("app-1");
    expect(data.status).toBe("APPLIED");
    expect((data.student as { fullName: string }).fullName).toBe("Ada Lovelace");
    expect((data.job as { company: string }).company).toBe("Zenith Pay");
  });

  it("rejects unauthenticated reads with 401", async () => {
    authAs(null);
    const r = await get("app-1", false);
    expect(r.status).toBe(401);
  });

  it("lets a student read their own application but not another's", async () => {
    authAs({ role: "STUDENT", studentProfileId: "sp-1" });
    expect((await get("app-1")).status).toBe(200);
    authAs({ role: "STUDENT", studentProfileId: "sp-other" });
    const r = await get("app-1");
    expect(r.status).toBe(403);
  });

  it("scopes recruiters to their own company's postings", async () => {
    authAs({ role: "RECRUITER", companyId: "co-1" });
    expect((await get("app-1")).status).toBe(200);
    authAs({ role: "RECRUITER", companyId: "co-other" });
    expect((await get("app-1")).status).toBe(403);
  });

  it("returns 404 for an unknown application", async () => {
    authAs({ role: "ADMIN" });
    (prisma.application.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect((await get("missing")).status).toBe(404);
  });
});
