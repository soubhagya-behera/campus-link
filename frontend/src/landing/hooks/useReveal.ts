import { useEffect, useRef, useState, type RefObject } from "react";

interface RevealOptions {
  /** Fraction of the element that must be visible. */
  threshold?: number;
  /** Fires before the element enters, e.g. "0px 0px -12% 0px". */
  rootMargin?: string;
  /** Re-hide when it leaves the viewport. Off by default (one-shot reveals). */
  repeat?: boolean;
}

/**
 * Adds `is-in` to the returned element once it enters the viewport.
 * If IntersectionObserver is unavailable the hook starts out revealed, so
 * content is never trapped behind an effect that cannot run.
 */
export function useReveal<T extends HTMLElement>(
  { threshold = 0.15, rootMargin = "0px 0px -6% 0px", repeat = false }: RevealOptions = {},
) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        setInView(entry.isIntersecting);
        if (entry.isIntersecting && !repeat) io.disconnect();
      },
      { threshold, rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin, repeat]);

  return { ref, inView } as const;
}

/**
 * Writes a 0 to 1 scroll-progress value to a CSS custom property on an element.
 *
 * Runs entirely outside React state: one rAF-coalesced passive listener that
 * writes a single custom property. Scrolling causes no re-render, and the
 * transforms that read the value stay on the compositor.
 *
 * `mode`:
 *  - "exit"   0 as the element reaches the top of the viewport, 1 as it leaves.
 *             Used for hero parallax.
 *  - "through" 0 as the element's bottom enters the viewport, 1 as its top
 *             reaches the top. Used for the journey rail, so it fills while
 *             the section is being read rather than after it.
 */
export function useScrollProgress(
  ref: RefObject<HTMLElement | null>,
  property: string,
  mode: "exit" | "through" = "exit",
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const progress =
        mode === "through"
          ? clamp((vh - rect.top) / (vh + rect.height))
          : clamp(-rect.top / Math.max(1, rect.height));
      el.style.setProperty(property, progress.toFixed(4));
    };
    const request = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
    };
  }, [ref, property, mode]);
}
