/**
 * Motion tokens for MindMitra v2.
 *
 * Philosophy: "Clinical restraint". Motion exists for state change
 * and interaction only — never ambient decoration. Pure cubic-bezier
 * easings (no spring stiffness / damping guessing).
 *
 * Consume via framer-motion `transition` prop.
 */

export const ease = {
  outExpo: [0.16, 1, 0.3, 1],
  inOut: [0.4, 0, 0.2, 1],
  outQuart: [0.25, 1, 0.5, 1],
  inExpo: [0.7, 0, 0.84, 0],
} as const;

export const duration = {
  micro: 0.12,
  quick: 0.18,
  base: 0.26,
  long: 0.52,
} as const;

/** Default transition for page/element entrance. */
export const enterTransition = {
  duration: duration.long,
  ease: ease.outExpo,
};

/** Default transition for hover/press feedback. */
export const microTransition = {
  duration: duration.micro,
  ease: ease.inOut,
};

/** Default transition for modal / panel mount. */
export const panelTransition = {
  duration: duration.base,
  ease: ease.outExpo,
};

/** Variants commonly reused. */
export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1 },
};

/** Stagger preset for lists / grids. */
export const staggerContainer = (staggerChildren = 0.06, delayChildren = 0) => ({
  visible: {
    transition: { staggerChildren, delayChildren },
  },
});
