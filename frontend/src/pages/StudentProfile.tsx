import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import {
  ArenaCard,
  HistoryCard,
  ProjectsCard,
  SprintCard,
} from "./ApplicantEvidence";
import { Badge, Card, DemoTag, ErrorState, Loading, SectionTitle } from "../components/ui";
import "../components/staff.css";
import { api } from "../lib/server";
import { arenaSessions } from "../lib/arena";
import { isPlacement, useSessionUser } from "../store/session";

function orNotProvided(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === "" ? "Not provided" : String(value);
}

/**
 * Staff student profile: identity, academics, readiness, skills and the same
 * evidence/history sections as applicant review — but general, with no job,
 * no fit score and no hiring decisions. All data from existing
 * owner-or-placement endpoints; the backend enforces the scope.
 */
export default function StudentProfile() {
  const { studentId } = useParams();
  const user = useSessionUser();
  const qc = useQueryClient();

  const profile = useQuery({
    queryKey: ["review-profile", studentId],
    queryFn: () => api.profile(studentId as string),
    enabled: !!studentId,
  });
  const readiness = useQuery({
    queryKey: ["review-readiness", studentId],
    queryFn: () => api.readiness(studentId as string),
    enabled: !!studentId,
  });
  const attempts = useQuery({
    queryKey: ["review-attempts", studentId],
    queryFn: () => api.attempts(studentId as string).then((r) => r.data),
    enabled: !!studentId,
  });
  const arena = useQuery({
    queryKey: ["review-arena", studentId],
    queryFn: () => arenaSessions(studentId as string).then((r) => r.data),
    enabled: !!studentId,
  });
  const apps = useQuery({
    queryKey: ["review-apps", studentId],
    queryFn: () => api.applications({ studentProfileId: studentId as string }),
    enabled: !!studentId,
  });

  if (user && !isPlacement(user)) {
    return (
      <div>
        <SectionTitle kicker="Student profile" title="Placement access only" right={<DemoTag />} />
        <Card className="p-6">
          <p className="text-sm leading-relaxed text-[var(--ws-mute)]">
            Student records are limited to placement staff accounts.
          </p>
          <Link to="/app" className="mt-4 inline-flex min-h-[44px] items-center rounded-lg border border-[var(--ws-line)] px-4 py-2 text-sm font-semibold text-[var(--ws-forest)]">
            Back to your overview
          </Link>
        </Card>
      </div>
    );
  }

  if (profile.isPending) {
    return (
      <div>
        <SectionTitle kicker="Student profile" title="Loading student…" right={<DemoTag />} />
        <Loading label="Reading the student record…" />
      </div>
    );
  }
  if (profile.isError || !profile.data) {
    return (
      <div>
        <SectionTitle kicker="Student profile" title="Student profile" right={<DemoTag />} />
        <ErrorState
          message={profile.error instanceof Error ? profile.error.message : "Student not found"}
          onRetry={() => void qc.invalidateQueries({ queryKey: ["review-profile", studentId] })}
        />
      </div>
    );
  }

  const p = profile.data;
  const ready = readiness.data;
  const evaluated = (attempts.data ?? []).filter((a) => a.status === "EVALUATED");
  const scoredArena = (arena.data ?? []).filter((s) => s.score !== null);

  return (
    <div className="st st-enter">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/tower/students"
          className="st-btn-secondary inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-4 py-2 text-sm font-semibold text-[var(--ws-forest)]"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back to students
        </Link>
        <DemoTag />
      </div>

      {/* A · compact header: identity first, registration secondary. */}
      <div className="min-w-0">
        <h1 className="text-2xl font-bold leading-tight text-[var(--ws-ink)] sm:text-[1.7rem]">
          {p.fullName}
        </h1>
        <p className="mt-1 text-sm text-[var(--ws-mute)]">
          {orNotProvided(p.branch)} · {orNotProvided(p.enrollmentNo)}
        </p>
        {p.email && (
          <p className="mt-0.5 break-all text-sm text-[var(--ws-mute)]">{p.email}</p>
        )}
        <p className="mt-1 text-xs text-[var(--ws-faint)]">Registered {p.createdAt.slice(0, 10)}</p>
      </div>

      {/* B–C · two independently flowing columns: nothing stretches, nothing waits. */}
      <div className="mt-4 grid items-start gap-4 md:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <Card className="st-card p-5">
            <h2 className="text-base font-bold text-[var(--ws-ink)]">Academic profile</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--ws-ink)]">
              {[
                ["Roll number", orNotProvided(p.enrollmentNo)],
                ["Branch", orNotProvided(p.branch)],
                ["College", orNotProvided(p.institution)],
                ["Graduation year", orNotProvided(p.graduationYear)],
                ["CGPA", orNotProvided(p.cgpa)],
              ].map(([k, v], i, all) => (
                <span key={k}>
                  <span className="text-xs text-[var(--ws-mute)]">{k} — </span>
                  <span className="font-semibold">{v}</span>
                  {i < all.length - 1 && <span className="mx-1.5 text-[var(--ws-faint)]">·</span>}
                </span>
              ))}
            </p>
          </Card>
          <ProjectsCard projects={p.projects} />
          <SprintCard evaluated={evaluated} />
        </div>
        <div className="min-w-0 space-y-4">
          <Card className="st-card p-5">
            <h2 className="text-base font-bold text-[var(--ws-ink)]">
              Readiness{ready ? <span className="ml-2 text-[var(--ws-forest)]">{ready.score}/100</span> : null}
            </h2>
            {ready ? (
              <p className="mt-1 text-xs leading-relaxed text-[var(--ws-mute)]">
                {ready.inputs.recordedSkills} recorded skills · {ready.inputs.evidencedSkills} evidenced ·{" "}
                {ready.inputs.applications} applications · {ready.inputs.evaluatedSprints} evaluated sprints.
              </p>
            ) : (
              <p className="mt-1 text-sm text-[var(--ws-mute)]">Not available</p>
            )}
            <h3 className="mt-3 text-sm font-bold text-[var(--ws-ink)]">Skills</h3>
            {p.skills.length === 0 ? (
              <p className="mt-1 text-sm text-[var(--ws-mute)]">No recorded skills.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {p.skills.map((s) => (
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
          <ArenaCard arena={scoredArena} />
          <HistoryCard history={apps.data ?? []} />
        </div>
      </div>
    </div>
  );
}
