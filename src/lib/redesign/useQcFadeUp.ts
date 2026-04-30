import { useEffect, useRef } from "react";

/**
 * Toggles `.is-visible` on `.qc-fade-up` descendants when they cross
 * the viewport. Lighter than mounting Framer for ambient reveals on
 * long static pages (resources, articles, settings, terms).
 *
 * Usage:
 *   const ref = useQcFadeUp<HTMLDivElement>();
 *   <div ref={ref}>
 *     <section className="qc-fade-up">...</section>
 *   </div>
 *
 * Honours `prefers-reduced-motion` via the CSS rule that disables the
 * keyframe animation — no extra logic needed here.
 */
export function useQcFadeUp<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const targets = root.querySelectorAll<HTMLElement>(".qc-fade-up");
    if (targets.length === 0) return;

    if (typeof IntersectionObserver === "undefined") {
      targets.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return ref;
}

export default useQcFadeUp;
