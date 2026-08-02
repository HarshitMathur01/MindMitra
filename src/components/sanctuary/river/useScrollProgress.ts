import { useEffect } from "react";

/**
 * Publishes vertical scroll position as CSS custom properties on <html>:
 *
 *   --nr-scroll      0 → 1  (top to bottom of the document)
 *   --nr-scroll-px   pixels scrolled
 *
 * `.mm-river`'s atmosphere layer and the `nr-parallax-*` classes read these,
 * which keeps scroll-linked painting on the compositor instead of re-rendering
 * React on every frame.
 *
 * Two deliberate differences from the design source it was ported from:
 *
 *  1. It listens for `scroll` and schedules a single rAF, rather than running a
 *     permanent rAF loop. The original polled `window.scrollY` ~60×/s forever,
 *     including while the page sat idle — a real battery cost on the low-end
 *     Android this app is mostly opened on.
 *  2. It removes both properties on unmount. They live on <html>, which
 *     outlives this page, so a stale `--nr-scroll` would otherwise sit there
 *     tinting nothing until the next full reload.
 */
export function useScrollProgress(): void {
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;

    const write = () => {
      raf = 0;
      const scrollTop = window.scrollY;
      const docHeight = root.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min(1, Math.max(0, scrollTop / docHeight)) : 0;

      root.style.setProperty("--nr-scroll", progress.toFixed(4));
      root.style.setProperty("--nr-scroll-px", `${scrollTop.toFixed(1)}px`);
    };

    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(write);
    };

    write();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      root.style.removeProperty("--nr-scroll");
      root.style.removeProperty("--nr-scroll-px");
    };
  }, []);
}
