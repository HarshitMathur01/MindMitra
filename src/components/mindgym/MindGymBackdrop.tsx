import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import sceneMeadow from "@/assets/sanctuary/scene-meadow.jpg";
import sceneFirefly from "@/assets/sanctuary/scene-firefly.jpg";
import sceneWindow from "@/assets/sanctuary/scene-window.jpg";

export type MindGymScene =
  | "breath-video"
  | "meditating-video"
  | "mountain-video"
  | "companions"
  | "presence"
  | "solitude"
  | "mountain"
  | "hills"
  | "breath"
  | "meadow"
  | "firefly"
  | "window";

type Variant = "full" | "faded";

interface MindGymBackdropProps {
  scene: MindGymScene;
  variant?: Variant;
  className?: string;
}

const VIDEO_SOURCES: Record<string, { src: string; poster: string }> = {
  "breath-video": { src: "/videos/inhale_exhale.mp4", poster: "/illustrations/breath-960.webp" },
  "meditating-video": { src: "/videos/meditating.mp4", poster: "/illustrations/presence-960.webp" },
  "mountain-video": { src: "/videos/mountain_scenary.mp4", poster: "/illustrations/mountain-960.webp" },
};

const WATERCOLOR_NAMES = ["companions", "presence", "solitude", "mountain", "hills", "breath"] as const;

const PHOTO_SOURCES: Record<string, string> = {
  meadow: sceneMeadow,
  firefly: sceneFirefly,
  window: sceneWindow,
};

const PAPER_GRAIN_URL =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.4 0 0 0 0 0.3 0 0 0 0 0.2 0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export default function MindGymBackdrop({
  scene,
  variant = "full",
  className,
}: MindGymBackdropProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (reduceMotion) v.pause();
    else void v.play().catch(() => {});
  }, [reduceMotion]);

  const isVideo = scene in VIDEO_SOURCES;
  const isWatercolor = (WATERCOLOR_NAMES as readonly string[]).includes(scene);
  const isPhoto = scene in PHOTO_SOURCES;

  const mask =
    variant === "faded"
      ? "linear-gradient(180deg, #000 0%, #000 30%, rgba(0,0,0,0.55) 58%, rgba(0,0,0,0) 88%)"
      : undefined;

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none fixed inset-0 z-0 overflow-hidden", className)}
      style={mask ? { WebkitMaskImage: mask, maskImage: mask } : undefined}
    >
      {/* Media layer — handcrafted scene */}
      <div
        className="absolute inset-0"
        style={{ transform: reduceMotion ? "none" : "scale(1.04)" }}
      >
        {isVideo && (
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            src={VIDEO_SOURCES[scene].src}
            poster={VIDEO_SOURCES[scene].poster}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          />
        )}

        {isWatercolor && (
          <picture>
            <source
              srcSet={`/illustrations/${scene}-480.webp 480w, /illustrations/${scene}-960.webp 960w, /illustrations/${scene}-1600.webp 1600w`}
              sizes="100vw"
              type="image/webp"
            />
            <img
              src={`/illustrations/${scene}-1600.webp`}
              alt=""
              className="h-full w-full object-cover"
              loading="eager"
              decoding="async"
              draggable={false}
            />
          </picture>
        )}

        {isPhoto && (
          <img
            src={PHOTO_SOURCES[scene]}
            alt=""
            className="h-full w-full object-cover"
            loading="eager"
            decoding="async"
            draggable={false}
          />
        )}
      </div>

      {/* Cream wash — softens contrast, ties scene to paper canvas */}
      <div className="absolute inset-0 bg-[#F5EDE0]/55 mix-blend-multiply" />

      {/* Paper grain — same SVG turbulence used on SanctuaryHome */}
      <div
        className="absolute inset-0 opacity-[0.10] mix-blend-multiply"
        style={{ backgroundImage: PAPER_GRAIN_URL }}
      />

      {/* Soft peach top sunbeam */}
      <div
        className="absolute inset-x-0 top-0 h-[60vh]"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 8%, rgba(244,184,156,0.22) 0%, rgba(244,184,156,0) 70%)",
        }}
      />

      {/* Sage edge vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(63,107,71,0.10) 100%)",
        }}
      />

      {/* Bottom cream fade so content reads cleanly */}
      {variant === "faded" && (
        <div
          className="absolute inset-x-0 bottom-0 h-[55vh]"
          style={{
            background:
              "linear-gradient(180deg, rgba(245,237,224,0) 0%, rgba(245,237,224,0.75) 50%, rgba(245,237,224,1) 100%)",
          }}
        />
      )}
    </div>
  );
}
