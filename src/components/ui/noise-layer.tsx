import { cn } from "@/lib/utils";

type NoiseLayerProps = {
  /** Opacity override (0–1). Keep very low. */
  opacity?: number;
  className?: string;
};

/**
 * A decorative SVG grain overlay. Positioned absolutely inside its
 * nearest positioned parent. Keep opacity ≤ 0.06 to avoid feeling
 * "textured".
 */
export function NoiseLayer({ opacity = 0.04, className }: NoiseLayerProps) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{
        opacity,
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.8 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        mixBlendMode: "multiply",
      }}
    />
  );
}
