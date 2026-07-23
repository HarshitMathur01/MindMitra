import { useEffect, useState, type RefObject } from "react";
import {
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";

/**
 * Scroll-linked background drift for a SceneSection. Generalizes the old
 * ReflectionScene parallax: as the scene crosses the viewport, its background
 * layer slides between -drift% and +drift% of its own (oversized) height.
 *
 * `active` gates the effect off wherever motion is unwelcome or wasteful —
 * prefers-reduced-motion, below-md viewports, Save-Data connections. Callers
 * render the background statically when `active` is false; scroll itself
 * stays native everywhere.
 */
export function useSceneParallax(
  ref: RefObject<HTMLElement>,
  intensity = 1,
): { y: MotionValue<string>; active: boolean } {
  const reducedMotion = useReducedMotion();
  const [deviceAllows, setDeviceAllows] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const saveData =
      (navigator as Navigator & { connection?: { saveData?: boolean } })
        .connection?.saveData === true;
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setDeviceAllows(mq.matches && !saveData);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const drift = 4 * Math.max(0, Math.min(1, intensity));
  const y = useTransform(scrollYProgress, [0, 1], [`-${drift}%`, `${drift}%`]);

  return { y, active: intensity > 0 && !reducedMotion && deviceAllows };
}
