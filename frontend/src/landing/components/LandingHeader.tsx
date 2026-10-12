import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Arrow, Wordmark } from "./bits";

const NAV = [
  { href: "#journey", label: "How it works" },
  { href: "#platform", label: "Product" },
  { href: "#evidence", label: "For students" },
  { href: "#recruiters", label: "For recruiters" },
] as const;

/** Sections the header highlights as the reader moves down the page. */
const TRACKED = NAV.map((n) => n.href.slice(1));

export default function LandingHeader() {
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Highlight whichever tracked section currently crosses the reading band.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const visible = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).id;
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        setCurrent(TRACKED.find((id) => visible.has(id)) ?? null);
      },
      { rootMargin: "-42% 0px -52% 0px", threshold: 0 },
    );
    for (const id of TRACKED) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header className={`cl-head${stuck ? " is-stuck" : ""}`}>
        <div className="cl-shell cl-head-in">
          <Wordmark to="/" />

          <nav className="cl-nav" aria-label="Primary">
            {NAV.map((item) => (
              <a
                key={item.href}
                className="cl-nav-link"
                href={item.href}
                aria-current={current === item.href.slice(1) ? "true" : undefined}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="cl-head-cta">
            <Link className="cl-link" to="/login">
              Log in <Arrow />
            </Link>
            <Link className="cl-btn cl-btn--primary" to="/register">
              Get started <Arrow />
            </Link>
            <button
              type="button"
              className="cl-burger"
              aria-expanded={open}
              aria-controls="cl-drawer"
              onClick={() => setOpen((v) => !v)}
            >
              <span className="cl-burger-bars" />
              <span className="cl-sr">{open ? "Close menu" : "Open menu"}</span>
            </button>
          </div>
        </div>
      </header>

      <div id="cl-drawer" className={`cl-drawer${open ? " is-open" : ""}`} hidden={!open}>
        <nav aria-label="Mobile">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setOpen(false)}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="cl-drawer-cta">
          <Link className="cl-btn cl-btn--primary cl-btn--lg" to="/register" onClick={() => setOpen(false)}>
            Get started <Arrow />
          </Link>
          <Link className="cl-btn cl-btn--quiet cl-btn--lg" to="/login" onClick={() => setOpen(false)}>
            Log in
          </Link>
        </div>
      </div>
    </>
  );
}
