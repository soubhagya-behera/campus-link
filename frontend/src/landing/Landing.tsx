import { useEffect } from "react";
import CapabilitiesSection from "./components/PlatformSection";
import EvidenceSection from "./components/EvidenceSection";
import FinalCta from "./components/FinalCta";
import Hero from "./components/Hero";
import JourneySection from "./components/JourneySection";
import LandingFooter from "./components/LandingFooter";
import LandingHeader from "./components/LandingHeader";
import RecruitersSection from "./components/RecruitersSection";
import { useReducedMotion } from "./hooks/useReducedMotion";
import { usePageVisible } from "./hooks/usePageVisible";
import "./landing.css";

/**
 * The public homepage.
 *
 * Renders outside SessionProvider on purpose: it never waits on, and never
 * fails with, the local API's demo-identity request, so a visitor with the
 * backend stopped still gets the entire page.
 */
export default function Landing() {
  const reduced = useReducedMotion();
  const visible = usePageVisible();

  // Anchor links glide only when the visitor has not asked us to stop moving
  // things. Scoped to the document while the page is mounted, so the
  // authenticated app is unaffected.
  useEffect(() => {
    const root = document.documentElement;
    if (reduced) {
      root.style.removeProperty("scroll-behavior");
      return;
    }
    root.style.scrollBehavior = "smooth";
    return () => {
      root.style.removeProperty("scroll-behavior");
    };
  }, [reduced]);

  // The no-JS guard class ships in index.html; React has taken over, so drop it.
  useEffect(() => {
    document.documentElement.classList.remove("cl-no-js");
  }, []);

  return (
    <div className="cl" data-paused={visible ? undefined : "true"}>
      <a className="cl-skip" href="#journey">
        Skip to content
      </a>
      <LandingHeader />
      <main id="main">
        <Hero />
        <JourneySection />
        <CapabilitiesSection />
        <EvidenceSection />
        <RecruitersSection />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
