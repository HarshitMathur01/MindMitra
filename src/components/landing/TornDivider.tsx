/**
 * Torn-paper horizontal divider, tinted in a chosen fill.
 * Uses the shared #mm-torn filter from PaperTexture.
 *
 * Reduced-motion audit: static SVG, no motion.
 */
type Props = {
  fill?: string;
  className?: string;
  flip?: boolean;
};

export function TornDivider({
  fill = "#F6F0E2",
  className = "",
  flip = false,
}: Props) {
  return (
    <div
      className={`pointer-events-none relative w-full ${className}`}
      aria-hidden
      style={{ transform: flip ? "scaleY(-1)" : undefined }}
    >
      <svg
        viewBox="0 0 1200 80"
        preserveAspectRatio="none"
        className="block h-12 w-full md:h-20"
      >
        <path
          d="M0 40 C 120 10, 240 70, 360 34 S 600 8, 720 46 S 960 74, 1080 30 L 1200 44 L 1200 80 L 0 80 Z"
          fill={fill}
          filter="url(#mm-torn)"
        />
      </svg>
    </div>
  );
}
