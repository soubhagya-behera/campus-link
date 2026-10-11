import {
  Backpack,
  Briefcase,
  Dumbbell,
  Fingerprint,
  LayoutDashboard,
  Medal,
  Radar,
  Swords,
  TowerControl,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { fetchHealth, fetchReady, type ApiStatus } from "../lib/api";
import { cn } from "../lib/cn";
import { useProfile, useReadiness } from "../store/session";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const STUDENT_NAV: NavItem[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/twin", label: "Career Twin", icon: Fingerprint },
  { to: "/mirror", label: "Opportunity Mirror", icon: Radar },
  { to: "/sprint", label: "Skill Sprint", icon: Dumbbell },
  { to: "/applications", label: "Applications", icon: Briefcase },
  { to: "/arena", label: "Interview Arena", icon: Swords },
  { to: "/passport", label: "Proof Passport", icon: Medal },
];

const STAFF_NAV: NavItem[] = [{ to: "/tower", label: "Placement Tower", icon: TowerControl }];

function StatusPill({ label, status }: { label: string; status: ApiStatus | null }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-slate-400"
      title={status?.latencyMs != null ? `${status.latencyMs}ms` : "checking…"}
    >
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          status == null ? "bg-slate-500" : status.ok ? "bg-signal-400 live-dot" : "bg-rose-400",
        )}
      />
      {label} {status == null ? "…" : status.ok ? "live" : "down"}
    </span>
  );
}

export default function Shell() {
  const [health, setHealth] = useState<ApiStatus | null>(null);
  const [ready, setReady] = useState<ApiStatus | null>(null);
  const readiness = useReadiness();
  const profile = useProfile();
  const location = useLocation();

  useEffect(() => {
    let alive = true;
    fetchHealth().then((s) => alive && setHealth(s));
    fetchReady().then((s) => alive && setReady(s));
    const id = setInterval(() => {
      fetchHealth().then((s) => alive && setHealth(s));
      fetchReady().then((s) => alive && setReady(s));
    }, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [location.pathname]);

  const score = readiness.data?.score;

  return (
    <div className="flex min-h-full">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/8 bg-ink-900/60 px-4 py-6 lg:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="font-display flex h-10 w-10 items-center justify-center rounded-xl bg-signal-400 text-lg font-bold text-ink-950">
            C
          </div>
          <div>
            <p className="font-display text-base font-bold tracking-tight text-white">CAMPUSLINK</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Career Intel OS
            </p>
          </div>
        </div>

        <p className="mt-8 px-2 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
          Student
        </p>
        <nav className="mt-2 space-y-1">
          {STUDENT_NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-signal-400/10 text-signal-300"
                    : "text-slate-400 hover:bg-white/5 hover:text-white",
                )
              }
            >
              <n.icon size={17} strokeWidth={2.2} />
              {n.label}
            </NavLink>
          ))}
        </nav>

        <p className="mt-6 px-2 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
          Placement cell
        </p>
        <nav className="mt-2 space-y-1">
          {STAFF_NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sky-400/10 text-sky-300"
                    : "text-slate-400 hover:bg-white/5 hover:text-white",
                )
              }
            >
              <n.icon size={17} strokeWidth={2.2} />
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto rounded-2xl border border-white/8 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Readiness</p>
            <Backpack size={14} className="text-slate-500" />
          </div>
          <p className="font-display mt-1 text-3xl font-bold text-white">
            {score ?? "–"}
            <span className="text-sm text-slate-500">/100</span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-signal-400 transition-all"
              style={{ width: `${score ?? 0}%` }}
            />
          </div>
          <p className="mt-1.5 font-mono text-[10px] text-slate-600">from PostgreSQL records</p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-white/8 bg-ink-950/85 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-8">
            <div className="font-display flex h-9 w-9 items-center justify-center rounded-lg bg-signal-400 font-bold text-ink-950 lg:hidden">
              C
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {profile.data ? `${profile.data.fullName} · ${profile.data.branch ?? ""}` : "CAMPUSLINK"}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                Dev build — no auth yet · writes are local-only
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <StatusPill label="api" status={health} />
              <StatusPill label="db" status={ready} />
            </div>
          </div>
          {/* Mobile nav */}
          <nav className="flex gap-1 overflow-x-auto px-4 pb-3 lg:hidden">
            {[...STUDENT_NAV, ...STAFF_NAV].map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
                    isActive
                      ? "border-signal-500/40 bg-signal-400/10 text-signal-300"
                      : "border-white/10 text-slate-400",
                  )
                }
              >
                <n.icon size={13} />
                {n.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </main>

        <footer className="border-t border-white/8 px-8 py-4">
          <p className="font-mono text-[11px] text-slate-600">
            CAMPUSLINK dev build · local PostgreSQL + Express API · rule-based scoring, no AI
            predictions · no authentication yet — do not expose publicly
          </p>
        </footer>
      </div>
    </div>
  );
}
