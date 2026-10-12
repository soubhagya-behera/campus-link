// The backend binds to IPv4-only 127.0.0.1, so the fallback must too:
// on Windows `localhost` can resolve to ::1 and refuse the connection.
const BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://127.0.0.1:4000";

export const API_BASE = BASE;

export interface ApiStatus {
  ok: boolean;
  latencyMs?: number;
}

async function timed<T>(fn: () => Promise<T>): Promise<{ data: T; ms: number }> {
  const t0 = performance.now();
  const data = await fn();
  return { data, ms: Math.round(performance.now() - t0) };
}

export async function fetchHealth(): Promise<ApiStatus> {
  try {
    const { ms } = await timed(() =>
      fetch(`${BASE}/api/health`).then((r) => {
        if (!r.ok) throw new Error("unhealthy");
        return r.json();
      }),
    );
    return { ok: true, latencyMs: ms };
  } catch {
    return { ok: false };
  }
}

export async function fetchReady(): Promise<ApiStatus> {
  try {
    const { ms } = await timed(() =>
      fetch(`${BASE}/api/ready`).then((r) => {
        if (!r.ok) throw new Error("not-ready");
        return r.json();
      }),
    );
    return { ok: true, latencyMs: ms };
  } catch {
    return { ok: false };
  }
}

export async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
