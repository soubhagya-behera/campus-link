import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import JobCard from "./JobCard";
import { DemoTag, Empty, ErrorState, Loading, NoStudentState, SectionTitle } from "../components/ui";
import "../components/student.css";
import { ApiError, api } from "../lib/server";
import { useApplications, useMatches, useProfileId, useSessionUser } from "../store/session";

export default function OpportunityMirror() {
  const profileId = useProfileId();
  const user = useSessionUser();
  const matches = useMatches(20);
  const applications = useApplications();
  const qc = useQueryClient();
  const [flash, setFlash] = useState<{ jobId: string; kind: "ok" | "dup" | "closed" } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const applyMutation = useMutation({
    mutationFn: (jobId: string) => api.apply(jobId, profileId as string),
    onSuccess: (_d, jobId) => {
      setFlash({ jobId, kind: "ok" });
      setPendingId(null);
      void qc.invalidateQueries({ queryKey: ["applications"] });
      void qc.invalidateQueries({ queryKey: ["readiness"] });
      // Staff review list + tower counts read the same records.
      void qc.invalidateQueries({ queryKey: ["staff-applications"] });
      void qc.invalidateQueries({ queryKey: ["tower"] });
      setTimeout(() => setFlash(null), 3000);
    },
    onError: (e, jobId) => {
      if (e instanceof ApiError && e.status === 409) setFlash({ jobId, kind: "dup" });
      else if (e instanceof ApiError && e.status === 422) setFlash({ jobId, kind: "closed" });
      else setFlash(null);
      setPendingId(null);
      setTimeout(() => setFlash(null), 3000);
    },
  });

  const apply = (jobId: string) => {
    if (applyMutation.isPending) return;
    setPendingId(jobId);
    applyMutation.mutate(jobId);
  };

  if (user && !user.studentProfileId) {
    return <NoStudentState kicker="Opportunity Mirror" title="Ranked by fit, explained in plain words" />;
  }

  if (matches.isPending || applications.isPending) {
    return (
      <div>
        <SectionTitle kicker="Opportunity Mirror" title="Ranked by fit, explained in plain words" right={<DemoTag />} />
        <Loading label="Scoring your matches…" />
      </div>
    );
  }
  if (matches.isError) {
    return (
      <div>
        <SectionTitle kicker="Opportunity Mirror" title="Ranked by fit, explained in plain words" right={<DemoTag />} />
        <ErrorState
          message={matches.error instanceof Error ? matches.error.message : "Matches failed to load"}
          onRetry={() => void qc.invalidateQueries({ queryKey: ["matches"] })}
        />
      </div>
    );
  }

  const ranked = matches.data?.data ?? [];
  const method = matches.data?.method ?? "";
  const apps = applications.data ?? [];

  return (
    <div className="sw sw-enter">
      <SectionTitle
        kicker="Opportunity Mirror"
        title="Ranked by fit, explained in plain words"
        sub="Scores come from your recorded skills and project evidence. Applying writes a real record."
        right={<DemoTag />}
      />

      {ranked.length === 0 ? (
        <Empty
          title="No open opportunities"
          body="There are no open postings right now. New drives appear here as soon as the placement cell publishes them — meanwhile, sprints keep your record growing."
          action={
            <Link
              to="/sprint"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-signal-400 px-3 py-2 text-sm font-semibold text-ink-950"
            >
              Practice with Skill Sprint <ArrowRight size={14} />
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {ranked.map((m) => (
            <JobCard
              key={m.job.id}
              match={m}
              application={apps.find((a) => a.job.id === m.job.id) ?? null}
              applying={pendingId === m.job.id}
              flash={flash?.jobId === m.job.id ? flash.kind : null}
              onApply={apply}
            />
          ))}
        </div>
      )}

      {method ? (
        <details className="mt-6 rounded-xl border border-[var(--ws-line)] bg-[var(--ws-surface)] p-4 text-sm">
          <summary className="cursor-pointer font-semibold text-[var(--ws-forest)]">
            How match scores work
          </summary>
          <p className="mt-2 leading-relaxed text-[var(--ws-mute)]">{method}</p>
        </details>
      ) : null}
    </div>
  );
}
