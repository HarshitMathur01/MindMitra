import { useState } from "react";
import { cn } from "@/lib/utils";

// Same four photographs as before, now bundled instead of hotlinked.
//
// These used to be `images.unsplash.com/…?w=1920&q=70` fetched at runtime:
// 241–793 KB each (793 KB worst case), from a third party, on the LCP path of
// the landing — and unpreloadable, because the scene is picked at random after
// the module evaluates. Re-encoded to webp at 1600px/q62, they are 28–95 KB.
//
// q62 is lower than you would normally accept for a photograph. It holds up
// here because the image is never seen bare: a 45% multiply wash, a warm radial
// and an edge vignette all sit on top of it (see below).
import backdropOne from "@/assets/therapist-bridge/backdrop-1.webp";
import backdropTwo from "@/assets/therapist-bridge/backdrop-2.webp";
import backdropThree from "@/assets/therapist-bridge/backdrop-3.webp";
import backdropFour from "@/assets/therapist-bridge/backdrop-4.webp";

type Variant = "full" | "faded";

interface TherapyBackdropProps {
  variant?: Variant;
  className?: string;
}

const IMAGES = [
  // Two chairs facing each other in a warm consultation room
  backdropOne,
  // Warm therapeutic interior, gentle daylight
  backdropTwo,
  // Two pairs of hands resting together — supportive presence
  backdropThree,
  // Soft window light over a quiet sofa
  backdropFour,
];

export default function TherapyBackdrop({ variant = "full", className }: TherapyBackdropProps) {
  const [imgUrl] = useState(() => IMAGES[Math.floor(Math.random() * IMAGES.length)]);

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
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${imgUrl})`,
          transform: "scale(1.04)",
        }}
      />

      {/* Warm cream wash to soften contrast and unify tone with the page */}
      <div className="absolute inset-0 bg-[#3a2a1f]/45 mix-blend-multiply" />

      {/* Soft directional warmth from top — mimics afternoon light through a window */}
      <div
        className="absolute inset-x-0 top-0 h-[60vh]"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 10%, rgba(255, 224, 178, 0.32) 0%, rgba(255, 224, 178, 0) 70%)",
        }}
      />

      {/* Edge vignette for depth without darkening the center */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(30,18,12,0.32) 100%)",
        }}
      />

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
