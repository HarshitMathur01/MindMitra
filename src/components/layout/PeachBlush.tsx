import { cn } from "@/lib/utils";

type Position =
  | "top-right"
  | "top-left"
  | "top-center"
  | "bottom-right"
  | "bottom-left"
  | "bottom-center";

interface PeachBlushProps {
  position?: Position;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const SIZE = {
  sm: { height: "320px" },
  md: { height: "480px" },
  lg: { height: "640px" },
} as const;

const ORIGIN: Record<Position, string> = {
  "top-right": "ellipse 70% 60% at 80% 10%",
  "top-left": "ellipse 70% 60% at 20% 10%",
  "top-center": "ellipse 80% 55% at 50% 8%",
  "bottom-right": "ellipse 70% 60% at 80% 95%",
  "bottom-left": "ellipse 70% 60% at 20% 95%",
  "bottom-center": "ellipse 80% 55% at 50% 96%",
};

const ANCHOR: Record<Position, string> = {
  "top-right": "inset-x-0 top-0",
  "top-left": "inset-x-0 top-0",
  "top-center": "inset-x-0 top-0",
  "bottom-right": "inset-x-0 bottom-0",
  "bottom-left": "inset-x-0 bottom-0",
  "bottom-center": "inset-x-0 bottom-0",
};

/**
 * Ambient peach-blush wash. Renders as a single non-interactive
 * radial-gradient layer. Reads --qc-peach-rgb and --qc-peach-opacity
 * from the surrounding .qc-canvas, so it dims automatically in
 * candlelight night mode.
 */
export function PeachBlush({
  position = "top-right",
  className,
  size = "md",
}: PeachBlushProps) {
  const origin = ORIGIN[position];
  const anchor = ANCHOR[position];
  const height = SIZE[size].height;

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute", anchor, className)}
      style={{
        height,
        background: `radial-gradient(${origin}, rgba(var(--qc-peach-rgb), var(--qc-peach-opacity)) 0%, transparent 60%)`,
      }}
    />
  );
}

export default PeachBlush;
