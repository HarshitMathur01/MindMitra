/**
 * Quiet Companion redesign — shared design tokens.
 *
 * Intentionally tiny: just the constants we found ourselves retyping
 * across redesigned surfaces. Visual tokens still live in
 * `src/index.css` (Sanctuary v4); these are the *behavior* tokens.
 */

export const EASE = {
  outExpo: [0.16, 1, 0.3, 1] as [number, number, number, number],
  inOut: [0.45, 0, 0.2, 1] as [number, number, number, number],
  outQuart: [0.25, 1, 0.5, 1] as [number, number, number, number],
} as const;

export const DURATION = {
  micro: 0.15,
  quick: 0.22,
  base: 0.38,
  long: 0.6,
} as const;

export const SECTION_SPACING = {
  /** Tight band — used between closely-related groups. */
  tight: "py-10 sm:py-14",
  /** Default rhythm between major bands. */
  base: "py-16 sm:py-24",
  /** Hero / first band. */
  hero: "pt-24 pb-16 sm:pt-32 sm:pb-24",
} as const;

/**
 * Resonant breathing rate (~6 breaths per minute). Used by the Pulse
 * component. Not user-facing; do not surface as a clinical claim.
 */
export const BREATH_PERIOD_MS = 10000;

export const MAX_PROSE_CH = 60;
