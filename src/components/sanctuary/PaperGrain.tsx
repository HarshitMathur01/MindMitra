import { useAmbience } from "./AmbienceProvider";

/**
 * PaperGrain — a fixed fractal-noise overlay. Opacity (and indirectly
 * warmth) reads from the SanctuaryAmbience context so the room visibly
 * settles or warms with the user's affect signal.
 *
 * The component intentionally swallows context-not-found via the default
 * neutral ambience in `useAmbience()` — first-render snapshots and
 * dev-storybook should not crash on missing provider.
 */
export function PaperGrain() {
  const ambience = useAmbience();
  // paperWarmth is 0..1. Map to the existing 0.10 baseline opacity, dimming
  // slightly when the room is quiet and brightening when the user is in a
  // lifting state. Keep the swing small — this is texture, not weather.
  const opacity = 0.08 + ambience.paperWarmth * 0.06;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] mix-blend-multiply"
      style={{
        opacity,
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.4 0 0 0 0 0.3 0 0 0 0 0.2 0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
      }}
    />
  );
}
