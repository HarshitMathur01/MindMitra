import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/**
 * SCROLL SPINE — a hand-inked vertical line down the right edge of the page,
 * with `stroke-dashoffset` bound to document scroll progress. Doubles as a
 * section-progress indicator. Hidden below `md`.
 *
 * Reduced-motion audit: reduced → the spine renders as a static full stroke
 * and no scroll listener is attached at all.
 */
export function ScrollSpine() {
  const pathRef = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(1);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (!pathRef.current) return;
    setLen(pathRef.current.getTotalLength());
  }, []);

  useEffect(() => {
    if (reduced || !pathRef.current) return;
    let raf = 0;

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const scrollTop =
          window.scrollY || document.documentElement.scrollTop || 0;
        const max =
          (document.documentElement.scrollHeight || 0) - window.innerHeight;
        const p = max <= 0 ? 0 : Math.min(1, Math.max(0, scrollTop / max));
        if (pathRef.current) {
          pathRef.current.style.strokeDashoffset = String(len * (1 - p));
        }
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [len, reduced]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed right-4 top-0 z-30 hidden h-screen w-8 md:block"
    >
      <svg
        viewBox="0 0 20 800"
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        <path
          ref={pathRef}
          d="M10 8 C 6 120, 14 240, 10 360 S 4 560, 12 680 L 10 792"
          fill="none"
          stroke="#1B3A2B"
          strokeOpacity="0.55"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeDasharray={reduced ? undefined : len}
          strokeDashoffset={reduced ? 0 : len}
          filter="url(#mm-torn)"
        />
      </svg>
    </div>
  );
}
