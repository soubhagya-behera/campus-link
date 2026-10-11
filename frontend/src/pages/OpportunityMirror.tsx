import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, CircleAlert, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Card, DemoTag, Empty, ErrorState, Loading, Meter, SectionTitle } from "../components/ui";
import { ApiError, api } from "../lib/server";
import { useApplications, useMatches, useProfileId } from "../store/session";

export default function OpportunityMirror() {
  const profileId = useProfileId();
  const matches = useMatches(20);
  const applications = useApplications();
  const qc = useQueryClient();
  const [flash, setFlash] = useState<{ jobId: string; kind: "ok" | "dup" | "closed" } | null>(null);

  const applyMutation = useMutation({
    mutationFn: (jobId: string) => api.apply(jobId, profileId as string),
    onSuccess: (_d, jobId) => {
      setFlash({ jobId, kind: "ok" });
      void qc.invalidateQueries({ queryKey: ["applications"] });
      void qc.invalidateQueries({ queryKey: ["readiness"] });
      setTimeout(() => setFlash(null), 3000);
    },
    onError: (e, jobId) => {
      if (e instanceof ApiError && e.status === 409) setFlash({ jobId, kind: "dup" });
      else if (e instanceof ApiError && e.status === 422) setFlash({ jobId, kind: "closed" });
      else setFlash(null);
      setTimeout(() => setFlash(null), 3000);
    },
  });

  if (matches.isPending || applications.isPending) {
    return (
      <div>
        <SectionTitle kicker="Opportunity Mirror" title="Ranked by fit, explained in plain words" right={<DemoTag />} />
        <Loading label="Scoring persisted records…" />
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
    <div>
      <SectionTitle
        kicker="Opportunity Mirror"
        title="Ranked by fit, explained in plain words"
        sub="Scores come from your persisted skills and linked project evidence — never from hidden signals. Applying writes a real record."
        right={<DemoTag />}
      />

      <details className="mb-4 rounded-2xl border border-white/8 bg-ink-900/60 p-4 text-sm">
        <summary className="cursor-pointer font-semibold text-white">How scoring works — and its limits</summary>
        <p className="mt-2 leading-relaxed text-slate-300">{method}</p>
      </details>

      {ranked.length === 0 ? (
        <Empty
          title="No open opportunities"
          body="There are no OPEN postings in PostgreSQL right now. Ask the placement cell to publish the first drive — the Tower lists every opening."
          action={
            <Link
              to="/tower"
              className="inline-flex items-center gap-1.5 rounded-lg bg-signal-400 px-3 py-2 text-sm font-semibold text-ink-950"
            >
              Open Placement Tower <ArrowRight size={14} />
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {ranked.map((m, idx) => {
            const applied = apps.some((a) => a.job.id === m.job.id);
            return (
              <Card key={m.job.id} className="rise">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="font-display flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/5 text-lg font-bold text-signal-300">
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-lg font-bold text-white">{m.job.title}</p>
                      <Badge tone={m.score >= 70 ? "signal" : m.score >= 40 ? "sky" : "amber"}>
                        {m.score}% match
                      </Badge>
                      <span className="font-mono text-[11px] text-slate-500">
                        {m.job.company} · {m.job.location} · {m.job.type}
                        {m.job.salary ? ` · ${m.job.salary}` : ""}
                      </span>
                    </div>
                    <p className="mt-1 max-w-3xl text-sm text-slate-400">{m.job.description}</p>
                    <div className="mt-3 max-w-xl">
                      <Meter value={m.score} tone={m.score >= 70 ? "signal" : "sky"} />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    {applied ? (
                      <Link
                        to="/applications"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-signal-500/40 bg-signal-400/10 px-3 py-2 text-sm font-semibold text-signal-300"
                      >
                        <CheckCircle2 size={14} /> Applied — track
                      </Link>
                    ) : (
                      <button
                        onClick={() => applyMutation.mutate(m.job.id)}
                        disabled={applyMutation.isPending}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-signal-400 px-3 py-2 text-sm font-semibold text-ink-950 hover:bg-signal-300 disabled:opacity-50"
                      >
                        <Plus size={14} /> Apply now
                      </button>
                    )}
                    {m.job.deadline && (
                      <span className="font-mono text-[11px] text-slate-500">
                        closes {m.job.deadline.slice(0, 10)}
                      </span>
                    )}
                  </div>
                </div>

                {flash?.jobId === m.job.id && flash.kind === "ok" && (
                  <p className="mt-2 text-sm font-medium text-signal-300">
                    Application persisted — tracker and readiness updated from the server.
                  </p>
                )}
                {flash?.jobId === m.job.id && flash.kind === "dup" && (
                  <p className="mt-2 text-sm font-medium text-amber-300">
                    Already applied — the server refused the duplicate (409).
                  </p>
                )}
                {flash?.jobId === m.job.id && flash.kind === "closed" && (
                  <p className="mt-2 text-sm font-medium text-amber-300">
                    This posting is no longer OPEN, so applications are closed.
                  </p>
                )}

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      Why you match ({m.met.length})
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {m.factors
                        .filter((f) => f.kind !== "gap")
                        .map((f, i) => (
                          <li key={i} className="flex gap-2 text-sm">
                            {f.kind === "met" ? (
                              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-signal-400" />
                            ) : (
                              <Sparkles size={15} className="mt-0.5 shrink-0 text-sky-300" />
                            )}
                            <span>
                              <span className="font-medium text-slate-200">{f.label}</span>
                              <span className="text-slate-500"> — {f.detail}</span>
                            </span>
                          </li>
                        ))}
                      {m.met.length === 0 && m.bonuses.length === 0 && (
                        <li className="text-sm text-slate-500">No met requirements yet — a stretch role.</li>
                      )}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      What&apos;s missing ({m.gaps.length})
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {m.factors
                        .filter((f) => f.kind === "gap")
                        .map((f, i) => (
                          <li key={i} className="flex gap-2 text-sm">
                            <CircleAlert size={15} className="mt-0.5 shrink-0 text-amber-300" />
                            <span>
                              <span className="font-medium text-slate-200">{f.label}</span>
                              <span className="text-slate-500"> — {f.detail}</span>
                            </span>
                          </li>
                        ))}
                      {m.gaps.length === 0 && (
                        <li className="text-sm text-slate-400">Zero gaps on recorded skills.</li>
                      )}
                    </ul>
                    <p className="mt-2 border-t border-white/8 pt-2 text-sm text-slate-300">
                      <span className="font-semibold text-signal-300">Next step: </span>
                      {m.nextStep}{" "}
                      <Link
                        to="/sprint"
                        className="inline-flex items-center gap-0.5 font-medium text-signal-300 hover:underline"
                      >
                        open sprints <ArrowRight size={12} />
                      </Link>
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
