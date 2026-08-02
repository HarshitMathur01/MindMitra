import { useReducedMotion } from "framer-motion";

/**
 * `prefers-reduced-motion` as a strict boolean.
 *
 * framer-motion's `useReducedMotion` returns `boolean | null` (null before
 * the media query has been read). Most of our motion gating wants a plain
 * boolean it can pass down as a prop, so we coerce here rather than
 * sprinkling `?? false` through components.
 */
export function usePrefersReducedMotion(): boolean {
  return useReducedMotion() ?? false;
}
