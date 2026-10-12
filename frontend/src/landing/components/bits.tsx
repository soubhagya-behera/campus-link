import type { CSSProperties, ReactNode } from "react";
import { useReveal } from "../hooks/useReveal";

/** CAMPUSLINK glyph: a ridge climbing to a fix. Matches the favicon. */
export function Mark({ className = "cl-mark-glyph" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="8"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.4"
      />
      <path
        d="M6.5 24 L14 14 L19 19.5 L25.5 8.5"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="25.5" cy="8.5" r="2.5" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ to }: { to?: string }) {
  const inner = (
    <>
      <Mark />
      <span>
        <span className="cl-mark-word">CAMPUSLINK</span>
        <span className="cl-mark-sub">Career Intelligence</span>
      </span>
    </>
  );
  if (to) {
    return (
      <a className="cl-mark" href={to}>
        {inner}
      </a>
    );
  }
  return <div className="cl-mark">{inner}</div>;
}

/** Chevron that slides on hover of its parent control. */
export function Arrow() {
  return (
    <svg
      className="cl-arrow"
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2.5 7.5h10M8.5 3.5l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type RevealTag = "div" | "li" | "section" | "article" | "figure" | "header";

/**
 * Scroll-triggered entrance. Purely additive: the element is hidden only
 * while the observer reports it off-screen, and the `cl-no-js` class on the
 * document root keeps everything readable if scripting never runs.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
  threshold = 0.15,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: RevealTag;
  threshold?: number;
}) {
  const { ref, inView } = useReveal<HTMLElement>({ threshold });
  return (
    <Tag
      ref={ref as never}
      className={`cl-reveal${inView ? " is-in" : ""}${className ? ` ${className}` : ""}`}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
