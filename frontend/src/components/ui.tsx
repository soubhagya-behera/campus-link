import type { ReactNode } from "react";
import { cn } from "../lib/cn";

/**
 * Shared workspace primitives. Rendered inside the .ws theme scope, so these
 * use the landing-derived workspace tokens (ivory canvas, forest ink, lime
 * reserved for highlights) instead of the old near-black styling.
 */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-[14px] border border-[var(--ws-line)] bg-[var(--ws-surface)] p-5 text-[var(--ws-ink)] shadow-[0_1px_2px_rgb(32_40_34/0.04),0_2px_8px_-4px_rgb(32_40_34/0.08)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  kicker,
  title,
  sub,
  right,
}: {
  kicker: string;
  title: string;
  sub?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--ws-forest)]">{kicker}</p>
        <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-[var(--ws-ink)] sm:text-3xl">
          {title}
        </h1>
        {sub && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--ws-mute)]">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "signal" | "sky" | "amber" | "rose";
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    neutral: "border-[var(--ws-line)] bg-[#eef0ea] text-[var(--ws-mute)]",
    signal: "border-[rgb(63_84_23/0.35)] bg-[var(--ws-lime-wash)] text-[var(--ws-lime-ink)]",
    sky: "border-[#c4dde8] bg-[var(--ws-sky-bg)] text-[var(--ws-sky)]",
    amber: "border-[#e5d3a8] bg-[var(--ws-warn-bg)] text-[var(--ws-warn)]",
    rose: "border-[#e8c6bf] bg-[var(--ws-err-bg)] text-[var(--ws-err)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Meter({ value, tone = "signal" }: { value: number; tone?: "signal" | "sky" | "amber" }) {
  const bar: Record<string, string> = {
    signal: "bg-[var(--ws-forest)]",
    sky: "bg-[var(--ws-sky)]",
    amber: "bg-[#b87e00]",
  };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--ws-line-soft)]">
      <div
        className={cn("h-full rounded-full transition-[width] duration-700", bar[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Ring({ value, size = 120 }: { value: number; size?: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 110 110" width={size} height={size}>
        <circle cx="55" cy="55" r={r} fill="none" stroke="var(--ws-line-soft)" strokeWidth="10" />
        <circle
          cx="55"
          cy="55"
          r={r}
          fill="none"
          stroke="var(--ws-forest)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * clamped) / 100}
          transform="rotate(-90 55 55)"
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-bold text-[var(--ws-ink)]">{clamped}</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--ws-faint)]">ready</span>
      </div>
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[14px] border border-dashed border-[var(--ws-line)] bg-[var(--ws-surface)] px-6 py-12 text-center">
      <p className="font-display text-lg font-semibold text-[var(--ws-ink)]">{title}</p>
      <p className="mt-1 max-w-md text-sm leading-relaxed text-[var(--ws-mute)]">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function DemoTag() {
  return (
    <Badge tone="signal">
      <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-[var(--ws-forest)]" />
      POSTGRES · LIVE
    </Badge>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-[var(--ws-line)] bg-[var(--ws-surface)] p-6 text-sm text-[var(--ws-mute)]">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--ws-line)] border-t-[var(--ws-forest)]" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-[14px] border border-[#e8c6bf] bg-[var(--ws-err-bg)] p-6">
      <p className="font-semibold text-[var(--ws-err)]">Something went wrong</p>
      <p className="mt-1 text-sm leading-relaxed text-[var(--ws-ink)]">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-lg border border-[var(--ws-forest)] px-3 py-1.5 text-sm font-medium text-[var(--ws-forest)] hover:bg-[var(--ws-forest)] hover:text-[var(--ws-canvas)]"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/**
 * Shown when an authenticated account has no student profile (staff, admin,
 * recruiter). The student queries stay disabled, so without this the page
 * would spin forever.
 */
export function NoStudentState({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <SectionTitle kicker={kicker} title={title} right={<DemoTag />} />
      <Card className="p-6">
        <p className="text-sm leading-relaxed text-[var(--ws-mute)]">
          This workspace is for student accounts. You are signed in with an account that is not linked
          to a student profile, so there is nothing to show here. Placement staff can use the Placement
          Tower instead.
        </p>
      </Card>
    </div>
  );
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Unexpected error";
}
