import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/context/ThemeContext";
import SkipToMain from "@/components/system/SkipToMain";
import "@/i18n";

import { RouteFallback } from "@/components/layout/RouteFallback";
import { ProductAnalyticsProvider } from "@/components/analytics/ProductAnalyticsProvider";
import ErrorBoundary from "@/components/system/ErrorBoundary";
import { loadRoute } from "@/lib/routeChunks";
import { useRoutePrefetch, useIdleRouteWarmup } from "@/hooks/useRoutePrefetch";

// ── Lazy routes ───────────────────────────────────────────────────────────
// Code-split everything below so the marketing landing and chat surfaces
// don't pay download cost for screens the user hasn't navigated to. Each
// loader produces its own JS chunk and is fetched on demand.
//
// The loaders live in `@/lib/routeChunks` rather than inline here so the
// prefetcher can call the *same* function identity on hover/focus — that's
// what lets a chunk already be resolved by the time the click lands.
const Index = lazy(loadRoute.index);
const Auth = lazy(loadRoute.auth);
const Chat = lazy(loadRoute.chat);
const QATests = lazy(loadRoute.qaTests);
const EmojiMatch = lazy(loadRoute.emojiMatch);
const MoodMountain = lazy(loadRoute.moodMountain);
const ThoughtDetective = lazy(loadRoute.thoughtDetective);
const BalloonPositivityGame = lazy(loadRoute.balloonPositivityGame);
const TherapyLanding = lazy(loadRoute.therapyLanding);
const TherapistBridge = lazy(loadRoute.therapistBridge);
const Booking = lazy(loadRoute.booking);
const Settings = lazy(loadRoute.settings);
const Profile = lazy(loadRoute.profile);
const PeerSupport = lazy(loadRoute.peerSupport);
const PsychologicalContent = lazy(loadRoute.psychologicalContent);
const GroundingRitualsArticle = lazy(loadRoute.groundingRitualsArticle);
const NervousSystemResetArticle = lazy(loadRoute.nervousSystemResetArticle);
const BedtimeRoutineArticle = lazy(loadRoute.bedtimeRoutineArticle);
const MountainResetGuideArticle = lazy(loadRoute.mountainResetGuideArticle);
const NatureFocusVisualGroundingArticle = lazy(loadRoute.natureFocusVisualGroundingArticle);
const Journal = lazy(loadRoute.journal);
const MindGymHub = lazy(loadRoute.mindGymHub);
const MindGymSectionPage = lazy(loadRoute.mindGymSectionPage);
const MindGymToolPage = lazy(loadRoute.mindGymToolPage);
const Me = lazy(loadRoute.me);
const SafetyPlan = lazy(loadRoute.safetyPlan);
const Privacy = lazy(loadRoute.privacy);
const Terms = lazy(loadRoute.terms);
const NotFound = lazy(loadRoute.notFound);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Without a staleTime, every query was stale the instant it resolved, so
      // returning to a page refetched and re-flashed a loading state over data
      // that was seconds old. 60s matches what useSnapshot / useMoodLog already
      // set per-query (and the server-side Redis TTL); this just stops the
      // hooks that forgot to.
      //
      // `refetchOnMount` is deliberately left at its default: once data IS
      // stale we still want it refreshed, and React Query serves the cached
      // value while that happens — a background refetch, not a loading state.
      // gcTime keeps the cache alive across a session's worth of back-and-forth
      // instead of evicting 5 minutes in.
      staleTime: 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

import { triggerMindGymClinicalSync } from "@/lib/api/syncMindGymClinicalData";

/** Shared route-transition easing. `as const` so it types as a cubic-bezier tuple. */
const ROUTE_EASE = [0.22, 1, 0.36, 1] as const;

/**
 * RouteWarmup — speculative prefetch of the likely *next* route.
 *
 * Rendered inside the <Suspense> boundary on purpose, so it can only mount
 * after the current route's chunk has resolved and committed. Gating on the
 * window `load` event alone was not enough: `load` fires when the HTML's own
 * subresources finish, which on `/` is *before* React has even requested
 * PublicLanding. The warm-up then issued its request 300ms ahead of the chunk
 * the user was actually waiting for — measured cost, `/` FCP 7096 → 7436ms.
 * A prefetch must never outrank the page in front of the user.
 */
function RouteWarmup({ pathname, signedIn }: { pathname: string; signedIn: boolean }) {
  useIdleRouteWarmup(pathname, signedIn);
  return null;
}

/**
 * AppContent — lives inside BrowserRouter so hooks that need router context
 * work correctly.
 *
 * Gate logic:
 *  otherwise            → normal Routes
 */
