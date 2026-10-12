import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarClock, Crosshair, ListChecks, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Badge, Card, DemoTag, ErrorState, Loading, Meter, Ring, SectionTitle } from "../components/ui";
import { ApiError } from "../lib/server";
import { useApplications, useMatches, useProfile, useProfileId, useReadiness, useSessionUser } from "../store/session";
import { api } from "../lib/server";
import "./Dashboard.css";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const profileId = useProfileId();
  const user = useSessionUser();
  const profile = useProfile();
  const readiness = useReadiness();
  const matches = useMatches(3);
  const applications = useApplications();
  const qc = useQueryClient();
  const [flash, setFlash] = useState<{ jobId: string; kind: "ok" | "dup" | "error"; message?: string } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  // Entrance animation gate: meters and the ring render at zero, then ease
  // to their real server values on the next frame. Text always shows truth.
  const [live, setLive] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setLive(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // /app is the student overview. Placement staff land on their own
  // overview instead; recruiter accounts get an explicit unavailable-portal
  // state (no recruiter portal exists in this build) rather than student nav.
  if (user && !user.studentProfileId) {
    if (user.role === "STAFF" || user.role === "ADMIN") {
      return <Navigate to="/tower" replace />;
    }
    return (
      <div>
        <SectionTitle kicker="Overview" title="Recruiter portal unavailable" right={<DemoTag />} />
        <Card className="p-6">
          <p className="text-sm leading-relaxed text-slate-300">
            This account is signed in as <span className="font-semibold text-white">{user.email}</span> with
            the recruiter role. There is no recruiter portal for this account — ask your placement cell for
            assistance.
          </p>
        </Card>
      </div>
    );
  }

  if (profile.isPending || readiness.isPending || matches.isPending || applications.isPending) {
    return (
      <div>
        <SectionTitle kicker="Student overview" title="Loading your workspace…" right={<DemoTag />} />
        <Loading label="Reading PostgreSQL records…" />
      </div>
    );
  }

  const err = profile.error ?? readiness.error ?? matches.error ?? applications.error;
  if (err) {
    return (
      <div>
        <SectionTitle kicker="Student overview" title="Workspace unavailable" right={<DemoTag />} />
        <ErrorState
          message={err instanceof Error ? err.message : "Failed to load workspace"}
          onRetry={() => void qc.invalidateQueries()}
        />
      </div>
    );
  }

  const name = profile.data?.fullName.split(" ")[0] ?? "there";
  const score = readiness.data?.score ?? 0;
  const ranked = matches.data?.data ?? [];
  const apps = applications.data ?? [];
  const top = ranked[0];
  const activeApps = apps.filter((a) => a.status === "APPLIED" || a.status === "SHORTLISTED");

  // Same visible states as Opportunity Mirror: pending, success, duplicate,
  // failure. Every outcome is shown; nothing is thrown into the void.
  const applyQuick = async (jobId: string) => {
    if (!profileId || pendingId) return;
    setPendingId(jobId);
    setFlash(null);
    try {
      await api.apply(jobId, profileId);
      setFlash({ jobId, kind: "ok" });
      await qc.invalidateQueries({ queryKey: ["applications"] });
      await qc.invalidateQueries({ queryKey: ["readiness"] });
      await qc.invalidateQueries({ queryKey: ["staff-applications"] });
      await qc.invalidateQueries({ queryKey: ["tower"] });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setFlash({ jobId, kind: "dup" });
      } else {
        setFlash({ jobId, kind: "error", message: e instanceof Error ? e.message : "Application failed." });
      }
    } finally {
      setPendingId(null);
      setTimeout(() => setFlash((f) => (f?.jobId === jobId ? null : f)), 4000);
    }
  };

  return (
    <div className="db">
      <SectionTitle
        kicker="Student overview"
        title={`${greeting()}, ${name}.`}
        sub="Live from PostgreSQL: your recorded skills, ranked matches, and the next move."
        right={<DemoTag />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rise db-card flex items-center gap-5">
          <Ring value={live ? score : 0} />
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
              Career readiness
            </p>
            <p className="font-display mt-1 text-lg font-bold text-white">
              {score >= 70 ? "Placement-ready" : score >= 40 ? "Gaining momentum" : "Building foundations"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {readiness.data?.inputs.recordedSkills} skills ·{" "}
              {readiness.data?.inputs.evidencedSkills} evidenced · {readiness.data?.inputs.applications}{" "}
              applications
            </p>
            <Link
              to="/twin"
              className="db-link mt-2 inline-flex items-center gap-1 text-sm font-medium text-signal-300 hover:underline"
            >
              How is this computed? <ArrowRight size={14} />
            </Link>
          </div>
        </Card>

        <Card className="rise rise-1 db-card">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Application pipeline
          </p>
          <div className="mt-3 flex items-end gap-6">
            <div>
              <p className="font-display text-4xl font-bold text-white">{apps.length}</p>
              <p className="text-xs text-slate-500">persisted applications</p>
            </div>
            <div className="flex-1 space-y-2 pb-1">
              {(["SHORTLISTED", "APPLIED", "REJECTED"] as const).map((s) => {
                const n = apps.filter((a) => a.status === s).length;
                return (
                  <div key={s} className="flex items-center gap-2 text-xs">
                    <span className="w-24 shrink-0 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                      {s}
                    </span>
                    <Meter
                      value={live && apps.length ? (n / apps.length) * 100 : 0}
                      tone={s === "SHORTLISTED" ? "signal" : s === "APPLIED" ? "sky" : "amber"}
                    />
                    <span className="w-4 text-right font-mono text-slate-400">{n}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <Link
            to="/applications"
            className="db-link mt-3 inline-flex items-center gap-1 text-sm font-medium text-signal-300 hover:underline"
          >
            Open tracker <ArrowRight size={14} />
          </Link>
        </Card>

        <Card className="rise rise-2 db-card">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
            Top gaps across open roles
          </p>
          {top && top.gaps.length > 0 ? (
            <ul className="mt-3 space-y-2.5">
              {top.gaps.slice(0, 4).map((g) => (
                <li key={g.skill} className="flex items-center gap-2 text-sm">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  <span className="text-slate-200">{g.skill}</span>
                  <span className="ml-auto font-mono text-[11px] text-slate-500">
                    needs {g.minLevel}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-400">
              {top ? "No gaps on your top match — strong fit." : "No open opportunities to analyze yet."}
            </p>
          )}
          <Link
            to="/mirror"
            className="db-link mt-3 inline-flex items-center gap-1 text-sm font-medium text-signal-300 hover:underline"
          >
            Inspect matches <ArrowRight size={14} />
          </Link>
        </Card>
      </div>

      <h2 className="font-display mt-8 text-lg font-bold text-white">Next actions</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        <Card className="rise rise-1 db-card flex flex-col">
          <Crosshair size={20} className="db-action-icon text-signal-400" />
          <p className="mt-3 font-semibold text-white">
            {top && top.gaps.length > 0 ? `Close the “${top.gaps[0].skill}” gap` : "Apply to your top match"}
          </p>
          <p className="mt-1 flex-1 text-sm text-slate-400">{top?.nextStep ?? "No open roles right now."}</p>
          <Link
            to="/sprint"
            className="db-btn mt-4 inline-flex w-fit items-center gap-1.5 rounded-lg bg-signal-400 px-3 py-1.5 text-sm font-semibold text-ink-950 hover:bg-signal-300"
          >
            Start sprint <ArrowRight size={14} />
          </Link>
        </Card>
        <Card className="rise rise-2 db-card flex flex-col">
          <CalendarClock size={20} className="db-action-icon text-signal-400" />
          <p className="mt-3 font-semibold text-white">
            {activeApps.length > 0 ? "Move an active file forward" : "No live applications"}
          </p>
          <p className="mt-1 flex-1 text-sm text-slate-400">
            {activeApps.length > 0
              ? `${activeApps[0].job.title} · ${activeApps[0].job.company} — applied ${activeApps[0].appliedAt.slice(0, 10)}`
              : "Your ranked matches are one click away."}
          </p>
          <Link
            to={activeApps.length > 0 ? "/applications" : "/mirror"}
            className="db-btn mt-4 inline-flex w-fit items-center gap-1.5 rounded-lg bg-signal-400 px-3 py-1.5 text-sm font-semibold text-ink-950 hover:bg-signal-300"
          >
            {activeApps.length > 0 ? "Track applications" : "Find matches"} <ArrowRight size={14} />
          </Link>
        </Card>
        <Card className="rise rise-3 db-card flex flex-col">
          <Sparkles size={20} className="db-action-icon text-signal-400" />
          <p className="mt-3 font-semibold text-white">Rehearse the story behind your evidence</p>
          <p className="mt-1 flex-1 text-sm text-slate-400">
            Rule-based practice rounds turn shipped projects into interview answers.
          </p>
          <Link
            to="/arena"
            className="db-btn mt-4 inline-flex w-fit items-center gap-1.5 rounded-lg bg-signal-400 px-3 py-1.5 text-sm font-semibold text-ink-950 hover:bg-signal-300"
          >
            Enter arena <ArrowRight size={14} />
          </Link>
        </Card>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-white">Recommended for you</h2>
        <Link
          to="/mirror"
          className="db-link inline-flex items-center gap-1 text-sm font-medium text-signal-300 hover:underline"
        >
          All matches <ArrowRight size={14} />
        </Link>
      </div>
      {ranked.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-white/12 p-6 text-center text-sm text-slate-400">
          No open opportunities in the database yet. The placement cell can add the first drive from the
          Tower.
        </p>
      ) : (
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          {ranked.map((m) => {
            const applied = apps.some((a) => a.job.id === m.job.id);
            return (
              <Card key={m.job.id} className="rise rise-1 db-card">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">{m.job.title}</p>
                    <p className="text-sm text-slate-400">
                      {m.job.company} · {m.job.location}
                    </p>
                  </div>
                  <Badge tone={m.score >= 70 ? "signal" : m.score >= 40 ? "sky" : "amber"}>
                    {m.score}%
                  </Badge>
                </div>
                <div className="mt-3">
                  <Meter value={live ? m.score : 0} tone={m.score >= 70 ? "signal" : "sky"} />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {m.gaps.length === 0 ? "No gaps — strong fit" : `Missing: ${m.gaps.map((g) => g.skill).join(", ")}`}
                </p>
                {applied ? (
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-signal-300">
                    <ListChecks size={14} /> In your tracker
                  </span>
                ) : (
                  <button
                    onClick={() => void applyQuick(m.job.id)}
                    disabled={pendingId !== null}
                    className="db-btn-ghost mt-3 rounded-lg border border-signal-500/40 bg-signal-400/10 px-3 py-1.5 text-sm font-semibold text-signal-300 hover:bg-signal-400/20 disabled:opacity-50"
                  >
                    {pendingId === m.job.id ? "Applying…" : "Apply now"}
                  </button>
                )}
                {flash?.jobId === m.job.id && flash.kind === "ok" && (
                  <p className="mt-2 text-sm font-medium text-signal-300" role="status">
                    Added to your application tracker.
                  </p>
                )}
                {flash?.jobId === m.job.id && flash.kind === "dup" && (
                  <p className="mt-2 text-sm font-medium text-amber-300" role="status">
                    Already applied — the server refused the duplicate.
                  </p>
                )}
                {flash?.jobId === m.job.id && flash.kind === "error" && (
                  <p className="mt-2 text-sm font-medium text-[var(--ws-err)]" role="alert">
                    {flash.message ?? "Application failed. Try again."}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
