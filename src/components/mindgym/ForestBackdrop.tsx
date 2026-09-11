import { cn } from "@/lib/utils";
import {
  FOREST_BACKDROP_NAMES,
  forestBackdrops,
} from "@/assets/mindgym/forest/manifest";

type Variant = "full" | "faded";

interface ForestBackdropProps {
  variant?: Variant;
  className?: string;
}

// Chosen once per page load, not per mount — navigating hub → section → back
// keeps the same photo instead of flashing a new one on every remount.
const SESSION_IMG_NAME =
  FOREST_BACKDROP_NAMES[Math.floor(Math.random() * FOREST_BACKDROP_NAMES.length)];

export default function ForestBackdrop({ variant = "full", className }: ForestBackdropProps) {
  const art = forestBackdrops[SESSION_IMG_NAME];

  const mask =
    variant === "faded"
      ? "linear-gradient(180deg, #000 0%, #000 30%, rgba(0,0,0,0.5) 55%, rgba(0,0,0,0) 82%)"
      : undefined;

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none fixed inset-0 z-0 overflow-hidden", className)}
      style={mask ? { WebkitMaskImage: mask, maskImage: mask } : undefined}
    >
      {/*
        Photo background — subtle ken-burns drift for a living scene.

        A <picture> rather than a background-image so the browser can negotiate
        AVIF/WebP and pick a width. The source art is 8000px camera-original
        JPEG, up to 7.5 MB; at 960px AVIF the same backdrop is ~45 KB, and the
        decode drops from ~180 MB of bitmap to something a low-end Android can
        hold. Nothing here is meant to be looked at closely — it sits under a
        cream wash, a sunbeam gradient and a vignette. See
        scripts/optimize-forest-backdrops.mjs.
      */}
      <picture style={{ display: "contents" }}>
        <source type="image/avif" srcSet={art.avif} sizes="100vw" />
        <source type="image/webp" srcSet={art.webp} sizes="100vw" />
        <img
          src={art.fallback}
          alt=""
          width={art.width}
          height={art.height}
          decoding="async"
          className="absolute inset-0 size-full object-cover object-center"
          style={{ transform: "scale(1.04)" }}
        />
      </picture>

      {/* Warm cream wash to soften contrast */}
      <div className="absolute inset-0 bg-[#f3ead9]/35 mix-blend-multiply" />

      {/* Soft directional light from top — mimics the sunbeam feel */}
      <div
        className="absolute inset-x-0 top-0 h-[60vh]"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 10%, rgba(255, 240, 200, 0.28) 0%, rgba(255, 240, 200, 0) 70%)",
        }}
      />

      {/* Edge vignette for depth without darkening the center */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(40,28,18,0.12) 100%)",
        }}
      />

      {/* Bottom cream fade so content sits on a clean surface */}
      {variant === "faded" && (
        <div
          className="absolute inset-x-0 bottom-0 h-[58vh]"
          style={{
            background:
              "linear-gradient(180deg, rgba(243,234,217,0) 0%, rgba(243,234,217,0.75) 48%, rgba(243,234,217,1) 100%)",
          }}
        />
      )}
    </div>
  );
}
