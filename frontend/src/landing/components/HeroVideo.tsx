import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion";

const VIDEO_SRC = `${import.meta.env.BASE_URL}gemini_generated_video_452e3e23.mp4`;
const POSTER_SRC = `${import.meta.env.BASE_URL}hero-tree-poster.jpg`;

/**
 * The Ridgeline, on film.
 *
 * The same right-hand hero panel that previously held the inline-SVG
 * landscape now plays the reference tree animation: a dark career tree that
 * ignites from the roots upward until every branch and station glows.
 *
 * Fitting notes (video is 1280x720, 24fps, 10s):
 *  - The tree card itself is centred in the frame, flanked by expendable
 *    dark-green ambient blur. `object-fit: cover` in the square panel crops
 *    those ambient sides first, so the tree, glow origin and summit fix all
 *    stay visible. `object-position: center` is deliberate, not a default:
 *    the card is horizontally centred in the source.
 *  - Frame analysis: the first ~1.2s sits on a white field before the dark
 *    forest fades in, so playback starts at ~1.6s and the panel never
 *    flashes white. The film plays once and holds its final illuminated
 *    frame (no loop: the bright ending snaps back to the white opening).
 *  - The panel keeps its rounded corners and clips the video via
 *    `overflow: hidden`; the flat fallback background matches the video's
 *    ambient green so no white strips ever show while loading.
 *  - The station captions are baked into the footage, so no HTML overlay
 *    tags are rendered (they would duplicate and misalign).
 *  - `prefers-reduced-motion` renders the final-frame poster instead of the
 *    video. No animation libraries, no simulated effects on top.
 */
/** First frame sits on a white field; the forest has faded in by here. */
const SKIP_INTRO = 1.6;

export default function HeroVideo() {
  const reduced = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // The film stays transparent until its first sought frame (or any
  // playing signal) arrives, so the white opening field can never paint.
  // `onPlaying` is the fallback: the video can never get stuck invisible.
  // Applied as a React inline style so no-JS visitors still see the poster.
  const [live, setLive] = useState(false);
  const reveal = () => setLive(true);

  useEffect(() => {
    if (reduced) return;
    const video = videoRef.current;
    if (!video) return;
    // The `muted` JSX attribute maps to the content attribute; several
    // browsers only honour the IDL property for autoplay, so set both.
    video.muted = true;
    const start = () => {
      try {
        video.currentTime = SKIP_INTRO;
      } catch {
        /* seeking unsupported: play from wherever is available */
      }
      const attempt = video.play();
      if (attempt) {
        // Autoplay blocked: swallow the rejection and leave the sought
        // opening frame (dark forest, glow igniting) in place.
        attempt.catch(() => {});
      }
    };
    if (video.readyState >= 1) {
      start();
      return;
    }
    video.addEventListener("loadedmetadata", start, { once: true });
    return () => video.removeEventListener("loadedmetadata", start);
  }, [reduced]);

  return (
    <figure className="cl-scene cl-scene--video">
      <div className="cl-scene-frame">
        {reduced ? (
          <img
            className="cl-scene-media"
            src={POSTER_SRC}
            alt="An illuminated green career tree rising from roots through skills, projects, readiness and matching to the next move"
          />
        ) : (
          <video
            ref={videoRef}
            className="cl-scene-media"
            style={live ? undefined : { opacity: 0 }}
            src={VIDEO_SRC}
            poster={POSTER_SRC}
            autoPlay
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            aria-hidden="true"
            tabIndex={-1}
            onSeeked={reveal}
            onPlaying={reveal}
          />
        )}
      </div>
      <figcaption className="cl-sr">
        A career tree that ignites from the roots upward: skills, projects,
        readiness and matching light up along the path to the next move.
      </figcaption>
    </figure>
  );
}
