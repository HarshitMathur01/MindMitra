import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Lenis smooth scroll, driven by the GSAP ticker and wired into
 * ScrollTrigger so pinned / scrubbed timelines stay in sync.
 *
 * `lenis` itself is dynamically imported — it is only worth downloading on
 * surfaces that actually smooth their scroll. No-ops when `enabled` is
 * false (reduced motion / low-tier device).
 */
export function useLenisScroll(enabled: boolean) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!enabled) return;

    let disposed = false;
    let lenis: { destroy: () => void; raf: (t: number) => void } | null = null;
    let ticker: ((time: number) => void) | null = null;

    void (async () => {
      const { default: Lenis } = await import("lenis");
      // The effect may have been torn down while the chunk was in flight.
      if (disposed) return;

      const inst = new Lenis({
        duration: 1.1,
        smoothWheel: true,
        // Native touch scrolling stays native — syncing it costs more than
        // it buys on mobile.
        syncTouch: false,
      });
      lenis = inst;
      inst.on("scroll", ScrollTrigger.update);

      ticker = (time: number) => inst.raf(time * 1000);
      gsap.ticker.add(ticker);
      gsap.ticker.lagSmoothing(0);
    })();

    return () => {
      disposed = true;
      if (ticker) gsap.ticker.remove(ticker);
      // Restore GSAP's default lag smoothing so leaving the landing doesn't
      // change ticker behaviour for the rest of the app.
      gsap.ticker.lagSmoothing(500, 33);
      lenis?.destroy();
    };
  }, [enabled]);
}
