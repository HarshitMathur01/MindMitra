/**
 * Watercolor blob — one ellipse behind a soft displacement filter.
 * Sized by `className`; positioned by the parent.
 *
 * Reduced-motion audit: static shape. The drift animation is applied by the
 * parent via an `anim-drift-*` class, and those are killed globally by the
 * `prefers-reduced-motion` rule in landing.css.
 */
type Props = {
  fill: string;
  opacity?: number;
  className?: string;
  seed?: number;
};

export function WatercolorBlob({
  fill,
  opacity = 0.55,
  className = "",
  seed = 3,
}: Props) {
  const filterId = `mm-blob-${seed}`;

  return (
    <svg
      aria-hidden
      viewBox="-60 -60 220 220"
      className={`absolute ${className}`}
      style={{ opacity }}
    >
      <defs>
        <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.014"
            numOctaves="2"
            seed={seed}
          />
          <feDisplacementMap in="SourceGraphic" scale="24" />
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
        <radialGradient id={`${filterId}-g`} cx="45%" cy="40%" r="60%">
          <stop offset="0%" stopColor={fill} stopOpacity="0.95" />
          <stop offset="70%" stopColor={fill} stopOpacity="0.55" />
          <stop offset="100%" stopColor={fill} stopOpacity="0.15" />
        </radialGradient>
      </defs>
      <ellipse
        cx="50"
        cy="50"
        rx="72"
        ry="58"
        fill={`url(#${filterId}-g)`}
        filter={`url(#${filterId})`}
      />
    </svg>
  );
}