function AppContent() {
  const location = useLocation();
  const { user } = useAuth();

  // Warm a route chunk the moment the user shows intent (hover/focus/touch),
  // instead of at click time. See useRoutePrefetch for the measurements.
  // (The speculative idle warm-up is <RouteWarmup>, mounted inside Suspense.)
  useRoutePrefetch();

  // Silent fallback sync: Ensure any stranded offline MindGym data
  // trapped in localStorage pushes to Supabase when the user boots.
  useEffect(() => {
    // Fire-and-forget; no await required on boot. Non-blocking.
    triggerMindGymClinicalSync().catch((err) => {
      console.warn("Silent Boot Sync for MindGym deferred:", err);
    });
  }, []);

  // Pure cross-fade (no y bump) for transitions inside the MindGym surface,
  // so /mindgym ⇄ /mindgym/:toolId feels like one continuous space.
  const isMindGymRoute = location.pathname === "/mindgym" || location.pathname.startsWith("/mindgym/");

  return (
    /*
      Suspense sits OUTSIDE AnimatePresence, not inside the keyed motion.div,
      so the boundary survives navigation instead of being torn down and
      rebuilt on every route change.

      Known limit, measured rather than assumed: `mode="wait"` holds the
      incoming child out of the tree until the outgoing exit animation
      finishes, and that swap happens in AnimatePresence's own state update —
      outside the router's startTransition. So React cannot keep the old page
      painted across a cold chunk fetch here; the fallback still appears
      (~630ms on Fast 3G for /mindgym, down from ~1810ms) whenever the chunk
      wasn't already warmed by prefetch. Dropping `mode="wait"` for
      `mode="popLayout"` would close that gap, but it absolutely-positions the
      outgoing page mid-transition, which needs visual QA against the
      scroll-orchestrated surfaces (PublicLanding / SanctuaryHome GSAP +
      Lenis parallax) before it's safe. See RouteFallback for the shapes.
    */
    <Suspense fallback={<RouteFallback pathname={location.pathname} />}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: isMindGymRoute ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{
            opacity: 0,
            y: isMindGymRoute ? 0 : -4,
            // Under mode="wait" the exit is pure dead time: nothing of the
            // next page can render until it finishes. Halved from the shared
            // 0.22s so the hand-off reads as a hand-off rather than a wait.
            // (Per-target override — `exit` is not a key on `Transition`.)
            transition: { duration: isMindGymRoute ? 0.16 : 0.11, ease: ROUTE_EASE },
          }}
          transition={{ duration: isMindGymRoute ? 0.32 : 0.22, ease: ROUTE_EASE }}
        >
        <Routes location={location}>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/therapy" element={<TherapyLanding />} />
          <Route path="/therapist-bridge" element={<TherapistBridge />} />
          <Route path="/booking/:id" element={<Booking />} />
          <Route path="/qa-tests" element={<QATests />} />
          <Route path="/me" element={<Me />} />
          <Route path="/safety-plan" element={<SafetyPlan />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />

          {/* ─── Legacy IA → consolidated into Mind Gym / Me ──────────────── */}
          {/* These URLs may live in old links, search results, and bookmarks. */}
          {/* We preserve them via redirect rather than 404 to protect SEO and */}
          {/* trust. Standalone wellness pages are subsumed by Mind Gym tools. */}
          <Route path="/wellness-checkin" element={<Navigate to="/me" replace />} />
          <Route path="/healthy-habits" element={<Navigate to="/me" replace />} />
          <Route path="/games" element={<Navigate to="/mindgym" replace />} />
          <Route path="/breathe" element={<Navigate to="/mindgym/breath-sphere" replace />} />
          <Route path="/meditate" element={<Navigate to="/mindgym" replace />} />
          <Route path="/gratitude" element={<Navigate to="/mindgym/gratitude-garden" replace />} />
          <Route path="/stress-control" element={<Navigate to="/mindgym" replace />} />
          <Route path="/nutrition" element={<Navigate to="/" replace />} />

          {/* Game leaves — kept reachable but removed from primary nav */}
          <Route path="/memory-challenge" element={<Navigate to="/mindgym/memory-challenge" replace />} />
          <Route path="/emoji-match" element={<EmojiMatch />} />
          <Route path="/emotion-match" element={<Navigate to="/mindgym/emotion-match" replace />} />
          <Route path="/mood-mountain" element={<MoodMountain />} />
          <Route path="/thought-detective" element={<ThoughtDetective />} />
          <Route path="/balloon-pop" element={<BalloonPositivityGame />} />

          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/peer-support" element={<PeerSupport />} />
          <Route path="/psychological-content" element={<PsychologicalContent />} />
          <Route
            path="/articles/grounding-rituals-busy-mornings"
            element={<GroundingRitualsArticle />}
          />
          <Route
            path="/articles/reset-your-nervous-system"
            element={<NervousSystemResetArticle />}
          />
          <Route
            path="/articles/calming-bedtime-routine"
            element={<BedtimeRoutineArticle />}
          />
          <Route
            path="/articles/mountain-reset-calmer-mind"
            element={<MountainResetGuideArticle />}
          />
          <Route
            path="/articles/nature-focus-visual-grounding"
            element={<NatureFocusVisualGroundingArticle />}
          />
          <Route path="/journal" element={<Journal />} />
          <Route path="/mindgym" element={<MindGymHub />} />
          <Route path="/mindgym/section/:sectionId" element={<MindGymSectionPage />} />
          <Route path="/mindgym/:toolId" element={<MindGymToolPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        <RouteWarmup pathname={location.pathname} signedIn={!!user} />
        </motion.div>
      </AnimatePresence>
    </Suspense>
  );
}

const App = () => (
  // ErrorBoundary is the outermost wrapper so even a crash in
  // QueryClientProvider / ThemeProvider gets the calm fallback rather
  // than a white screen. The fallback intentionally does not depend on
  // any provider beneath it.
  <ErrorBoundary>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
            <AuthProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                {/*
                  v7_startTransition wraps router state updates in
                  React.startTransition, marking navigation as non-urgent so
                  it can't tear against in-flight rendering. Opt-in flag on
                  react-router 6.30; it is the v7 default, so this also stops
                  the console deprecation warning.

                  It is NOT what removed the dead air after a click — measured,
                  that came from prefetch-on-intent (useRoutePrefetch), because
                  `mode="wait"` above keeps the incoming route out of the tree
                  until the exit animation ends and there is therefore nothing
                  for React to start early. Enabled on its own merits.
                */}
                <BrowserRouter future={{ v7_startTransition: true }}>
                  <SkipToMain />
                  <ProductAnalyticsProvider>
                    <AppContent />
                  </ProductAnalyticsProvider>
                </BrowserRouter>
              </TooltipProvider>
            </AuthProvider>
          </div>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </ErrorBoundary>
);

export default App;
