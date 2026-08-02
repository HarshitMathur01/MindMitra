/**
 * Landing design tokens for JS consumers (framer-motion springs, inline SVG
 * fills, canvas paints) — anything a Tailwind class can't reach.
 *
 * Mirrored by the `forest` / `cream` / `terracotta` / … entries in
 * tailwind.config.js. Change both together.
 */

export const colors = {
  forest: "#1B3A2B",
  cream: "#F6F0E2",
  terracotta: "#C8794F",
  /** Darkened terracotta — passes WCAG AA as body text on cream. */
  terracottaInk: "#9E5A38",
  sage: "#8FA68E",
  ink: "#2A2A26",
  nightIndigo: "#1A1F3A",
} as const;

/** cubic-bezier tuples — pass to framer-motion or CSS. */
export const ease = {
  entrance: [0.22, 1, 0.36, 1] as const,
  exit: [0.4, 0, 1, 1] as const,
  entranceCss: "cubic-bezier(.22,1,.36,1)",
  exitCss: "cubic-bezier(.4,0,1,1)",
} as const;

export const duration = {
  micro: 0.15,
  standard: 0.4,
  /** Narrative beats sit in the 900–1600ms band. */
  narrative: 1.2,
  narrativeLong: 1.6,
} as const;

export const spring = {
  organic: { type: "spring" as const, stiffness: 140, damping: 18 },
  magnetic: { type: "spring" as const, stiffness: 150, damping: 15 },
  gentle: { type: "spring" as const, stiffness: 90, damping: 20 },
} as const;
