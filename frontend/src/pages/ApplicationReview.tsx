import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Empty, ErrorState, Loading, SectionTitle } from "../components/ui";
import "../components/staff.css";
import { ApiError, api, type ApplicationRecord } from "../lib/server";

const STATUS_FILTERS = ["All", "APPLIED", "SHORTLISTED", "REJECTED", "HIRED", "WITHDRAWN"] as const;

const TONE: Record<string, "signal" | "sky" | "amber" | "rose" | "neutral"> = {
  APPLIED: "sky",
  SHORTLISTED: "signal",
  REJECTED: "rose",
  HIRED: "signal",
  WITHDRAWN: "neutral",
};

/** Transitions this UI offers. Matches the server's guarded workflow:
 *  placement may shortlist/reject/hire, never move backward. Shared with the
 *  applicant-review screen so both offer identical actions. */
export function nextActions(status: string): ("SHORTLISTED" | "REJECTED" | "HIRED")[] {
  if (status === "APPLIED") return ["SHORTLISTED", "REJECTED"];
  if (status === "SHORTLISTED") return ["HIRED", "REJECTED"];
  return [];
}

/**
 * Placement application review. Lists real applications with candidate and
 * drive info, filtered by status, and offers only server-supported
 * transitions. Students see the same rows update in their tracker via the
 * shared ["applications"] query key.
 */
export default function ApplicationReview() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("All");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const apps = useQuery({
    queryKey: ["staff-applications", filter],
    queryFn: () => api.applications({ status: filter, limit: 50 }),
  });

  const transition = async (app: ApplicationRecord, to: string) => {
    if (pendingId) return;
    setPendingId(app.id);
    setError(null);
    setNotice(null);
    try {
      await api.setApplicationStatus(app.id, to);
      setNotice(`${app.job.title}: moved to ${to}.`);
      await qc.invalidateQueries({ queryKey: ["applications"] });
      await qc.invalidateQueries({ queryKey: ["staff-applications"] });
      await qc.invalidateQueries({ queryKey: ["tower"] });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update this application.");
    } finally {
      setPendingId(null);
    }
  };

  const rows = apps.data ?? [];

  return (
    <div className="st st-enter">
      <SectionTitle kicker="Applications" title="Review applications" />
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
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter applications by status">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`st-tab min-h-[44px] rounded-full border px-3.5 py-1.5 text-sm font-medium ${filter === f ? "border-[var(--ws-forest)] bg-[var(--ws-forest)] text-[var(--ws-canvas)]" : "border-[var(--ws-line)] bg-[var(--ws-surface)] text-[var(--ws-mute)]"}`}
          >
            {f}
          </button>
        ))}
      </div>

      {apps.isPending ? (
        <div className="mt-3"><Loading label="Loading applications…" /></div>
      ) : apps.isError ? (
        <div className="mt-3">
          <ErrorState message="Applications failed to load" onRetry={() => void qc.invalidateQueries({ queryKey: ["staff-applications"] })} />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-3">
          <Empty title="No applications here" body="Nothing with this status yet. New student applications appear automatically." />
        </div>
      ) : (
        <ul className="mt-3 space-y-3 sm:space-y-2">
          {rows.map((a) => (
            <li key={a.id} className="st-lift flex flex-col gap-2 rounded-xl border border-[var(--ws-line)] bg-[var(--ws-surface)] p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                <p className="break-words text-sm font-semibold leading-snug text-[var(--ws-ink)] sm:truncate">
                  <Link to={`/tower/applications/${a.id}`} className="block hover:underline sm:inline">
                    {a.student?.fullName ?? "Applicant"}
                  </Link>
                  <span className="mt-0.5 block font-normal text-[var(--ws-mute)] sm:mt-0 sm:inline"> · {a.job.title}</span>
                </p>
                <p className="mt-0.5 break-words font-mono text-[11px] leading-relaxed text-[var(--ws-faint)] sm:truncate">
                  {a.student?.branch ?? ""}{a.student?.branch ? " · " : ""}{a.job.company} · applied {a.appliedAt.slice(0, 10)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={TONE[a.status] ?? "neutral"}>{a.status}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                <Link
                  to={`/tower/applications/${a.id}`}
                  aria-label={`Review application from ${a.student?.fullName ?? "applicant"} for ${a.job.title}`}
                  className="st-btn-secondary inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[var(--ws-line)] px-3 py-2 text-xs font-semibold text-[var(--ws-forest)] sm:justify-start"
                >
                  View profile
                </Link>
                {nextActions(a.status).map((to) => (
                  <button
                    key={to}
                    onClick={() => void transition(a, to)}
                    disabled={pendingId !== null}
                    className={to === "REJECTED" ? "st-btn-danger inline-flex min-h-[44px] items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50 sm:justify-start" : "st-btn-secondary inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[var(--ws-forest)] px-3 py-2 text-xs font-semibold text-[var(--ws-forest)] disabled:opacity-50 sm:justify-start"}
                  >
                    {pendingId === a.id ? "Saving…" : to === "HIRED" ? "Mark hired" : to === "SHORTLISTED" ? "Shortlist" : "Reject"}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
