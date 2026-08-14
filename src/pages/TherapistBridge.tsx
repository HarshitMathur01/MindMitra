import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useNavigationType } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { AnimatePresence, motion } from "framer-motion";
import TherapistBridgeLanding from "@/components/therapist-bridge/TherapistBridgeLanding";
import "@/components/therapist-bridge/bridge.css";

/**
 * The surface is split out of the landing's chunk.
 *
 * Almost everyone arriving here sees the landing first and spends a beat on it
 * before pressing "Step in". Bundling the two together meant the landing could
 * not paint until the whole surface — every sheet, the chart, the intake flow —
 * had downloaded and parsed, for a screen that shows a headline and one button.
 *
 * `warmSurface()` starts that fetch during the landing's idle time, so by the
 * time the button is pressed the chunk is usually already in cache and the
 * Suspense fallback never appears.
 */
const TherapistBridgeSurface = lazy(() =>
  import("@/components/therapist-bridge/TherapistBridge").then((m) => ({
    default: m.TherapistBridge,
  })),
);

function warmSurface() {
  void import("@/components/therapist-bridge/TherapistBridge");
}

/**
 * Route wrapper for the Therapist Bridge.
 *
 * Two pieces, and they are deliberately unlike each other:
 *
 *  1. A threshold landing — dark, photographic, one button. Same gate pattern
 *     as MindGymHub (`pages/mindgym/MindGymHub.tsx`), down to the sessionStorage
 *     key shape, so entering a surface feels consistent across the app.
 *  2. The surface itself, a verbatim port of
 *     rana-jatin/remix-of-gentle-bridge (`src/components/bridge/`). Keep the two
 *     in step rather than editing those components here. Only two things differ
 *     from upstream, both forced by the platform: `motion/react` is imported as
 *     `framer-motion`, and the Tailwind v4 `@theme`/`@utility` layer is
 *     expressed as scoped CSS in bridge.css.
 *
 * This wrapper also exists because upstream is a TanStack file route with a
 * `head()` export; MindMitra is react-router, so the meta moves to Helmet.
 *
 * The surface runs entirely on the fixtures in lib/therapist-bridge/. The
 * FastAPI endpoints under /therapist-bridge/* are live and hardened but nothing
 * here calls them — see docs/api_contracts.md §9.
 */
const TITLE = "Therapist Bridge — find someone who truly listens";
const DESCRIPTION =
  "A calm, private way to see how you've been feeling and meet a therapist who fits — with full control over what gets shared.";

/** Unchanged from the pre-port version, so an open session keeps its state. */
const ENTERED_KEY = "mindmitra_therapist_bridge_entered_session";

const TherapistBridgePage = () => {
  const navigationType = useNavigationType();
  const [entered, setEntered] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(ENTERED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const handleEnter = useCallback(() => {
    try {
      sessionStorage.setItem(ENTERED_KEY, "1");
    } catch {
      /* Private mode / storage disabled — the gate just reappears next visit. */
    }
    setEntered(true);
  }, []);

  /**
   * Fetch the surface chunk while the landing is on screen.
   *
   * requestIdleCallback so it never competes with the backdrop image, which is
   * the landing's LCP element. Safari has no rIC, hence the timeout fallback.
   * Skipped when the gate has already been passed — the lazy import is loading
   * on its own by then.
   */
  useEffect(() => {
    if (entered) return;
    const ric = window.requestIdleCallback;
    if (typeof ric === "function") {
      const id = ric(warmSurface, { timeout: 2000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(warmSurface, 1200);
    return () => window.clearTimeout(t);
  }, [entered]);

  /**
   * Land at the top, both on route entry and on crossing the threshold.
   *
   * The app has no global scroll restoration, so react-router carries the
   * previous route's scroll offset into the next one. The usual way in here is
   * the Doors tile near the bottom of SanctuaryHome's river scroll, and the
   * surface is only ~2 viewport heights — so the inherited offset landed you
   * past the end of it.
   *
   * useLayoutEffect, not useEffect: AnimatePresence runs `mode="wait"`, so this
   * mounts only once the outgoing page has left. Resetting before paint means
   * there is no visible jump.
   *
   * POP is left alone deliberately — on Back/Forward the browser restores the
   * position it recorded, and stealing that would drop people at the top of the
   * river page instead of back at the Doors they came from. Entering the
   * surface is not a POP, so that transition always starts at the top.
   */
  useLayoutEffect(() => {
    if (navigationType === "POP" && !entered) return;
    window.scrollTo(0, 0);
  }, [navigationType, entered]);

  /**
   * Scope the parchment palette at <body>, and only once past the landing.
   *
   * bridge.css redefines Tailwind's colour tokens under `.mm-bridge`, but every
   * sheet and dialog portals to document.body — outside the surface — and would
   * otherwise render in MindMitra's default theme. Tagging the body means the
   * portals inherit and no upstream component needs an extra className.
   *
   * The landing is its own dark composition and must not inherit the parchment
   * ground, hence the `entered` guard. Removed on unmount either way, so the
   * class never outlives the route.
   */
  useEffect(() => {
    if (!entered) return;
    document.body.classList.add("mm-bridge");
    return () => document.body.classList.remove("mm-bridge");
  }, [entered]);

  return (
    <>
      <Helmet>
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      <AnimatePresence mode="wait">
        {entered ? (
          <motion.div
            key="surface"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Parchment ground rather than a spinner: if the warm-up did not
                finish, the eye sees the surface's own background arrive first
                and the content fill in, instead of a flash of loader. */}
            <Suspense
              fallback={<div className="min-h-dvh bg-[hsl(41,48.8%,95.4%)]" aria-hidden />}
            >
              <TherapistBridgeSurface />
            </Suspense>
          </motion.div>
        ) : (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <TherapistBridgeLanding onEnter={handleEnter} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default TherapistBridgePage;
