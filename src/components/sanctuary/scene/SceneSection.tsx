import { useRef, type ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { useAmbience } from "../AmbienceProvider";
import { useSceneParallax } from "./useSceneParallax";

export type SceneId = "arrival" | "checkin" | "doors" | "practice" | "reflect";

interface SceneSectionProps {
  id: SceneId;
  /** Imported watercolor artwork for the scene background. */
  image: string;
  imageWidth: number;
  imageHeight: number;
  /** Landmark name — this section is the scene's only landmark, children render as divs. */
  ariaLabel: string;
  /** Where the content column (and its legibility scrim) sits on md+. */
  align?: "start" | "center";
  /** 0 disables the background drift for this scene entirely. */
  parallaxIntensity?: number;
  /** "auto" lets dense scenes (doors) grow past the viewport. */
  minH?: "screen" | "auto";
  /** First scene only: eager-load + preload the artwork (it is the LCP image). */
  priority?: boolean;
  children: ReactNode;
}

// All scene art is high-key pale watercolor, so legibility comes from *paper*
// washes under the ink text, not dark overlays. Dark-mode note: the sanctuary
// oklch tokens have no [data-theme="dark"] override yet — dark scenes are
// deferred until the token set grows a dark variant.
const SCRIM_DESKTOP: Record<"start" | "center", string> = {
  start:
    "linear-gradient(to right, color-mix(in oklab, var(--paper-soft) 90%, transparent) 0%, color-mix(in oklab, var(--paper-soft) 72%, transparent) 45%, transparent 78%)",
  center:
    "radial-gradient(ellipse at center, color-mix(in oklab, var(--paper-soft) 86%, transparent) 0%, color-mix(in oklab, var(--paper-soft) 62%, transparent) 55%, transparent 82%)",
};

// Mobile stacks content over the whole artwork, so the wash never fully
// clears — text can sit anywhere in the column and stay readable.
const SCRIM_MOBILE =
  "linear-gradient(to top, color-mix(in oklab, var(--paper-soft) 92%, transparent) 0%, color-mix(in oklab, var(--paper-soft) 72%, transparent) 55%, color-mix(in oklab, var(--paper-soft) 42%, transparent) 100%)";

export function SceneSection({
  id,
  image,
  imageWidth,
  imageHeight,
  ariaLabel,
  align = "start",
  parallaxIntensity = 1,
  minH = "screen",
  priority = false,
  children,
}: SceneSectionProps) {
  const ref = useRef<HTMLElement>(null);
  const ambience = useAmbience();
  const { y, active } = useSceneParallax(ref, parallaxIntensity);

  return (
    <section
      ref={ref}
      id={id}
      aria-label={ariaLabel}
      className={`relative w-full overflow-hidden scroll-mt-20 ${
        minH === "screen" ? "flex min-h-[100svh] flex-col" : ""
      }`}
      style={{ backgroundColor: "var(--paper-soft)" }}
    >
      {priority && (
        <Helmet>
          <link rel="preload" as="image" href={image} />
        </Helmet>
      )}

      {/* Scene artwork — decorative; the section label carries the meaning.
          Oversized so the parallax drift never exposes an edge. */}
      <motion.div
        aria-hidden
        className="scene-bg pointer-events-none absolute inset-x-0"
        style={{ top: "-7.5%", height: "115%", y: active ? y : undefined }}
      >
        <img
          src={image}
          alt=""
          width={imageWidth}
          height={imageHeight}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          {...(priority ? { fetchpriority: "high" } : {})}
          className="h-full w-full object-cover mix-blend-multiply"
        />
      </motion.div>

      {/* Ambience tint — mood + time-of-day color the room; crisisQuiet
          drops paperWarmth and the whole page visibly stills. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `color-mix(in oklab, ${ambience.sceneAccent} 10%, transparent)`,
          opacity: ambience.paperWarmth,
        }}
      />

      {/* Legibility scrim under the content column. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 md:hidden"
        style={{ background: SCRIM_MOBILE }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden md:block"
        style={{ background: SCRIM_DESKTOP[align] }}
      />

      {/* Paper fades so the pale scenes melt into each other. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24 md:h-32"
        style={{
          background: "linear-gradient(to bottom, var(--paper-soft), transparent)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 md:h-32"
        style={{
          background: "linear-gradient(to top, var(--paper-soft), transparent)",
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-10 px-6 py-16 md:px-12 md:py-20">
        {children}
      </div>
    </section>
  );
}
