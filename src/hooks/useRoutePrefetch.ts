import { useEffect } from "react";
import { prefetchRoute, prefetchChunk, loadRoute } from "@/lib/routeChunks";

/**
 * Turn navigation *intent* into a chunk download.
 *
 * Measured problem (Fast 3G + 4x CPU, `npx serve -s dist`): a cold route
 * transition cost ~2.5s hover→paint, and the route chunk's request didn't
 * even leave the browser until ~350ms after the click. Nothing warmed a
 * chunk before the user committed to the navigation.
 *
 * This is a single delegated listener on the document rather than props on
 * ~30 link sites: `pointerover` and `focusin` both bubble, so one pair of
 * listeners covers every <Link>, every <a href="/…">, and every nav <button>
 * that opts in with `data-prefetch="/path"`. `pointerdown` is the floor for
 * touch and for fast mouse users who click before a hover registers — it
 * still buys the ~100-200ms between finger-down and click.
 *
 * Deduping lives in prefetchRoute(), so firing three events per link is free.
 */
export function useRoutePrefetch(): void {
  useEffect(() => {
    const pathFromEvent = (event: Event): string | null => {
      const target = event.target;
      if (!(target instanceof Element)) return null;

      const el = target.closest<HTMLElement>("[data-prefetch], a[href]");
      if (!el) return null;

      // Nav buttons (Header, SanctuaryHeader) aren't anchors — they declare
      // their destination explicitly.
      const declared = el.dataset.prefetch;
      if (declared) return declared.startsWith("/") ? declared : null;

      const href = el.getAttribute("href");
      if (!href) return null;
      // Same-document hashes, mailto:, tel:, and external links own no chunk.
      if (!href.startsWith("/") || href.startsWith("//")) return null;
      if (el.getAttribute("target") === "_blank") return null;
      return href;
    };

    const onIntent = (event: Event) => {
      const path = pathFromEvent(event);
      if (path) prefetchRoute(path);
    };

    // Capture phase: still fires when a child stops propagation.
    const opts = { capture: true, passive: true } as const;
    document.addEventListener("pointerover", onIntent, opts);
    document.addEventListener("pointerdown", onIntent, opts);
    document.addEventListener("focusin", onIntent, opts);
    return () => {
      document.removeEventListener("pointerover", onIntent, opts);
      document.removeEventListener("pointerdown", onIntent, opts);
      document.removeEventListener("focusin", onIntent, opts);
    };
  }, []);
}

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
};

/**
 * Run `fn` only once the current page has finished loading AND the main thread
 * is idle.
 *
 * The `load` gate is not optional. A first cut used a bare
 * requestIdleCallback(timeout: 3000); on Fast 3G that fired at 3s — well before
 * the page's own first contentful paint at ~7s — and the speculative chunk
 * competed with the critical path for bandwidth. Measured cost of that mistake
 * on `/`: FCP 7096ms → 9340ms. A prefetch that slows down the page the user is
 * actually looking at is worse than no prefetch.
 */
function hasPainted(): boolean {
  try {
    return performance
      .getEntriesByType("paint")
      .some((e) => e.name === "first-contentful-paint");
  } catch {
    // No Paint Timing support — don't block the warm-up on a missing API.
    return true;
  }
}

function afterLoadIdle(fn: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  let idleId: number | null = null;
  let timerId: number | null = null;
  let cancelled = false;

  // Belt and braces on top of the `load` gate: never spend bandwidth on a
  // guess before the current page has actually put pixels on screen.
  const run = () => {
    if (cancelled) return;
    if (!hasPainted()) {
      timerId = window.setTimeout(run, 500);
      return;
    }
    fn();
  };

  const schedule = () => {
    const w = window as IdleWindow;
    if (w.requestIdleCallback) {
      idleId = w.requestIdleCallback(run, { timeout: 5000 });
    } else {
      timerId = window.setTimeout(run, 2000);
    }
  };

  if (document.readyState === "complete") {
    schedule();
  } else {
    window.addEventListener("load", schedule, { once: true });
  }

  return () => {
    // `cancelled` matters because `run` re-schedules itself while waiting for
    // first paint; clearing the timer alone would leave an in-flight tick free
    // to fire once more after unmount.
    cancelled = true;
    window.removeEventListener("load", schedule);
    if (idleId !== null) window.cancelIdleCallback?.(idleId);
    if (timerId !== null) window.clearTimeout(timerId);
  };
}

/**
 * Speculatively warm the highest-probability *next* route once the current
 * one is idle. This is the equivalent of the `<link rel="modulepreload">` tags
 * you'd otherwise hand-write into index.html, except it survives content
 * hashing and knows whether the visitor is signed in.
 *
 * Deliberately short lists — every entry is bandwidth spent on a guess.
 *   - signed out on `/` → `/auth` is the only real exit.
 *   - signed in on `/`  → Chat is the primary door; Mind Gym is second.
 *   - signed in elsewhere → the home shell, since every header logo returns
 *     there and `/` costs an extra hop (Index is a gateway that then lazy-
 *     loads SanctuaryHome).
 */
export function useIdleRouteWarmup(pathname: string, signedIn: boolean): void {
  useEffect(() => {
    return afterLoadIdle(() => {
      if (pathname === "/") {
        if (!signedIn) {
          prefetchRoute("/auth");
          return;
        }
        prefetchRoute("/chat");
        prefetchRoute("/mindgym");
        return;
      }
      if (signedIn) {
        prefetchRoute("/");
        prefetchChunk(loadRoute.sanctuaryHome);
      }
    });
  }, [pathname, signedIn]);
}
