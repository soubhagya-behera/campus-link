import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Card, DemoTag, Empty, ErrorState, Loading, Meter, SectionTitle } from "../components/ui";
import "../components/staff.css";
import { api } from "../lib/server";
import { useTower } from "../store/session";

const READINESS_FILTERS = ["All", "Ready (≥60)", "Getting started (<60)"] as const;

/**
 * Staff student directory: every registered profile, searchable by name,
 * email, roll number or branch, filterable by branch and readiness band.
 * New registrations appear on navigation via normal query refetch — no
 * polling. Rows link to the staff student profile; scores come from the
 * backend readiness list, "Not available" where the student has no record.
 */
export default function StudentDirectory() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [branch, setBranch] = useState("All");
  const [band, setBand] = useState<(typeof READINESS_FILTERS)[number]>("All");
  const tower = useTower();

  const students = useQuery({
    queryKey: ["students", query, branch],
    queryFn: () => api.students({ search: query || undefined, branch, limit: 30 }),
  });

  if (tower.isPending || students.isPending) {
    return (
      <div>
        <SectionTitle kicker="Students" title="Student directory" right={<DemoTag />} />
        <Loading label="Loading registered students…" />
      </div>
    );
  }
  if (tower.isError || students.isError) {
    return (
      <div>
        <SectionTitle kicker="Students" title="Student directory" right={<DemoTag />} />
        <ErrorState
          message="Student records failed to load"
          onRetry={() => {
            void qc.invalidateQueries({ queryKey: ["students"] });
            void qc.invalidateQueries({ queryKey: ["tower"] });
          }}
        />
      </div>
    );
  }

  const scores = new Map((tower.data?.readiness ?? []).map((r) => [r.id, r.score]));
  const rows = (students.data?.data ?? []).filter((r) => {
    if (band === "All") return true;
    const s = scores.get(r.id) ?? 0;
    const hasRecord = r.skillCount > 0;
    return band.startsWith("Ready") ? hasRecord && s >= 60 : !hasRecord || s < 60;
  });

  return (
    <div className="st st-enter">
      <SectionTitle
        kicker="Students"
        title="Student directory"
        sub={`${students.data?.total ?? 0} registered students. New registrations appear here automatically.`}
        right={<DemoTag />}
      />
      <Card className="st-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-52">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ws-faint)]" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, roll no…"
              aria-label="Search students by name, email or roll number"
              className="st-input min-h-[44px] w-full rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] py-1.5 pl-8 pr-2 text-sm text-[var(--ws-ink)]"
            />
          </div>
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            aria-label="Filter by branch"
            className="st-select min-h-[44px] shrink-0 rounded-lg border border-[var(--ws-line)] bg-[var(--ws-surface)] px-2 py-1.5 text-sm text-[var(--ws-ink)]"
          >
            {["All", "CSE", "ECE", "IT", "EEE"].map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </div>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Filter by readiness">
          {READINESS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setBand(f)}
              aria-pressed={band === f}
              className={`st-tab min-h-[44px] rounded-full border px-3.5 py-1.5 text-sm font-medium ${band === f ? "border-[var(--ws-forest)] bg-[var(--ws-forest)] text-[var(--ws-canvas)]" : "border-[var(--ws-line)] bg-[var(--ws-surface)] text-[var(--ws-mute)]"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </Card>

      {rows.length === 0 ? (
        <div className="mt-4">
          <Empty title="No students match" body="Try a different search, branch or readiness band." />
        </div>
      ) : (
        <ul className="mt-4 space-y-3 sm:space-y-2">
          {rows.map((r) => {
            const score = scores.get(r.id);
            const hasRecord = r.skillCount > 0;
            return (
              <li key={r.id} className="st-lift flex flex-col gap-2.5 rounded-xl border border-[var(--ws-line)] bg-[var(--ws-surface)] p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                  <div className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ws-forest)] text-xs font-bold text-[var(--ws-canvas)]" aria-hidden="true">
                    {r.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold leading-snug text-[var(--ws-ink)] sm:truncate">{r.fullName}</p>
                    <p className="mt-0.5 break-all font-mono text-[11px] leading-relaxed text-[var(--ws-faint)] sm:hidden">
                      {r.email ?? "no email"}
                    </p>
                  </div>
                </div>
                <p className="break-words font-mono text-[11px] leading-relaxed text-[var(--ws-faint)] sm:hidden">
                  {r.enrollmentNo ?? "—"} · {r.branch ?? "—"}
                  {r.graduationYear ? ` · class of ${r.graduationYear}` : ""}
                </p>
                <p className="hidden truncate font-mono text-[11px] text-[var(--ws-faint)] sm:block sm:min-w-0 sm:flex-1">
                  {r.email ?? "no email"} · {r.enrollmentNo ?? "—"} · {r.branch ?? "—"}
                  {r.graduationYear ? ` · class of ${r.graduationYear}` : ""}
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-24 shrink-0">
                    <Meter value={hasRecord ? (score ?? 0) : 0} tone={hasRecord && (score ?? 0) >= 60 ? "signal" : "amber"} />
                  </div>
                  <span className="font-mono text-xs text-[var(--ws-ink)] sm:w-24 sm:shrink-0 sm:text-right">
                    {hasRecord ? (score ?? "…") : "Not available"}
                  </span>
                  {r.applicationCount > 0 && <Badge tone="sky">{r.applicationCount} apps</Badge>}
                </div>
                <Link
                  to={`/tower/students/${r.id}`}
                  aria-label={`View profile of ${r.fullName}`}
                  className="st-btn-secondary inline-flex min-h-[44px] items-center justify-center gap-1 rounded-lg border border-[var(--ws-forest)] px-3 py-2 text-xs font-semibold text-[var(--ws-forest)] sm:w-auto sm:justify-start"
                >
                  View profile <ArrowRight size={13} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
