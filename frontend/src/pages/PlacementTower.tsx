import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, FlaskConical } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import ApplicationReview from "./ApplicationReview";
import DriveManager from "./DriveManager";
import { Badge, Card, DemoTag, ErrorState, Loading, Meter, SectionTitle } from "../components/ui";
import "../components/staff.css";
import { ApiError } from "../lib/server";
import { useTower } from "../store/session";

/** Scroll sidebar hash links (#drives …) below the sticky header. */
function useHashScroll(): void {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  }, [hash]);
}

/**
 * Staff placement workspace: overview metrics, drive publishing, application
 * review, candidate directory and reports — one route, anchored sections.
 * Every number comes from persisted records; the What-If Lab stays labelled
 * illustrative and lives last.
 */
export default function PlacementTower() {
  const tower = useTower();
  const qc = useQueryClient();
  const [extraDrives, setExtraDrives] = useState(2);
  useHashScroll();

  if (tower.isPending) {
    return (
      <div>
        <SectionTitle kicker="Placement overview" title="The whole batch, one screen" right={<DemoTag />} />
        <Loading label="Aggregating placement records…" />
      </div>
    );
  }
  if (tower.isError) {
    if (tower.error instanceof ApiError && tower.error.status === 403) {
      return (
        <div>
          <SectionTitle kicker="Placement overview" title="The whole batch, one screen" right={<DemoTag />} />
          <Card className="p-6">
            <p className="text-sm font-semibold text-[var(--ws-ink)]">Placement access only</p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--ws-mute)]">
              The placement workspace shows every student&apos;s records, so it is limited to
              placement staff accounts. Your own workspace is unaffected.
            </p>
            <Link
              to="/app"
              className="st-btn mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-signal-400 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-signal-300"
            >
              Back to your overview <ArrowRight size={14} />
            </Link>
          </Card>
        </div>
      );
    }
    return (
      <div>
        <SectionTitle kicker="Placement overview" title="The whole batch, one screen" right={<DemoTag />} />
        <ErrorState
          message={tower.error instanceof Error ? tower.error.message : "Tower stats failed to load"}
          onRetry={() => void qc.invalidateQueries({ queryKey: ["tower"] })}
        />
      </div>
    );
  }

  const s = tower.data;
  const readyCount = s.readiness.filter((r) => r.score >= 60).length;
  const projected = Math.min(s.students, Math.round(readyCount * (0.42 + extraDrives * 0.12)));

  return (
    <div className="st st-enter">
      <SectionTitle
        kicker="Placement overview"
        title="The whole batch, one screen"
        sub="Live counts from current records — students, open drives and applications."
        right={<DemoTag />}
      />

      <section id="overview" aria-label="Overview" className="scroll-mt-24">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Students on record", value: `${s.students}`, sub: `${readyCount} proficiency-ready (≥60)` },
            { label: "Open drives", value: `${s.openOpportunities}`, sub: "currently open" },
            { label: "Applications", value: `${s.applications}`, sub: Object.entries(s.byStatus).map(([k, v]) => `${k} ${v}`).join(" · ") || "none yet" },
            { label: "Avg proficiency", value: `${s.avgReadiness}`, sub: "mean recorded skill level, /100" },
          ].map((k) => (
            <Card key={k.label} className="rise st-card">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ws-faint)]">{k.label}</p>
              <p className="font-display mt-1 text-3xl font-bold text-[var(--ws-ink)]">{k.value}</p>
              <p className="mt-0.5 text-xs text-[var(--ws-mute)]">{k.sub}</p>
            </Card>
          ))}
        </div>

        <Card className="rise mt-4 st-card">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ws-faint)]">
            Application mix
          </p>
          {Object.keys(s.byStatus).length === 0 ? (
            <p className="mt-2 text-sm text-[var(--ws-mute)]">No applications yet.</p>
          ) : (
            <ul className="mt-3 grid gap-x-8 gap-y-2 md:grid-cols-2">
              {Object.entries(s.byStatus).map(([st, n]) => (
                <li key={st} className="flex items-center gap-2 text-sm">
                  <span className="w-28 font-mono text-[11px] uppercase text-[var(--ws-faint)]">{st}</span>
                  <Meter value={s.applications ? (n / s.applications) * 100 : 0} />
                  <span className="font-mono text-xs text-[var(--ws-ink)]">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section id="drives" aria-label="Company drives" className="mt-8 scroll-mt-24">
        <DriveManager />
      </section>

      <section id="applications" aria-label="Applications" className="mt-8 scroll-mt-24">
        <ApplicationReview />
      </section>

      <section id="students" aria-label="Students" className="mt-8 scroll-mt-24">
        <Card className="rise st-card">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ws-faint)]">
                Students · {s.students} registered
              </p>
              <p className="mt-1 text-sm text-[var(--ws-mute)]">
                {readyCount} proficiency-ready (≥60). Search by name, email or roll number, filter
                by branch and readiness, and open any profile.
              </p>
            </div>
            <Link
              to="/tower/students"
              className="st-btn-forest inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[var(--ws-forest)] px-4 py-2 text-sm font-semibold text-[var(--ws-canvas)]"
            >
              Open directory <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </Card>
      </section>

      <section id="reports" aria-label="Reports" className="mt-8 scroll-mt-24">
        <Card className="rise st-card">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ws-faint)]">
                Announcements
              </p>
              <p className="mt-1 text-sm text-[var(--ws-mute)]">
                Publish placement notices to all students or drive applicants.
              </p>
            </div>
            <Link
              to="/tower/announcements"
              className="st-btn-forest inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[var(--ws-forest)] px-4 py-2 text-sm font-semibold text-[var(--ws-canvas)]"
            >
              Manage announcements <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </Card>
        <Card className="rise mt-4 st-card border-sky-400/20">
          <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ws-sky)]">
            <FlaskConical size={13} aria-hidden="true" /> What-If Lab · illustrative model
          </p>
          <p className="mt-1 text-sm text-[var(--ws-mute)]">
            A toy projection for planning discussion — not a placement forecast or guarantee.
          </p>
          <label className="mt-3 block text-sm text-[var(--ws-ink)]">
            Extra drives this month: <span className="font-mono">{extraDrives}</span>
            <input
              type="range"
              min={0}
              max={6}
              value={extraDrives}
              onChange={(e) => setExtraDrives(Number(e.target.value))}
              className="mt-1 w-full accent-lime-300"
            />
          </label>
          <p className="mt-2 text-sm text-[var(--ws-mute)]">
            Illustrative projection from proficiency-ready students:{" "}
            <span className="font-display text-lg font-bold text-[var(--ws-ink)]">{projected}</span>
            <span className="text-[var(--ws-faint)]">/{s.students}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {s.readiness
              .filter((r) => r.score >= 60)
              .slice(0, 8)
              .map((r) => (
                <Badge key={r.id}>{r.fullName.split(" ")[0]} {r.score}</Badge>
              ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
