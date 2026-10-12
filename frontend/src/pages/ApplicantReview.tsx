import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { nextActions } from "./ApplicationReview";
import ApplicantEvidence from "./ApplicantEvidence";
import { Badge, Card, DemoTag, ErrorState, Loading, SectionTitle } from "../components/ui";
import "../components/staff.css";
import { ApiError, api } from "../lib/server";
import { arenaSessions } from "../lib/arena";
import { isPlacement, useSessionUser } from "../store/session";

const TONE: Record<string, "signal" | "sky" | "amber" | "rose" | "neutral"> = {
  APPLIED: "sky",
  SHORTLISTED: "signal",
  REJECTED: "rose",
  HIRED: "signal",
  WITHDRAWN: "neutral",
};

/** Staff applicant review: one application plus the candidate's persisted profile, history and job fit. All data from existing endpoints. */
export default function ApplicantReview() {
  const { applicationId } = useParams();
  const user = useSessionUser();
  const qc = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const application = useQuery({
    queryKey: ["application", applicationId],
    queryFn: () => api.application(applicationId as string),
    enabled: !!applicationId,
  });

  const candidateId = application.data?.student?.id;
  const jobId = application.data?.job.id;

  const profile = useQuery({
    queryKey: ["review-profile", candidateId],
    queryFn: () => api.profile(candidateId as string),
    enabled: !!candidateId,
  });
  const readiness = useQuery({
    queryKey: ["review-readiness", candidateId],
    queryFn: () => api.readiness(candidateId as string),
    enabled: !!candidateId,
  });
  const attempts = useQuery({
    queryKey: ["review-attempts", candidateId],
    queryFn: () => api.attempts(candidateId as string).then((r) => r.data),
    enabled: !!candidateId,
  });
  const arena = useQuery({
    queryKey: ["review-arena", candidateId],
    queryFn: () => arenaSessions(candidateId as string).then((r) => r.data),
    enabled: !!candidateId,
  });
  const matches = useQuery({
    queryKey: ["review-matches", candidateId],
    queryFn: () => api.matches(candidateId as string, 20),
    enabled: !!candidateId,
  });
  const history = useQuery({
    queryKey: ["review-apps", candidateId],
    queryFn: () => api.applications({ studentProfileId: candidateId as string }),
    enabled: !!candidateId,
  });
  const job = useQuery({
    queryKey: ["review-job", jobId],
    queryFn: () => api.opportunity(jobId as string),
    enabled: !!jobId,
  });

  if (user && !isPlacement(user)) {
    return (
      <div>
        <SectionTitle kicker="Applicant review" title="Placement access only" right={<DemoTag />} />
        <Card className="p-6">
          <p className="text-sm leading-relaxed text-[var(--ws-mute)]">
            Applicant records are limited to placement staff accounts.
          </p>
          <Link to="/app" className="mt-4 inline-flex min-h-[44px] items-center rounded-lg border border-[var(--ws-line)] px-4 py-2 text-sm font-semibold text-[var(--ws-forest)]">
            Back to your overview
          </Link>
        </Card>
      </div>
    );
  }

  if (application.isPending || profile.isPending) {
    return (
      <div>
        <SectionTitle kicker="Applicant review" title="Loading applicant…" right={<DemoTag />} />
        <Loading label="Reading the application and profile…" />
      </div>
    );
  }
  // API states below are explicit — never disguised as a route-not-found.
  const queryError = application.error;
  const errStatus = queryError instanceof ApiError ? queryError.status : null;
  const appData = application.data;
  if (!appData) {
    if (errStatus === 403) {
      return (
        <div>
          <SectionTitle kicker="Applicant review" title="Access denied" right={<DemoTag />} />
          <Card className="p-6">
            <p className="text-sm leading-relaxed text-[var(--ws-mute)]">
              Applicant records are limited to placement staff accounts. Your account is not
              permitted to view this application.
            </p>
            <Link
              to="/app"
              className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-4 py-2 text-sm font-semibold text-[var(--ws-forest)]"
            >
              <ArrowLeft size={14} aria-hidden="true" /> Back to your overview
            </Link>
          </Card>
        </div>
      );
    }
    if (errStatus === 404) {
      return (
        <div>
          <SectionTitle kicker="Applicant review" title="Application not found" right={<DemoTag />} />
          <Card className="p-6">
            <p className="text-sm leading-relaxed text-[var(--ws-mute)]">
              No application with this ID exists. It may have been removed, or the link is incorrect.
            </p>
            <Link
              to="/tower#applications"
              className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-4 py-2 text-sm font-semibold text-[var(--ws-forest)]"
            >
              <ArrowLeft size={14} aria-hidden="true" /> Back to applications
            </Link>
          </Card>
        </div>
      );
    }
    return (
      <div>
        <SectionTitle kicker="Applicant review" title="Applicant review" right={<DemoTag />} />
        <ErrorState
          message={queryError instanceof Error ? queryError.message : "Application not found"}
          onRetry={() => void qc.invalidateQueries({ queryKey: ["application", applicationId] })}
        />
      </div>
    );
  }

  const app = appData;
  const prof = profile.data;
  const ready = readiness.data;
  const evaluated = (attempts.data ?? []).filter((a) => a.status === "EVALUATED");
  const scoredArena = (arena.data ?? []).filter((s) => s.score !== null);
  const required = job.data?.requiredSkills ?? [];
  const evidenceBySkill = new Map<string, string[]>();
  for (const s of prof?.skills ?? []) {
    if (s.evidence.length > 0) evidenceBySkill.set(s.skill.toLowerCase(), s.evidence);
  }
  const levelBySkill = new Map((prof?.skills ?? []).map((s) => [s.skill.toLowerCase(), s.level]));
  const matchForJob = (matches.data?.data ?? []).find((m) => m.job.id === jobId);

  const decide = async (to: string) => {
    if (pending) return;
    if ((to === "REJECTED" || to === "HIRED") && !window.confirm(`Move this application to ${to}?`)) return;
    setPending(to);
    setError(null);
    setNotice(null);
    try {
      await api.setApplicationStatus(app.id, to);
      setNotice(`Application moved to ${to}. Counts and lists are updated.`);
      await qc.invalidateQueries({ queryKey: ["applications"] });
      await qc.invalidateQueries({ queryKey: ["staff-applications"] });
      await qc.invalidateQueries({ queryKey: ["tower"] });
      await qc.invalidateQueries({ queryKey: ["application", applicationId] });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update this application.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="st st-enter">
      <SectionTitle
        kicker="Applicant review"
        title={`${app.student?.fullName ?? "Applicant"} · ${app.job.title}`}
        sub={`${app.job.company} — records below are this candidate's persisted profile and history.`}
        right={<DemoTag />}
      />
      <Link
        to="/tower#applications"
        className="st-btn-secondary mb-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-4 py-2 text-sm font-semibold text-[var(--ws-forest)]"
      >
        <ArrowLeft size={14} aria-hidden="true" /> Back to applications
      </Link>

      {notice && (
        <p role="status" className="mb-3 rounded-xl border border-[var(--ws-forest)] bg-[var(--ws-lime-wash)] p-3 text-sm text-[var(--ws-ink)]">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-3 rounded-xl border border-[#e8c6bf] bg-[var(--ws-err-bg)] p-3 text-sm text-[var(--ws-err)]">
          {error}
        </p>
      )}

      {/* Summary: two columns until very wide screens — three squeezed cards help nobody. */}
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        <Card className="st-card p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ws-faint)]">Candidate</p>
          <p className="font-display mt-1 text-xl font-bold text-[var(--ws-ink)]">{app.student?.fullName ?? "—"}</p>
          <p className="mt-1 text-sm text-[var(--ws-mute)]">
            {app.student?.branch ?? "—"} · {app.student?.enrollmentNo ?? "no roll number on record"}
          </p>
          <p className="mt-1 font-mono text-[11px] text-[var(--ws-faint)]">applied {app.appliedAt.slice(0, 10)} · updated {app.updatedAt.slice(0, 10)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={TONE[app.status] ?? "neutral"}>{app.status}</Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {nextActions(app.status).map((to) => (
              <button
                key={to}
                onClick={() => void decide(to)}
                disabled={pending !== null}
                className={to === "REJECTED" ? "st-btn-danger inline-flex min-h-[44px] items-center rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50" : "st-btn-secondary inline-flex min-h-[44px] items-center rounded-lg border border-[var(--ws-forest)] px-3 py-2 text-xs font-semibold text-[var(--ws-forest)] disabled:opacity-50"}
              >
                {pending === to ? "Saving…" : to === "HIRED" ? "Mark hired" : to === "SHORTLISTED" ? "Shortlist" : "Reject"}
              </button>
            ))}
            {nextActions(app.status).length === 0 && (
              <span className="text-xs text-[var(--ws-mute)]">Terminal state — no further transitions.</span>
            )}
          </div>
        </Card>

        <Card className="st-card p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ws-faint)]">Readiness</p>
          {ready ? (
            <>
              <p className="font-display mt-1 text-3xl font-bold text-[var(--ws-ink)]">{ready.score}<span className="text-sm text-[var(--ws-faint)]">/100</span></p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--ws-mute)]">
                {ready.inputs.recordedSkills} recorded skills · {ready.inputs.evidencedSkills} evidenced ·{" "}
                {ready.inputs.applications} applications · {ready.inputs.evaluatedSprints} evaluated sprints.
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-[var(--ws-mute)]">Not available</p>
          )}
          <p className="font-mono mt-3 text-[11px] uppercase tracking-[0.18em] text-[var(--ws-faint)]">Skills</p>
          {(prof?.skills ?? []).length === 0 ? (
            <p className="mt-1 text-sm text-[var(--ws-mute)]">No recorded skills.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {(prof?.skills ?? []).map((s) => (
                <li key={s.skill} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-[var(--ws-ink)]">{s.skill}</span>
                  <Badge tone="neutral">{s.level}</Badge>
                  <span className="text-xs text-[var(--ws-mute)]">
                    {s.evidence.length > 0 ? `evidenced ×${s.evidence.length}` : "recorded — no linked evidence"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="st-card p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ws-faint)]">
            Job fit · {app.job.title}
          </p>
          {matchForJob && (
            <p className="mt-1 text-sm text-[var(--ws-ink)]">
              Match score <span className="font-bold">{matchForJob.score}%</span>
              <span className="text-[var(--ws-mute)]"> — rule-based fit on recorded skills and evidence.</span>
            </p>
          )}
          {required.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--ws-mute)]">This posting lists no required skills.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {required.map((r) => {
                const key = r.skill.toLowerCase();
                const state = evidenceBySkill.has(key) ? "A" : levelBySkill.has(key) ? "B" : "C";
                return (
                  <li key={r.skill} className="text-sm">
                    <span className="font-medium text-[var(--ws-ink)]">{r.skill} · {r.minLevel}</span>
                    <span className="block text-xs text-[var(--ws-mute)]">
                      {state === "A" && "Demonstrated — linked project evidence on record."}
                      {state === "B" && `Recorded at ${levelBySkill.get(key)} — evidence not linked.`}
                      {state === "C" && "No record in profile — not proof the skill is absent."}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {(job.data?.niceToHave ?? []).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(job.data?.niceToHave ?? []).map((s) => (
                <Badge key={s} tone="neutral">{s} · preferred</Badge>
              ))}
            </div>
          )}
        </Card>
      </div>

      <ApplicantEvidence
        projects={prof?.projects ?? []}
        evaluated={evaluated}
        arena={scoredArena}
        history={history.data ?? []}
      />
    </div>
  );
}
