import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";
import { api } from "../lib/server";

const client = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: false },
  },
});

const ProfileIdContext = createContext<string | null>(null);

export function useProfileId(): string | null {
  return useContext(ProfileIdContext);
}

function IdentityGate({ children }: { children: ReactNode }) {
  const identity = useQuery({
    queryKey: ["demo-identity"],
    queryFn: api.demoIdentity,
    retry: 1,
  });

  if (identity.isPending) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-center px-8 py-24 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-signal-400" />
        <p className="mt-4 text-sm text-slate-400">Connecting to the local API…</p>
      </div>
    );
  }

  if (identity.isError || !identity.data) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-24">
        <div className="rounded-2xl border border-rose-400/30 bg-rose-400/[0.06] p-8 text-center">
          <p className="font-display text-xl font-bold text-white">Backend unavailable</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            The frontend is running, but no API answered at{" "}
            <span className="font-mono text-xs">{import.meta.env.VITE_API_BASE_URL}</span>. If the
            message mentions the demo seed, run it once in the backend folder:
          </p>
          <pre className="mx-auto mt-4 w-fit rounded-lg bg-ink-950 px-4 py-2 font-mono text-xs text-signal-300">
            npm run prisma:seed
          </pre>
          <button
            onClick={() => identity.refetch()}
            className="mt-5 rounded-lg bg-signal-400 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-signal-300"
          >
            Retry connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <ProfileIdContext.Provider value={identity.data.studentProfileId}>
      {children}
    </ProfileIdContext.Provider>
  );
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
    queryFn: () => api.applications(id as string),
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

export function useTower() {
  return useQuery({ queryKey: ["tower"], queryFn: api.towerStats });
}

export { client as queryClient };
