import { useEffect, type RefObject } from "react";

/**
 * The rules in river.css that read the scroll position. Everything the hook
 * writes to is one of these; nothing else in the app consumes them.
 *
 * This was four selectors until the hillside hero went: the three
 * `nr-parallax-*` classes only ever sat on its haze and its backdrop. The
 * atmosphere layer is the last consumer, which makes the "write to the
 * consumers, not to <html>" rule below cheaper still, not obsolete — a single
 * property set on `<html>` costs the same document-wide recalc whether one
 * element reads it or forty.
 */
const CONSUMER_SELECTOR = ".nr-atmosphere";

/**
 * Publishes vertical scroll position as CSS custom properties:
 *
 *   --nr-scroll      0 → 1  (top to bottom of the document)
 *   --nr-scroll-px   pixels scrolled
 *
 * `.mm-river`'s atmosphere layer reads these, which keeps scroll-linked
 * painting on the compositor instead of re-rendering React on every frame.
 *
 * Three deliberate differences from the design source it was ported from:
 *
 *  1. It listens for `scroll` and schedules a single rAF, rather than running a
 *     permanent rAF loop. The original polled `window.scrollY` ~60×/s forever,
 *     including while the page sat idle — a real battery cost on the low-end
 *     Android this app is mostly opened on.
 *  2. The properties are written to the handful of elements that actually read
 *     them, NOT to `<html>`. This is the expensive part to get wrong. Custom
 *     properties inherit, so setting one on the root invalidates style for
 *     every element beneath it; at scroll rate that means re-resolving the
 *     whole document ~60×/s, and river.css resolves 19 `color-mix(in oklab, …)`
 *     expressions on the way through. Measured on the authenticated `/` at 4×
 *     CPU throttle, scrolling one screen height and back:
 *
 *       on <html>       9.16s main-thread, 7.56s of it style recalc, 90 long tasks
 *       on consumers    see the commit — same pixels, a fraction of the recalc
 *
 *     Four elements read these properties at the time. Writing to 628 to serve
 *     4 was the bug; it is one element now.
 *  3. It clears the properties on unmount. They would otherwise sit on elements
 *     that outlive this page, tinting nothing until the next full reload.
 *
 * Pass the ref of the `.mm-river` root. Consumers are collected once per mount,
 * after the DOM has committed — the atmosphere layer is static markup in
 * SanctuaryHome, so there is nothing to re-scan for.
 */
export function useScrollProgress(rootRef: RefObject<HTMLElement>): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const targets: HTMLElement[] = [
      ...(root.matches(CONSUMER_SELECTOR) ? [root] : []),
      ...Array.from(root.querySelectorAll<HTMLElement>(CONSUMER_SELECTOR)),
    ];
    if (targets.length === 0) return;

    const doc = document.documentElement;
    let raf = 0;

    const write = () => {
      raf = 0;
      const scrollTop = window.scrollY;
      const docHeight = doc.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min(1, Math.max(0, scrollTop / docHeight)) : 0;

      const scroll = progress.toFixed(4);
      const scrollPx = `${scrollTop.toFixed(1)}px`;
      for (const el of targets) {
        el.style.setProperty("--nr-scroll", scroll);
        el.style.setProperty("--nr-scroll-px", scrollPx);
      }
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
      for (const el of targets) {
        el.style.removeProperty("--nr-scroll");
        el.style.removeProperty("--nr-scroll-px");
      }
    };
  }, [rootRef]);
}
