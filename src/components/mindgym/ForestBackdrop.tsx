import { useState } from "react";
import { cn } from "@/lib/utils";

type Variant = "full" | "faded";

interface ForestBackdropProps {
  variant?: Variant;
  className?: string;
}

const IMAGE_COUNT = 8;

export default function ForestBackdrop({ variant = "full", className }: ForestBackdropProps) {
  const [imgIndex] = useState(() => Math.floor(Math.random() * IMAGE_COUNT) + 1);

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
      {/* Photo background — subtle ken-burns drift for a living scene */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(/mindgym/forest/${imgIndex}.jpg)`,
          transform: "scale(1.04)",
        }}
      />

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
