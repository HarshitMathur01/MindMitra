import { useEffect, type RefObject } from "react";
import { animate, useMotionValue } from "framer-motion";

/**
 * Pointer-attracted magnetic offset. Returns motion values for x / y that
 * pull up to `strength` px toward the cursor and spring back on leave.
 *
 * Callers gate `enabled` on reduced-motion.
 */
export function useMagnetic<T extends HTMLElement>(
  ref: RefObject<T | null>,
  strength = 8,
  enabled = true,
) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const spring = { type: "spring" as const, stiffness: 150, damping: 15 };

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = (e.clientX - cx) / (r.width / 2);
      const dy = (e.clientY - cy) / (r.height / 2);
      animate(x, Math.max(-1, Math.min(1, dx)) * strength, spring);
      animate(y, Math.max(-1, Math.min(1, dy)) * strength, spring);
    };
    const onLeave = () => {
      animate(x, 0, spring);
      animate(y, 0, spring);
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [ref, strength, enabled, x, y]);

  return { x, y };
}
