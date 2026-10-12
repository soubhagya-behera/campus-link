import {
  Backpack,
  Bell,
  Briefcase,
  Dumbbell,
  Fingerprint,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  LogOut,
  Medal,
  Megaphone,
  MoreHorizontal,
  Radar,
  Swords,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { fetchHealth, fetchReady, type ApiStatus } from "../lib/api";
import { cn } from "../lib/cn";
import { api } from "../lib/server";
import { unreadCount } from "../lib/announcements";
import { Mark } from "../landing/components/bits";
import MobileMenu from "./MobileMenu";
import { isPlacement, useProfile, useProfileId, useReadiness, useSessionUser, useTower } from "../store/session";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

const STAFF_NAV: NavItem[] = [
  { to: "/tower", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/tower#drives", label: "Company Drives", icon: Briefcase },
  { to: "/tower#applications", label: "Applications", icon: Inbox },
  { to: "/tower/students", label: "Students", icon: Users },
  { to: "/tower/announcements", label: "Announcements", icon: Megaphone },
  { to: "/tower/arena", label: "Arena Bank", icon: GraduationCap },
];

/** Hash part of a staff nav target ("" for the overview itself). */
function navHash(to: string): string {
  const i = to.indexOf("#");
  return i >= 0 ? to.slice(i) : "";
}

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

/** Original CAMPUSLINK brand: the landing mark at its own aspect ratio, plus
 *  wordmark and tagline where space permits. */
function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--ws-forest)]">
        <Mark className="h-5 w-5 text-[var(--ws-canvas)]" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-bold tracking-tight text-[var(--ws-ink)]">
          CAMPUSLINK
        </span>
        {!compact && (
          <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--ws-faint)]">
            Career Intelligence
          </span>
        )}
      </span>
    </span>
  );
}

