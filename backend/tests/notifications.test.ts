import { AddressInfo } from "node:net";
import express, { type Express } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/prisma.js", () => ({
  default: {
    session: { findUnique: vi.fn() },
    announcement: { create: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    announcementRecipient: {
      createMany: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      groupBy: vi.fn(),
    },
    application: { findMany: vi.fn() },
    studentProfile: { findMany: vi.fn() },
    jobOpportunity: { findUnique: vi.fn() },
    company: { findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({})),
  },
}));

const { default: prisma } = await import("../src/lib/prisma.js") as unknown as {
  default: Record<string, Record<string, ReturnType<typeof vi.fn>>>;
};
const { default: announcementsRouter } = await import("../src/routes/announcements.js");
const { default: notificationsRouter } = await import("../src/routes/notifications.js");

const JOB = { id: "job-1", companyId: "co-1", company: { id: "co-1", name: "Virtusa" } };

function authAs(session: null | { role: string; studentProfileId?: string | null; companyId?: string | null }) {
  if (!session) {
    prisma.session.findUnique.mockResolvedValue(null);
    return;
  }
  prisma.session.findUnique.mockResolvedValue({
    tokenHash: "x",
    revokedAt: null,
    expiresAt: new Date(Date.now() + 3600_000),
    user: {
      id: session.role === "STAFF" ? "staff-1" : "u-1",
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
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({
      announcement: { create: prisma.announcement.create },
      announcementRecipient: { createMany: prisma.announcementRecipient.createMany },
    }),
  );
  prisma.jobOpportunity.findUnique.mockResolvedValue(JOB);
  prisma.company.findUnique.mockResolvedValue({ id: "co-1", name: "Virtusa" });
  prisma.studentProfile.findMany.mockResolvedValue([{ id: "sp-1" }, { id: "sp-2" }]);
  prisma.application.findMany.mockResolvedValue([{ studentProfileId: "sp-1" }]);
  prisma.announcement.create.mockResolvedValue({ id: "an-1", title: "T" });
  prisma.announcementRecipient.createMany.mockResolvedValue({ count: 1 });
  prisma.announcementRecipient.groupBy.mockResolvedValue([]);
  app = express();
  app.use(express.json());
  app.use("/api/announcements", announcementsRouter);
  app.use("/api/notifications", notificationsRouter);
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

const VALID = { title: "Pre-placement meeting", message: "All applicants must attend tomorrow at ten.", audience: "APPLIED", jobId: "job-1" };

describe("announcement publishing", () => {
  it("lets staff publish to drive applicants with the materialized count", async () => {
    authAs({ role: "STAFF" });
    const r = await call("POST", "/api/announcements", VALID);
    expect(r.status).toBe(201);
    expect((r.body.data as { recipientCount: number }).recipientCount).toBe(1);
    const where = prisma.application.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ jobId: "job-1", status: "APPLIED" });
  });

  it("targets SHORTLISTED exactly and INTERVIEW_SELECTED as HIRED", async () => {
    authAs({ role: "STAFF" });
    await call("POST", "/api/announcements", { ...VALID, audience: "SHORTLISTED" });
    expect(prisma.application.findMany.mock.calls[0][0].where).toMatchObject({ status: "SHORTLISTED" });
    vi.clearAllMocks();
    await call("POST", "/api/announcements", { ...VALID, audience: "INTERVIEW_SELECTED" });
    expect(prisma.application.findMany.mock.calls[0][0].where).toMatchObject({ status: "HIRED" });
  });

  it("refuses students, bad drives and empty audiences without writing", async () => {
    authAs({ role: "STUDENT", studentProfileId: "sp-1" });
    expect((await call("POST", "/api/announcements", VALID)).status).toBe(403);
    authAs({ role: "STAFF" });
    prisma.jobOpportunity.findUnique.mockResolvedValue(null);
    expect((await call("POST", "/api/announcements", VALID)).status).toBe(404);
    prisma.jobOpportunity.findUnique.mockResolvedValue(JOB);
    prisma.application.findMany.mockResolvedValue([]);
    const r = await call("POST", "/api/announcements", VALID);
    expect(r.status).toBe(422);
    expect(prisma.announcement.create).not.toHaveBeenCalled();
  });

  it("rejects short titles and drive-less targeted audiences", async () => {
    authAs({ role: "STAFF" });
    expect((await call("POST", "/api/announcements", { ...VALID, title: "Hi" })).status).toBe(400);
    expect((await call("POST", "/api/announcements", { ...VALID, jobId: undefined })).status).toBe(400);
  });
});

describe("student notifications", () => {
  it("isolates inboxes: students see only their own rows", async () => {
    authAs({ role: "STUDENT", studentProfileId: "sp-1" });
    prisma.announcementRecipient.findMany.mockResolvedValue([]);
    prisma.announcementRecipient.count.mockResolvedValue(0);
    const list = await call("GET", "/api/notifications");
    expect(list.status).toBe(200);
    expect(prisma.announcementRecipient.findMany.mock.calls[0][0].where).toMatchObject({
      studentProfileId: "sp-1",
    });
    const unread = await call("GET", "/api/notifications/unread-count");
    expect(unread.status).toBe(200);
    expect((unread.body.data as { count: number }).count).toBe(0);
  });

  it("reading one notice updates it and read-all stays scoped to the caller", async () => {
    authAs({ role: "STUDENT", studentProfileId: "sp-1" });
    prisma.announcementRecipient.findUnique.mockResolvedValue({
      id: "nr-1",
      studentProfileId: "sp-1",
      readAt: null,
    });
    prisma.announcementRecipient.update.mockResolvedValue({ id: "nr-1", readAt: new Date() });
    expect((await call("POST", "/api/notifications/nr-1/read")).status).toBe(200);
    expect(prisma.announcementRecipient.update.mock.calls[0][0].where).toMatchObject({ id: "nr-1" });
    prisma.announcementRecipient.updateMany.mockResolvedValue({ count: 2 });
    const all = await call("POST", "/api/notifications/read-all");
    expect(all.status).toBe(200);
    expect(prisma.announcementRecipient.updateMany.mock.calls[0][0].where).toMatchObject({
      studentProfileId: "sp-1",
      readAt: null,
    });
  });

  it("forbids reading another student's notification", async () => {
    authAs({ role: "STUDENT", studentProfileId: "sp-2" });
    prisma.announcementRecipient.findUnique.mockResolvedValue({
      id: "nr-1",
      studentProfileId: "sp-1",
      readAt: null,
    });
    expect((await call("POST", "/api/notifications/nr-1/read")).status).toBe(403);
    expect(prisma.announcementRecipient.update).not.toHaveBeenCalled();
  });
});
