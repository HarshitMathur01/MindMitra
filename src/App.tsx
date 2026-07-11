import { useState, useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/context/ThemeContext";
import SkipToMain from "@/components/system/SkipToMain";
import "@/i18n";

import { DashboardSkeleton } from "@/components/layout/DashboardSkeleton";
import { ProductAnalyticsProvider } from "@/components/analytics/ProductAnalyticsProvider";
import ErrorBoundary from "@/components/system/ErrorBoundary";

// ── Lazy routes ───────────────────────────────────────────────────────────
// Code-split everything below so the marketing landing and chat surfaces
// don't pay download cost for screens the user hasn't navigated to. Each
// `lazy(() => import(...))` produces its own JS chunk and is fetched on
// demand by React Router.
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Chat = lazy(() => import("./pages/Chat"));
const QATests = lazy(() => import("./pages/QATests"));
const EmojiMatch = lazy(() => import("./pages/EmojiMatch"));
const MoodMountain = lazy(() => import("./pages/MoodMountain"));
const ThoughtDetective = lazy(() => import("./pages/ThoughtDetective"));
const BalloonPositivityGame = lazy(() => import("./pages/BalloonPositivityGame"));
const TherapyLanding = lazy(() => import("./pages/TherapyLanding"));
const TherapistBridge = lazy(() => import("./pages/TherapistBridge"));
const Booking = lazy(() => import("./pages/Booking"));
const Settings = lazy(() => import("./pages/Settings"));
const Profile = lazy(() => import("./pages/Profile"));
const PeerSupport = lazy(() => import("./pages/PeerSupport"));
const PsychologicalContent = lazy(() => import("./pages/PsychologicalContent"));
const GroundingRitualsArticle = lazy(() => import("./pages/GroundingRitualsArticle"));
const NervousSystemResetArticle = lazy(() => import("./pages/NervousSystemResetArticle"));
const BedtimeRoutineArticle = lazy(() => import("./pages/BedtimeRoutineArticle"));
const MountainResetGuideArticle = lazy(() => import("./pages/MountainResetGuideArticle"));
const NatureFocusVisualGroundingArticle = lazy(
  () => import("./pages/NatureFocusVisualGroundingArticle"),
);
const Journal = lazy(() => import("./pages/Journal"));
const MindGymHub = lazy(() => import("./pages/mindgym/MindGymHub"));
const MindGymSectionPage = lazy(() => import("./pages/mindgym/MindGymSectionPage"));
const MindGymToolPage = lazy(() => import("./pages/mindgym/MindGymToolPage"));
const Me = lazy(() => import("./pages/Me"));
const SafetyPlan = lazy(() => import("./pages/SafetyPlan"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Conservative cache defaults so server-state hooks (useSnapshot, useMoodLog,
// useProfile, …) don't refetch on every route return or window focus. Chat
// session restore in ChatGPTInterface does its own explicit polling and is
// unaffected by these query-level defaults.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 min — treat recently-fetched data as fresh
      gcTime: 10 * 60_000, // 10 min — keep unused data cached for quick returns
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

import { triggerMindGymClinicalSync } from "@/lib/api/syncMindGymClinicalData";

/**
 * AppContent — lives inside BrowserRouter so hooks that need router context
 * work correctly.
 *
 * Gate logic:
 *  otherwise            → normal Routes
 */
function AppContent() {
  const location = useLocation();

  // Silent fallback sync: Ensure any stranded offline MindGym data
  // trapped in localStorage pushes to Supabase when the user boots.
  useEffect(() => {
    // Fire-and-forget; no await required on boot. Non-blocking.
    triggerMindGymClinicalSync().catch((err) => {
      console.warn("Silent Boot Sync for MindGym deferred:", err);
    });
  }, []);

  // Warm the /chat chunk once the browser is idle — it's the primary CTA
  // from both the marketing landing and the sanctuary, so the transition
  // shouldn't pay a chunk fetch. Same import specifier as the lazy route,
  // so this resolves to the same chunk and React reuses it. Skipped on
  // Save-Data / 2G connections.
  useEffect(() => {
    const conn = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    if (conn?.saveData || /2g/.test(conn?.effectiveType ?? "")) return;

    const warm = () => void import("./pages/Chat");
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(warm, { timeout: 5000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(warm, 3000);
    return () => window.clearTimeout(t);
  }, []);

  // Pure cross-fade (no y bump) for transitions inside the MindGym surface,
  // so /mindgym ⇄ /mindgym/:toolId feels like one continuous space.
  const isMindGymRoute = location.pathname === "/mindgym" || location.pathname.startsWith("/mindgym/");

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: isMindGymRoute ? 0 : 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: isMindGymRoute ? 0 : -4 }}
        transition={{ duration: isMindGymRoute ? 0.32 : 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        {/*
          Suspense fallback uses our existing dashboard skeleton so the
          chunk-fetch flicker matches the rest of the app's calm loading
          aesthetic. Without it React would throw on the first lazy
          route navigation.
        */}
        <Suspense fallback={<DashboardSkeleton />}>
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
        </Suspense>
      </motion.div>
    </AnimatePresence>
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
                <BrowserRouter>
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
