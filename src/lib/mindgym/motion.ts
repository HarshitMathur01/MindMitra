// Shared reduced-motion check for JS-driven animation (canvas-confetti etc.).
// CSS keyframes are already neutralized globally by the prefers-reduced-motion
// override in src/index.css — only imperative/canvas animation needs this guard.
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
