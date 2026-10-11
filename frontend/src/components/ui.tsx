import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/8 bg-ink-900/80 p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_12px_32px_-16px_rgba(0,0,0,0.7)]",
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
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-signal-400">{kicker}</p>
        <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {title}
        </h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-slate-400">{sub}</p>}
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
    neutral: "border-white/10 bg-white/5 text-slate-300",
    signal: "border-signal-500/30 bg-signal-500/10 text-signal-300",
    sky: "border-sky-400/30 bg-sky-400/10 text-sky-300",
    amber: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    rose: "border-rose-400/30 bg-rose-400/10 text-rose-300",
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
    signal: "bg-signal-400",
    sky: "bg-sky-400",
    amber: "bg-amber-400",
  };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/8">
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
        <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
        <circle
          cx="55"
          cy="55"
          r={r}
          fill="none"
          stroke="#bef264"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * clamped) / 100}
          transform="rotate(-90 55 55)"
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-bold text-white">{clamped}</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">ready</span>
      </div>
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-12 text-center">
      <p className="font-display text-lg font-semibold text-white">{title}</p>
      <p className="mt-1 max-w-md text-sm text-slate-400">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function DemoTag() {
  return (
    <Badge tone="signal">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-signal-400 live-dot" />
      POSTGRES · LIVE
    </Badge>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-ink-900/60 p-6 text-sm text-slate-400">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-signal-400" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-400/30 bg-rose-400/[0.05] p-6">
      <p className="font-semibold text-rose-200">Something went wrong</p>
      <p className="mt-1 text-sm text-slate-300">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-lg border border-white/15 px-3 py-1.5 text-sm font-medium text-white hover:border-white/30"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Unexpected error";
}
