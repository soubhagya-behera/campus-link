import { LogOut } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { cn } from "../lib/cn";

interface MenuEntry {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string }>;
  end?: boolean;
}

/**
 * Mobile three-dot menu panel: every destination for the current role plus
 * Sign out. Closes on selection, backdrop tap, or Escape (handled by the
 * parent). Panel positioning/visibility is owned by the parent header.
 */
export default function MobileMenu({
  items,
  heading,
  userEmail,
  showRecruiterNote,
  signingOut,
  hash,
  pathname,
  hashOf,
  onClose,
  onSignOut,
}: {
  items: MenuEntry[];
  heading: string;
  userEmail: string | null;
  showRecruiterNote: boolean;
  signingOut: boolean;
  hash: string;
  pathname: string;
  hashOf: (to: string) => string;
  onClose: () => void;
  onSignOut: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-10 lg:hidden" onClick={onClose} aria-hidden="true" />
      <nav
        id="ws-mobile-menu"
        aria-label={heading}
        className="absolute inset-x-4 top-full z-20 max-h-[70vh] overflow-y-auto rounded-xl border border-[var(--ws-line)] bg-[var(--ws-surface)] p-2 shadow-lg lg:hidden"
      >
        <p className="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--ws-faint)]">
          {heading}
        </p>
        {items.map((n) =>
          n.to.includes("#") ? (
            <Link
              key={n.to}
              to={n.to}
              onClick={onClose}
              className={cn(
                "flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                hash === hashOf(n.to) && pathname === n.to.split("#")[0]
                  ? "bg-[var(--ws-lime-wash)] font-semibold text-[var(--ws-forest)]"
                  : "text-[var(--ws-mute)]",
              )}
            >
              <n.icon size={16} />
              {n.label}
            </Link>
          ) : (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                  isActive
                    ? "bg-[var(--ws-lime-wash)] font-semibold text-[var(--ws-forest)]"
                    : "text-[var(--ws-mute)]",
                )
              }
            >
              <n.icon size={16} />
              {n.label}
            </NavLink>
          ),
        )}
        {showRecruiterNote ? (
          <p className="px-3 py-2 text-xs leading-relaxed text-[var(--ws-mute)]">
            No recruiter portal for this account. Contact your placement cell.
          </p>
        ) : null}
        <div className="my-1 border-t border-[var(--ws-line)]" role="separator" />
        <button
          type="button"
          onClick={onSignOut}
          disabled={signingOut}
          className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--ws-forest)] disabled:opacity-50"
        >
          <LogOut size={16} />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
        <p className="px-3 py-2 font-mono text-[10px] text-[var(--ws-faint)]">
          {userEmail ? `Signed in as ${userEmail}` : ""}
        </p>
      </nav>
    </>
  );
}
