import { request } from "./server";

export interface ArenaPrompt {
  id: string;
  category: "Behavioral" | "Technical" | "Situational";
  prompt: string;
  hint: string;
}

export interface ManagedPrompt extends ArenaPrompt {
  isActive: boolean;
  authorId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArenaSession {
  id: string;
  studentProfileId: string;
  type: string;
  transcript: string | null;
  feedback: string | null;
  score: number | null;
  createdAt: string;
}

export interface ArenaActivity {
  id: string;
  student: { id: string; fullName: string; enrollmentNo: string | null };
  type: string;
  promptIds: string[];
  answers: { promptId: string; text: string }[];
  score: number | null;
  points: number;
  feedback: string | null;
  createdAt: string;
}

interface Envelope<T> {
  ok: boolean;
  data: T;
  method?: string;
  total?: number;
}

/** Curated prompt bank + scoring method. Any authenticated role. */
export function arenaPrompts(): Promise<{ data: ArenaPrompt[]; method: string; source: string }> {
  return request<Envelope<ArenaPrompt[]> & { source?: string }>("/api/arena/prompts").then((r) => ({
    data: r.data,
    method: r.method ?? "",
    source: r.source ?? "",
  }));
}

/** Start a persisted practice session. Students as themselves only. */
export function createArenaSession(input: {
  studentProfileId: string;
  type: string;
  promptIds: string[];
}): Promise<ArenaSession> {
  return request<Envelope<ArenaSession>>("/api/arena/sessions", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((r) => r.data);
}

/**
 * Grade answers server-side. Returns the scored session plus practice
 * points: pointsEarned for this round and the student's accumulated total.
 * Points derive from the server score only — never from client input.
 */
export function submitArenaAnswers(
  sessionId: string,
  answers: { promptId: string; text: string }[],
): Promise<{ session: ArenaSession; method: string; pointsEarned: number; totalPoints: number }> {
  return request<Envelope<ArenaSession> & { pointsEarned?: number; totalPoints?: number }>(
    `/api/arena/sessions/${sessionId}/answers`,
    { method: "POST", body: JSON.stringify({ answers }) },
  ).then((r) => ({
    session: r.data,
    method: r.method ?? "",
    pointsEarned: r.pointsEarned ?? 0,
    totalPoints: r.totalPoints ?? 0,
  }));
}

/** Own persisted sessions (owner or placement), plus accumulated points. */
export function arenaSessions(
  studentProfileId: string,
): Promise<{ data: ArenaSession[]; method: string; totalPoints: number }> {
  return request<Envelope<ArenaSession[]> & { totalPoints?: number }>(
    `/api/arena/sessions?studentProfileId=${studentProfileId}&limit=50`,
  ).then((r) => ({ data: r.data, method: r.method ?? "", totalPoints: r.totalPoints ?? 0 }));
}

/** Staff question bank, including inactive rows. */
export function arenaBank(): Promise<ManagedPrompt[]> {
  return request<Envelope<ManagedPrompt[]>>("/api/arena/bank").then((r) => r.data);
}

export function createPrompt(input: {
  prompt: string;
  category: string;
  hint?: string;
  isActive?: boolean;
}): Promise<ManagedPrompt> {
  return request<Envelope<ManagedPrompt>>("/api/arena/bank", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((r) => r.data);
}

export function updatePrompt(
  id: string,
  input: { prompt?: string; category?: string; hint?: string | null; isActive?: boolean },
): Promise<ManagedPrompt> {
  return request<Envelope<ManagedPrompt>>(`/api/arena/bank/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  }).then((r) => r.data);
}

export function deletePrompt(id: string): Promise<void> {
  return request(`/api/arena/bank/${id}`, { method: "DELETE" }).then(() => undefined);
}

/** Staff practice-activity review with optional server filters. */
export function arenaActivity(params?: {
  studentProfileId?: string;
  type?: string;
  promptId?: string;
}): Promise<{ data: ArenaActivity[]; total: number }> {
  const q = new URLSearchParams({
    ...(params?.studentProfileId ? { studentProfileId: params.studentProfileId } : {}),
    ...(params?.type ? { type: params.type } : {}),
    ...(params?.promptId ? { promptId: params.promptId } : {}),
    limit: "30",
  });
  return request<Envelope<ArenaActivity[]>>(`/api/arena/activity?${q}`).then((r) => ({
    data: r.data,
    total: r.total ?? r.data.length,
  }));
}
