import {
  Backpack,
  Briefcase,
  Dumbbell,
  Fingerprint,
  LayoutDashboard,
  LogOut,
  Medal,
  Radar,
  Swords,
  TowerControl,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { fetchHealth, fetchReady, type ApiStatus } from "../lib/api";
import { cn } from "../lib/cn";
import { api } from "../lib/server";
import { isPlacement, useProfile, useReadiness, useSessionUser } from "../store/session";
import { useQueryClient } from "@tanstack/react-query";
import "./workspace.css";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const STUDENT_NAV: NavItem[] = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, end: true },
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
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ws-line)] bg-[var(--ws-surface)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--ws-faint)]"
      title={status?.latencyMs != null ? `${status.latencyMs}ms` : "checking…"}
    >
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          status == null ? "bg-[#849581]" : status.ok ? "bg-[var(--ws-forest)] live-dot" : "bg-[var(--ws-err)]",
        )}
      />
      {label} {status == null ? "…" : status.ok ? "live" : "down"}
    </span>
  );
}

export default function Shell() {
  const [health, setHealth] = useState<ApiStatus | null>(null);
  const [ready, setReady] = useState<ApiStatus | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const readiness = useReadiness();
  const profile = useProfile();
  const user = useSessionUser();
  const placement = isPlacement(user);
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();

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

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(null);
    try {
      await api.logout();
      await qc.invalidateQueries({ queryKey: ["session"] });
      navigate("/login", { replace: true });
    } catch (e) {
      // Stay signed in: the server rejected the request, so claiming
      // otherwise would strand the user on a false login screen.
      setSignOutError(e instanceof Error ? e.message : "Sign out failed. Try again.");
    } finally {
      setSigningOut(false);
    }
  };

  const score = readiness.data?.score;

  return (
    <div className="ws flex min-h-full">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--ws-line)] bg-[var(--ws-surface)] px-4 py-6 lg:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="font-display flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--ws-forest)] text-lg font-bold text-[var(--ws-canvas)]">
            C
          </div>
          <div>
            <p className="font-display text-base font-bold tracking-tight text-[var(--ws-ink)]">CAMPUSLINK</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--ws-faint)]">
              Career Intel OS
            </p>
          </div>
        </div>

        <p className="mt-8 px-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--ws-faint)]">
          {placement ? "Workspace" : "Student"}
        </p>
        <nav className="mt-2 space-y-1" aria-label="Workspace">
          {STUDENT_NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  "flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[var(--ws-lime-wash)] font-semibold text-[var(--ws-forest)]"
                    : "text-[var(--ws-mute)] hover:bg-[#eef0ea] hover:text-[var(--ws-forest)]",
                )
              }
            >
              <n.icon size={17} strokeWidth={2.2} />
              {n.label}
            </NavLink>
          ))}
        </nav>

        {/* The backend enforces STAFF/ADMIN on /api/tower/*; hiding the link
            from other roles avoids sending them to a guaranteed 403. */}
        {placement ? (
          <>
            <p className="mt-6 px-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--ws-faint)]">
              Placement cell
            </p>
            <nav className="mt-2 space-y-1" aria-label="Placement">
              {STAFF_NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) =>
                    cn(
                      "flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-[var(--ws-forest)] text-[var(--ws-canvas)]"
                        : "text-[var(--ws-mute)] hover:bg-[#eef0ea] hover:text-[var(--ws-forest)]",
                    )
                  }
                >
                  <n.icon size={17} strokeWidth={2.2} />
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </>
        ) : null}

        <div className="mt-auto rounded-2xl border border-[var(--ws-line)] bg-[var(--ws-canvas)] p-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ws-faint)]">Readiness</p>
            <Backpack size={14} className="text-[var(--ws-faint)]" />
          </div>
          <p className="font-display mt-1 text-3xl font-bold text-[var(--ws-ink)]">
            {score ?? "–"}
            <span className="text-sm text-[var(--ws-faint)]">/100</span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--ws-line-soft)]">
            <div
              className="h-full rounded-full bg-[var(--ws-forest)] transition-all"
              style={{ width: `${score ?? 0}%` }}
            />
          </div>
          <p className="mt-1.5 font-mono text-[10px] text-[var(--ws-faint)]">from PostgreSQL records</p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-[var(--ws-line)] bg-[var(--ws-surface)]/90 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-8">
            <div className="font-display flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--ws-forest)] font-bold text-[var(--ws-canvas)] lg:hidden">
              C
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--ws-ink)]">
                {profile.data ? `${profile.data.fullName} · ${profile.data.branch ?? ""}` : "CAMPUSLINK"}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ws-faint)]">
                {user ? `Signed in as ${user.email} · ${user.role}` : "Local session"}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <StatusPill label="api" status={health} />
              <StatusPill label="db" status={ready} />
              <button
                type="button"
                onClick={() => void signOut()}
                disabled={signingOut}
                aria-label="Sign out of CAMPUSLINK"
                title="Sign out"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[var(--ws-forest)] px-3 py-2 text-sm font-semibold text-[var(--ws-forest)] hover:bg-[var(--ws-forest)] hover:text-[var(--ws-canvas)] disabled:opacity-50"
              >
                <LogOut size={15} />
                <span className="hidden sm:inline">{signingOut ? "Signing out…" : "Sign out"}</span>
              </button>
            </div>
          </div>
          {signOutError ? (
            <p role="alert" className="border-t border-[#e8c6bf] bg-[var(--ws-err-bg)] px-4 py-2 text-sm text-[var(--ws-err)] sm:px-8">
              {signOutError} You are still signed in.
            </p>
          ) : null}
          {/* Mobile nav */}
          <nav className="flex gap-1 overflow-x-auto px-4 pb-3 lg:hidden" aria-label="Workspace">
            {(placement ? [...STUDENT_NAV, ...STAFF_NAV] : STUDENT_NAV).map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
                    isActive
                      ? "border-[var(--ws-forest)] bg-[var(--ws-lime-wash)] text-[var(--ws-forest)]"
                      : "border-[var(--ws-line)] bg-[var(--ws-surface)] text-[var(--ws-mute)]",
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

        <footer className="border-t border-[var(--ws-line)] px-8 py-4">
          <p className="font-mono text-[11px] leading-relaxed text-[var(--ws-faint)]">
            CAMPUSLINK dev build · local PostgreSQL + Express API · rule-based scoring, no AI
            predictions · localhost only — do not expose publicly
          </p>
        </footer>
      </div>
    </div>
  );
}
