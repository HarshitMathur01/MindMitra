import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import WatercolorScene from "./WatercolorScene";

/**
 * Hand-painted animation videos served from /public/videos/.
 *
 * Sources live alongside the watercolor PNGs but ship as static MP4
 * because they're 2–4 MB each — Vite would otherwise inline-hash them
 * into the JS asset graph.
 *
 * Honours `prefers-reduced-motion`: when the user has that preference
 * set we don't even mount the <video> element — we render the static
 * `poster` watercolor scene instead.
 */
type VideoName =
  | "breathing"
  | "companion_deer"
  | "inhale_exhale"
  | "meditating"
  | "meditating_calming"
  | "mountain_scenary";

type PosterScene =
  | "hills"
  | "presence"
  | "breath"
  | "solitude"
  | "companions"
  | "mountain";

interface WatercolorVideoProps {
  name: VideoName;
  /** Static watercolor scene shown before the video plays + as the
   *  reduced-motion fallback. */
  poster: PosterScene;
  className?: string;
  loading?: "eager" | "lazy";
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

export function WatercolorVideo({
  name,
  poster,
  className,
  loading = "lazy",
}: WatercolorVideoProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion) return;
    if (loading === "eager") {
      void el.play().catch(() => {
        /* autoplay blocked — poster stays */
      });
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            void el.play().catch(() => {
              /* ignore */
            });
          } else {
            el.pause();
          }
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, prefersReducedMotion]);

  if (prefersReducedMotion) {
    return (
      <WatercolorScene
        name={poster}
        loading={loading}
        className={className}
      />
    );
  }

  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      preload={loading === "eager" ? "auto" : "none"}
      poster={`/illustrations/${poster}-1600.webp`}
      className={cn("h-auto w-full select-none", className)}
      draggable={false}
      aria-hidden
    >
      <source src={`/videos/${name}.mp4`} type="video/mp4" />
    </video>
  );
}

export default WatercolorVideo;
