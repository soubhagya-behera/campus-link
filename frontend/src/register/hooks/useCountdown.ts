import { useEffect, useState } from "react";

/**
 * Seconds remaining until an ISO timestamp, ticking once a second.
 *
 * The server owns the real cooldown; this only mirrors it so the button label
 * stays truthful between requests. Returns 0 immediately for a timestamp in the
 * past, and clamps at 0 so a clock skew can never produce a negative wait.
 */
export function useCountdown(iso: string | null): number {
  const target = iso ? new Date(iso).getTime() : Number.NaN;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!iso) return;
    // No immediate setState: the tick interval corrects within a second, which
    // is well inside the tolerance of a countdown label.
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [iso]);

  if (!iso || Number.isNaN(target)) return 0;
  return Math.max(0, Math.ceil((target - now) / 1000));
}

/** m:ss, for a resend countdown. */
export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
