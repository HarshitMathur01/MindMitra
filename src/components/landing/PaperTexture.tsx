/**
 * Shared SVG filter defs for the landing.
 *
 * The persistent paper-grain + vignette overlay itself lives in
 * `landing.css` (`.mm-landing::before` / `::after`). This component only
 * ships the `<defs>` block that other sections reference by id:
 *
 *   #mm-ink-bleed   — Hero headline displacement (animated once on mount)
 *   #mm-water-edge  — Persona pigment-wash edge
 *   #mm-torn        — Torn paper dividers + the scroll spine
 *
 * Reduced-motion audit: nothing here loops. The one animated attribute
 * (`baseFrequency` on #mm-ink-turb) is driven by a one-shot GSAP tween in
 * Hero, which is itself gated on reduced motion.
 */
export function PaperTexture() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none fixed -z-10 h-0 w-0"
      style={{ position: "absolute" }}
    >
      <defs>
        {/* Ink bleed — animated in Hero by id */}
        <filter id="mm-ink-bleed" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            id="mm-ink-turb"
            type="fractalNoise"
            baseFrequency="0.02"
            numOctaves="2"
            seed="4"
            result="turb"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="turb"
            scale="10"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        {/* Watercolor blob edge (soft) */}
        <filter id="mm-water-edge" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012"
            numOctaves="2"
            seed="7"
          />
          <feDisplacementMap in="SourceGraphic" scale="14" />
          <feGaussianBlur stdDeviation="0.4" />
        </filter>

        {/* Torn paper edge — a wobbly displacement */}
        <filter id="mm-torn" x="-2%" y="-50%" width="104%" height="200%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.02 0.4"
            numOctaves="2"
            seed="2"
          />
          <feDisplacementMap in="SourceGraphic" scale="6" />
        </filter>
      </defs>
    </svg>
  );
}
