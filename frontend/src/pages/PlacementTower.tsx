import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, FlaskConical, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Card, DemoTag, ErrorState, Loading, Meter, SectionTitle } from "../components/ui";
import { ApiError, api } from "../lib/server";
import { useTower } from "../store/session";
import { useQuery } from "@tanstack/react-query";

export default function PlacementTower() {
  const tower = useTower();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [branch, setBranch] = useState("All");
  const [extraDrives, setExtraDrives] = useState(2);

  const students = useQuery({
    queryKey: ["students", query, branch],
    queryFn: () => api.students({ search: query || undefined, branch, limit: 30 }),
  });

  if (tower.isPending) {
    return (
      <div>
        <SectionTitle kicker="Placement Control Tower" title="The whole batch, one screen" right={<DemoTag />} />
        <Loading label="Aggregating placement records…" />
      </div>
    );
  }
  if (tower.isError) {
    // Students (and recruiters) cannot access placement aggregates: the API
    // answers 403. Say so plainly with a way back, instead of a bare error
    // whose Retry can never succeed.
    if (tower.error instanceof ApiError && tower.error.status === 403) {
      return (
        <div>
          <SectionTitle kicker="Placement Control Tower" title="The whole batch, one screen" right={<DemoTag />} />
          <Card className="p-6">
            <p className="text-sm font-semibold text-[var(--ws-ink)]">Placement access only</p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--ws-mute)]">
              The Placement Tower shows every student&apos;s records, so it is limited to placement
              staff accounts. Your student workspace is unaffected.
            </p>
            <Link
              to="/app"
              className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-signal-400 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-signal-300"
            >
              Back to your overview <ArrowRight size={14} />
            </Link>
          </Card>
        </div>
      );
    }
    return (
      <div>
        <SectionTitle kicker="Placement Control Tower" title="The whole batch, one screen" right={<DemoTag />} />
        <ErrorState
          message={tower.error instanceof Error ? tower.error.message : "Tower stats failed to load"}
          onRetry={() => void qc.invalidateQueries({ queryKey: ["tower"] })}
        />
      </div>
    );
  }

  const s = tower.data;
  const rows = students.data?.data ?? [];
  const readyCount = s.readiness.filter((r) => r.score >= 60).length;
  const projected = Math.min(
    s.students,
    Math.round(readyCount * (0.42 + extraDrives * 0.12)),
  );

  return (
    <div>
      <SectionTitle
        kicker="Placement Control Tower"
        title="The whole batch, one screen"
        sub="Every number below is computed from persisted PostgreSQL records — no invented outcomes."
        right={<DemoTag />}
      />

      {s.demoSeedPresent && (
        <p className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-3 text-sm text-amber-200">
          Development seed data is present in this database (records prefixed demo.*). Replace it with real
          student and drive records before any real placement cycle.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Students on record", value: `${s.students}`, sub: `${readyCount} proficiency-ready (≥60)` },
          { label: "Open drives", value: `${s.openOpportunities}`, sub: "status = OPEN in PostgreSQL" },
          { label: "Applications", value: `${s.applications}`, sub: Object.entries(s.byStatus).map(([k, v]) => `${k} ${v}`).join(" · ") || "none yet" },
          { label: "Avg proficiency", value: `${s.avgReadiness}`, sub: "mean recorded skill level, /100" },
        ].map((k) => (
          <Card key={k.label} className="rise">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">{k.label}</p>
            <p className="font-display mt-1 text-3xl font-bold text-white">{k.value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{k.sub}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-5">
        <Card className="rise xl:col-span-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
              Candidate pipeline · {students.data?.total ?? 0}
            </p>
            <div className="relative ml-auto">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or roll no…"
                className="w-48 rounded-lg border border-white/10 bg-ink-800 py-1.5 pl-8 pr-2 text-sm text-white placeholder:text-slate-600"
              />
            </div>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="rounded-lg border border-white/10 bg-ink-800 px-2 py-1.5 text-sm text-white"
            >
              {["All", "CSE", "ECE", "IT", "EEE"].map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </div>
          {students.isPending ? (
            <div className="mt-3"><Loading label="Searching records…" /></div>
          ) : (
            <ul className="mt-3 divide-y divide-white/6">
              {rows.map((r) => {
                const score = s.readiness.find((x) => x.id === r.id)?.score ?? 0;
                return (
                  <li key={r.id} className="flex items-center gap-3 py-2.5">
                    <div className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/6 text-xs font-bold text-white">
                      {r.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{r.fullName}</p>
                      <p className="font-mono text-[11px] text-slate-500">
                        {r.branch ?? "—"} · {r.enrollmentNo ?? "—"} · {r.skillCount} skills ·{" "}
                        {r.applicationCount} apps · {r.projectCount} projects
                      </p>
                    </div>
                    <div className="w-28 shrink-0">
                      <Meter value={score} tone={score >= 60 ? "signal" : "amber"} />
                    </div>
                    <span className="w-8 shrink-0 text-right font-mono text-xs text-slate-300">{score}</span>
                  </li>
                );
              })}
              {rows.length === 0 && (
                <li className="py-6 text-center text-sm text-slate-500">
                  No student records match. Add profiles via the API or seed — this list never invents names.
                </li>
              )}
            </ul>
          )}
        </Card>

        <div className="space-y-4 xl:col-span-2">
          <Card className="rise rise-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">
              Application mix
            </p>
            {Object.keys(s.byStatus).length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">No applications persisted yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {Object.entries(s.byStatus).map(([st, n]) => (
                  <li key={st} className="flex items-center gap-2 text-sm">
                    <span className="w-28 font-mono text-[11px] uppercase text-slate-500">{st}</span>
                    <Meter value={s.applications ? (n / s.applications) * 100 : 0} />
                    <span className="font-mono text-xs text-slate-300">{n}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to="/mirror"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-signal-300 hover:underline"
            >
              Open student mirror <ArrowRight size={14} />
            </Link>
          </Card>

          <Card className="rise rise-2 border-sky-400/20">
            <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-sky-300">
              <FlaskConical size={13} /> What-If Lab · illustrative model
            </p>
            <label className="mt-3 block text-sm text-slate-300">
              Extra drives this month: <span className="font-mono text-white">{extraDrives}</span>
              <input
                type="range"
                min={0}
                max={6}
                value={extraDrives}
                onChange={(e) => setExtraDrives(Number(e.target.value))}
                className="mt-1 w-full accent-lime-300"
              />
            </label>
            <p className="mt-2 text-sm text-slate-400">
              Toy projection from proficiency-ready students:{" "}
              <span className="font-display text-lg font-bold text-white">{projected}</span>
              <span className="text-slate-500">/{s.students}</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {s.readiness
                .filter((r) => r.score >= 60)
                .slice(0, 8)
                .map((r) => (
                  <Badge key={r.id}>{r.fullName.split(" ")[0]} {r.score}</Badge>
                ))}
            </div>
            <p className="mt-2 font-mono text-[11px] text-slate-600">
              Illustrative only — not a placement guarantee.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
