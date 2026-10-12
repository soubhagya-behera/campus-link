import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ApiError, api, type Role, type SessionUser } from "../lib/server";
import { arenaPrompts, arenaSessions } from "../lib/arena";

const client = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: false },
  },
});

export type SessionStatus = "loading" | "authenticated" | "unauthenticated" | "error";

export interface Session {
  status: SessionStatus;
  user: SessionUser | null;
  error: string | null;
  retry: () => void;
}

const SessionContext = createContext<Session>({
  status: "loading",
  user: null,
  error: null,
  retry: () => {},
});

/** The full session: identity, role, status. Prefer this over the helpers. */
export function useSession(): Session {
  return useContext(SessionContext);
}

export function useSessionUser(): SessionUser | null {
  return useContext(SessionContext).user;
}

export function useRole(): Role | null {
  return useContext(SessionContext).user?.role ?? null;
}

/** True for the placement roles that the backend's STAFF/ADMIN gates accept. */
export function isPlacement(user: SessionUser | null): boolean {
  return user?.role === "STAFF" || user?.role === "ADMIN";
}

export function useProfileId(): string | null {
  return useContext(SessionContext).user?.studentProfileId ?? null;
}

/** Where the gate sends a signed-out visitor, so login can bring them back. */
function loginTarget(pathname: string, search: string): string {
  const here = `${pathname}${search}`;
  return `/login?next=${encodeURIComponent(here)}`;
}

/**
 * The session gate for every authenticated route.
 *
 * Reads the live session from GET /api/auth/me — the same cookie the login
 * and registration responses set. A routine 401 means "signed out" and
 * redirects to /login; anything else (no network, 5xx) is a genuine outage
 * with a retry button. Nothing here invents a user.
 */
function IdentityGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: api.me,
    retry: false,
    staleTime: 30_000,
  });

  if (session.isPending) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-center px-8 py-24 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-signal-400" />
        <p className="mt-4 text-sm text-slate-400">Checking your session…</p>
      </div>
    );
  }

  if (session.isError) {
    const err = session.error;
    // Signed out is routine, not an outage: hand over to the login page.
    if (err instanceof ApiError && err.status === 401) {
      return <Navigate to={loginTarget(location.pathname, location.search)} replace />;
    }
    // The API is down or failing — say exactly that, and offer a retry.
    return (
      <div className="mx-auto max-w-2xl px-8 py-24">
        <div className="rounded-2xl border border-rose-400/30 bg-rose-400/[0.06] p-8 text-center">
          <p className="font-display text-xl font-bold text-white">Sign-in service unavailable</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            {err instanceof ApiError && err.status === 0
              ? "No API answered — start it once in the backend folder:"
              : `The API answered with an error (${err instanceof ApiError ? err.status : "?"}).`}
          </p>
          <pre className="mx-auto mt-4 w-fit rounded-lg bg-ink-950 px-4 py-2 font-mono text-xs text-signal-300">
            npm run dev
          </pre>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => void session.refetch()}
              className="rounded-lg bg-signal-400 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-signal-300"
            >
              Retry
            </button>
            <Link
              to="/"
              className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white"
            >
              Back to home
            </Link>
          </div>
          <p className="mt-4 font-mono text-[11px] text-slate-500">
            API at {import.meta.env.VITE_API_BASE_URL}
          </p>
        </div>
      </div>
    );
  }

  if (!session.data) {
    return <Navigate to={loginTarget(location.pathname, location.search)} replace />;
  }

  const value: Session = {
    status: "authenticated",
    user: session.data,
    error: null,
    retry: () => void session.refetch(),
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <IdentityGate>{children}</IdentityGate>
    </QueryClientProvider>
  );
}

export function useProfile() {
  const id = useProfileId();
  return useQuery({
    queryKey: ["profile", id],
    queryFn: () => api.profile(id as string),
    enabled: !!id,
  });
}

export function useReadiness() {
  const id = useProfileId();
  return useQuery({
    queryKey: ["readiness", id],
    queryFn: () => api.readiness(id as string),
    enabled: !!id,
  });
}

export function useMatches(limit = 20) {
  const id = useProfileId();
  return useQuery({
    queryKey: ["matches", id, limit],
    queryFn: () => api.matches(id as string, limit),
    enabled: !!id,
  });
}

export function useApplications() {
  const id = useProfileId();
  return useQuery({
    queryKey: ["applications", id],
    queryFn: () => api.applications({ studentProfileId: id as string }),
    enabled: !!id,
  });
}

export function useAssessments() {
  return useQuery({ queryKey: ["assessments"], queryFn: api.assessments });
}

export function useAttempts() {
  const id = useProfileId();
  return useQuery({
    queryKey: ["attempts", id],
    queryFn: () => api.attempts(id as string),
    enabled: !!id,
  });
}

export function useTower(enabled = true) {
  return useQuery({ queryKey: ["tower"], queryFn: api.towerStats, enabled });
}

export function useArenaPrompts() {
  return useQuery({ queryKey: ["arena-prompts"], queryFn: arenaPrompts, staleTime: 5 * 60_000 });
}

export function useArenaSessions() {
  const id = useProfileId();
  return useQuery({
    queryKey: ["arena-sessions", id],
    queryFn: () => arenaSessions(id as string),
    enabled: !!id,
  });
}

export { client as queryClient };