/** Student notification bell with unread badge (9+ caps large counts). */
function NoticeBell({ count }: { count: number }) {
  return (
    <Link
      to="/notifications"
      aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
      className="relative grid min-h-[44px] min-w-[44px] place-items-center rounded-lg border border-[var(--ws-line)] text-[var(--ws-forest)]"
    >
      <Bell size={18} aria-hidden="true" />
      {count > 0 && (
        <span aria-hidden="true" className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--ws-forest)] px-1 font-mono text-[10px] font-bold text-[var(--ws-canvas)]">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
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
  const student = !!useProfileId();
  const tower = useTower(placement);
  const unread = useQuery({
    queryKey: ["notifications-unread", user?.studentProfileId ?? null],
    queryFn: unreadCount,
    enabled: student,
    refetchInterval: 30_000,
  });
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

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
    setMenuOpen(false);
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

  // Close the mobile menu on Escape and return focus to the trigger.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Close the mobile menu on navigation.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.hash]);

  const score = readiness.data?.score;

  return (
    <div className="ws flex min-h-full">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--ws-line)] bg-[var(--ws-surface)] px-4 py-6 lg:flex">
        <div className="px-2">
          <Brand />
        </div>

        <p className="mt-8 px-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--ws-faint)]">
          {placement ? "Placement" : "Student"}
        </p>
        {student ? (
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
        ) : placement ? (
          <nav className="mt-2 space-y-1" aria-label="Placement">
            {STAFF_NAV.map((n) => {
              const hash = navHash(n.to);
              const pathname = n.to.split("#")[0];
              const isActive =
                location.pathname === pathname &&
                (hash ? location.hash === hash : location.hash === "");
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[var(--ws-forest)] text-[var(--ws-canvas)]"
                      : "text-[var(--ws-mute)] hover:bg-[#eef0ea] hover:text-[var(--ws-forest)]",
                  )}
                >
                  <n.icon size={17} strokeWidth={2.2} />
                  {n.label}
                </Link>
              );
            })}
          </nav>
        ) : (
          <div className="mt-2 rounded-xl border border-[var(--ws-line)] bg-[var(--ws-canvas)] p-3">
            <p className="text-sm font-semibold text-[var(--ws-ink)]">No portal for this account</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--ws-mute)]">
              No recruiter portal for this account. Contact your placement cell.
            </p>
          </div>
        )}

        {student ? (
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
            <p className="mt-1.5 font-mono text-[10px] text-[var(--ws-faint)]">from your records</p>
          </div>
        ) : placement && tower.data ? (
          <div className="mt-auto rounded-2xl border border-[var(--ws-line)] bg-[var(--ws-canvas)] p-4">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ws-faint)]">
                Batch proficiency
              </p>
              <Backpack size={14} className="text-[var(--ws-faint)]" />
            </div>
            <p className="font-display mt-1 text-3xl font-bold text-[var(--ws-ink)]">
              {tower.data.avgReadiness}
              <span className="text-sm text-[var(--ws-faint)]">/100</span>
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--ws-line-soft)]">
              <div
                className="h-full rounded-full bg-[var(--ws-forest)] transition-all"
                style={{ width: `${tower.data.avgReadiness}%` }}
              />
            </div>
            <p className="mt-1.5 font-mono text-[10px] text-[var(--ws-faint)]">
              mean recorded level · {tower.data.students} students
            </p>
          </div>
        ) : null}
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-[var(--ws-line)] bg-[var(--ws-surface)]/90 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-8">
            <div className="min-w-0 lg:hidden">
              <Brand compact />
            </div>
            <div className="hidden min-w-0 lg:block">
              <p className="truncate text-sm font-semibold text-[var(--ws-ink)]">
                {profile.data ? `${profile.data.fullName} · ${profile.data.branch ?? ""}` : user ? `Signed in as ${user.email}` : "CAMPUSLINK"}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ws-faint)]">
                {user ? `${user.role} workspace` : "Local session"}
              </p>
            </div>
            {/* Desktop account cluster */}
            <div className="ml-auto hidden items-center gap-2 lg:flex">
              <StatusPill label="api" status={health} />
              <StatusPill label="db" status={ready} />
              {student ? <NoticeBell count={unread.data ?? 0} /> : null}
              <button
                type="button"
                onClick={() => void signOut()}
                disabled={signingOut}
                aria-label="Sign out of CAMPUSLINK"
                title="Sign out"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[var(--ws-forest)] px-3 py-2 text-sm font-semibold text-[var(--ws-forest)] hover:bg-[var(--ws-forest)] hover:text-[var(--ws-canvas)] disabled:opacity-50"
              >
                <LogOut size={15} />
                <span>{signingOut ? "Signing out…" : "Sign out"}</span>
              </button>
            </div>
            {/* Mobile actions: bell stays visible next to the menu trigger */}
            <div className="ml-auto flex items-center gap-2 lg:hidden">
              {student ? <NoticeBell count={unread.data ?? 0} /> : null}
              <button
                ref={menuButtonRef}
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-controls="ws-mobile-menu"
                aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
                className="grid min-h-[44px] min-w-[44px] place-items-center rounded-lg border border-[var(--ws-line)] text-[var(--ws-forest)]"
              >
                {menuOpen ? <X size={20} /> : <MoreHorizontal size={20} />}
              </button>
            </div>
          </div>
          {signOutError ? (
            <p role="alert" className="border-t border-[#e8c6bf] bg-[var(--ws-err-bg)] px-4 py-2 text-sm text-[var(--ws-err)] sm:px-8">
              {signOutError} You are still signed in.
            </p>
          ) : null}
          {menuOpen ? (
            <MobileMenu
              items={student ? STUDENT_NAV : placement ? STAFF_NAV : []}
              heading={placement ? "Placement" : "Student"}
              userEmail={user?.email ?? null}
              showRecruiterNote={!!user && !student && !placement}
              signingOut={signingOut}
              hash={location.hash}
              pathname={location.pathname}
              hashOf={navHash}
              onClose={() => setMenuOpen(false)}
              onSignOut={() => void signOut()}
            />
          ) : null}
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </main>

        <footer className="border-t border-[var(--ws-line)] px-4 py-3 sm:px-8">
          <p className="text-center text-xs text-[var(--ws-faint)]">Created by Bibhudutta &amp; Team</p>
        </footer>
      </div>
    </div>
  );
}
