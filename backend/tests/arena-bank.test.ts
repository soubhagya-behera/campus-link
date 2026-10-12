import { AddressInfo } from "node:net";
import express, { type Express } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pointsForScore, promptIdsValidWith } from "../src/lib/arena.js";

vi.mock("../src/lib/prisma.js", () => ({
  default: {
    session: { findUnique: vi.fn() },
    arenaPrompt: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    interviewSession: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
    arenaPointLedger: { findMany: vi.fn(), upsert: vi.fn() },
  },
}));

const { default: prisma } = await import("../src/lib/prisma.js") as unknown as {
  default: Record<string, Record<string, ReturnType<typeof vi.fn>>>;
};
const { default: arenaBankRouter } = await import("../src/routes/arena-bank.js");
const { default: arenaRouter } = await import("../src/routes/arena.js");

const Q = { id: "q-1", category: "Behavioral", prompt: "Tell me about a conflict.", hint: null, isActive: true };

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
  prisma.arenaPrompt.findMany.mockResolvedValue([Q]);
  prisma.arenaPrompt.findUnique.mockResolvedValue(Q);
  prisma.interviewSession.count.mockResolvedValue(0);
  app = express();
  app.use(express.json());
  app.use("/api/arena", arenaRouter);
  app.use("/api/arena", arenaBankRouter);
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

describe("staff question bank", () => {
  it("lets staff create questions; refuses students and short prompts", async () => {
    authAs({ role: "STAFF" });
    prisma.arenaPrompt.create.mockResolvedValue(Q);
    const ok = await call("POST", "/api/arena/bank", { prompt: "Tell me about a conflict you resolved.", category: "Behavioral" });
    expect(ok.status).toBe(201);
    authAs({ role: "STUDENT", studentProfileId: "sp-1" });
    expect((await call("POST", "/api/arena/bank", { prompt: "Tell me about a conflict you resolved.", category: "Behavioral" })).status).toBe(403);
    authAs({ role: "STAFF" });
    expect((await call("POST", "/api/arena/bank", { prompt: "Too short", category: "Behavioral" })).status).toBe(400);
  });

  it("blocks deletion when sessions reference the question, allows deactivation", async () => {
    authAs({ role: "STAFF" });
    prisma.interviewSession.count.mockResolvedValue(3);
    expect((await call("DELETE", "/api/arena/bank/q-1")).status).toBe(409);
    prisma.interviewSession.count.mockResolvedValue(0);
    prisma.arenaPrompt.delete.mockResolvedValue(Q);
    expect((await call("DELETE", "/api/arena/bank/q-1")).status).toBe(200);
    prisma.arenaPrompt.update.mockResolvedValue({ ...Q, isActive: false });
    const off = await call("PATCH", "/api/arena/bank/q-1", { isActive: false });
    expect(off.status).toBe(200);
  });

  it("shows students active questions only", async () => {
    authAs({ role: "STUDENT", studentProfileId: "sp-1" });
    await call("GET", "/api/arena/prompts");
    expect(prisma.arenaPrompt.findMany.mock.calls[0][0]).toMatchObject({ where: { isActive: true } });
  });

  it("scores server-side and upserts one ledger row per session on re-answer", async () => {
    authAs({ role: "STUDENT", studentProfileId: "sp-1" });
    prisma.interviewSession.findUnique.mockResolvedValue({
      id: "ses-1",
      studentProfileId: "sp-1",
      transcript: JSON.stringify({ promptIds: ["arena-behavioral-1"], answers: [] }),
    });
    prisma.interviewSession.update.mockResolvedValue({ id: "ses-1", score: 80 });
    prisma.arenaPointLedger.findMany.mockResolvedValue([{ points: 8 }]);
    const words = Array.from({ length: 85 }, (_, i) => `word${i}`).join(" ");
    const r = await call("POST", "/api/arena/sessions/ses-1/answers", {
      answers: [{ promptId: "arena-behavioral-1", text: `${words} I measured 900ms because of tradeoff` }],
    });
    expect(r.status).toBe(200);
    // 35 + 30 (85 words) + 15 (number) + 10 (reasoning) = 90 → 9 points,
    // single upsert keyed by session.
    expect(prisma.arenaPointLedger.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sessionId: "ses-1" } }),
    );
    expect((r.body as { pointsEarned: number }).pointsEarned).toBe(9);
  });
});

describe("arena points rule", () => {
  it("derives 0–10 from the score, never from the client", () => {
    expect(pointsForScore(100)).toBe(10);
    expect(pointsForScore(85)).toBe(8);
    expect(pointsForScore(9)).toBe(0);
    expect(pointsForScore(-5)).toBe(0);
  });

  it("keeps static prompt ids valid alongside managed ones", () => {
    expect(promptIdsValidWith(["arena-behavioral-1"], [])).toBe(true);
    expect(promptIdsValidWith(["q-9"], ["q-9"])).toBe(true);
    expect(promptIdsValidWith(["nope"], ["q-9"])).toBe(false);
  });
});
