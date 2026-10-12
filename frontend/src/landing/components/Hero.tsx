import { useRef, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useScrollProgress } from "../hooks/useReveal";
import { Arrow } from "./bits";
import HeroScene from "./HeroScene";

const PROOF = ["No black-box scoring", "Every claim links to a record", "Also used by placement cells"];

export default function Hero() {
  const hero = useRef<HTMLElement | null>(null);
  useScrollProgress(hero, "--cl-scroll");

  return (
    <section className="cl-hero" id="top" ref={hero} aria-labelledby="hero-title">
      <div className="cl-hero-wash" aria-hidden="true" />

      <div className="cl-shell cl-hero-grid">
        <div className="cl-hero-copy">
          <p className="cl-eyebrow cl-fade-up" style={{ "--d": "40ms" } as CSSProperties}>
            Career intelligence for students
          </p>

          <h1 className="cl-hero-title" id="hero-title">
            <span className="cl-mask">
              <span style={{ "--d": "80ms" } as CSSProperties}>Your skills.</span>
            </span>
            <span className="cl-mask">
              <span style={{ "--d": "190ms" } as CSSProperties}>
                Your <em>next move</em>.
              </span>
            </span>
          </h1>

          <p className="cl-lede cl-fade-up" style={{ "--d": "400ms" } as CSSProperties}>
            Turn your skills and projects into verified evidence. Discover opportunities that fit
            what you can do.
          </p>

          <div className="cl-hero-actions cl-fade-up" style={{ "--d": "500ms" } as CSSProperties}>
            <Link className="cl-btn cl-btn--primary cl-btn--lg" to="/register">
              Get started <Arrow />
            </Link>
            <a className="cl-link" href="#journey">
              Explore the platform <Arrow />
            </a>
          </div>

          <ul className="cl-hero-proof cl-fade-up" style={{ "--d": "600ms" } as CSSProperties}>
            {PROOF.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <HeroScene />
      </div>
    </section>
  );
}
