import { Bell, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../lib/cn";
import { Mark } from "../landing/components/bits";
import type { ApiStatus } from "../lib/api";

export function StatusPill({ label, status }: { label: string; status: ApiStatus | null }) {
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

/** Compact workspace identity: avatar + primary name + workspace label.
 *  Staff see the placement-team mark; students see their initials. The email
 *  stays available as a tooltip, never as the headline. */
export function Identity({
  kind,
  primary,
  secondary,
  email,
  initials,
}: {
  kind: "student" | "staff" | "other";
  primary: string;
  secondary: string;
  email: string | null;
  initials: string | null;
}) {
  return (
    <span className="ws-id flex min-w-0 items-center gap-2.5" title={email ? `Signed in as ${email}` : undefined}>
      <span className="ws-id-avatar grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--ws-line)] bg-[var(--ws-lime-wash)] text-[var(--ws-forest)]" aria-hidden="true">
        {kind === "student" && initials ? (
          <span className="text-xs font-bold">{initials}</span>
        ) : (
          <Users size={16} />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold leading-tight text-[var(--ws-ink)]">
          {primary}
        </span>
        <span className="block truncate font-mono text-[10px] uppercase tracking-widest text-[var(--ws-faint)]">
          {secondary}
        </span>
      </span>
    </span>
  );
}

/** Original CAMPUSLINK brand: the landing mark at its own aspect ratio, plus
 *  wordmark and tagline where space permits. */
export function Brand({ compact = false }: { compact?: boolean }) {
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
export function NoticeBell({ count }: { count: number }) {
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
