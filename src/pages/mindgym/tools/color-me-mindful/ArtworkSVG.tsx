import { useRef } from "react";
import type { Artwork } from "./artworks";

interface ArtworkSVGProps {
  artwork: Pick<Artwork, "name" | "viewBox" | "paths"> & { id?: string };
  fills?: Record<string, string>;
  onRegionClick?: (id: string) => void;
  onRegionPaint?: (id: string) => void; // drag-to-paint
  interactive?: boolean;
  className?: string;
  strokeWidth?: number;
  svgId?: string;
}

// Heuristic: paths starting with "M" and not closing (no Z) are likely strokes (lines/whiskers/branches).
// We render them as non-fillable decorative strokes.
const isStrokeOnly = (d: string) => !/[zZ]/.test(d);

export const ArtworkSVG = ({
  artwork,
  fills = {},
  onRegionClick,
  onRegionPaint,
  interactive = false,
  className,
  strokeWidth = 1.6,
  svgId,
}: ArtworkSVGProps) => {
  const isPainting = useRef(false);

  const handleDown = (id: string) => {
    if (!interactive) return;
    isPainting.current = true;
    onRegionClick?.(id);
  };
  const handleEnter = (id: string) => {
    if (!interactive || !isPainting.current) return;
    onRegionPaint?.(id);
  };
  const stop = () => {
    isPainting.current = false;
  };

  return (
    <svg
      id={svgId}
      viewBox={artwork.viewBox}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={artwork.name}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
    >
      {/* Background for export */}
      <rect x="0" y="0" width="100%" height="100%" fill="hsl(var(--card))" />
      {artwork.paths.map((p) => {
        const strokeOnly = isStrokeOnly(p.d);
        const fill = strokeOnly ? "none" : fills[p.id] ?? "hsl(var(--card))";
        return (
          <path
            key={p.id}
            d={p.d}
            fill={fill}
            stroke="hsl(var(--foreground))"
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{
              cursor: interactive && !strokeOnly ? "pointer" : "default",
              transition: "fill 0.2s ease",
              pointerEvents: strokeOnly ? "none" : "auto",
              touchAction: "none",
            }}
            onPointerDown={!strokeOnly ? () => handleDown(p.id) : undefined}
            onPointerEnter={!strokeOnly ? () => handleEnter(p.id) : undefined}
          />
        );
      })}
    </svg>
  );
};
