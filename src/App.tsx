import { useState, useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/context/ThemeContext";

// ── Eager routes ──────────────────────────────────────────────────────────
// Three routes are loaded synchronously because they cover the user's first
// impression and the absolute-must-work paths:
//   1. `/`     — public marketing landing (SEO + first-paint).
//   2. `/auth` — must render instantly when an unauthed user is bounced.
//   3. `/chat` — the core product surface; lazy-loading would add a
//      Suspense flicker on every cold open from a deep link.
// Everything else is `React.lazy` below.
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Chat from "./pages/Chat";
import NotFound from "./pages/NotFound";
import { DashboardSkeleton } from "@/components/layout/DashboardSkeleton";
import { ProductAnalyticsProvider } from "@/components/analytics/ProductAnalyticsProvider";
import ErrorBoundary from "@/components/system/ErrorBoundary";

// ── Lazy routes ───────────────────────────────────────────────────────────
// Code-split everything below so the marketing landing and chat surfaces
// don't pay download cost for screens the user hasn't navigated to. Each
// `lazy(() => import(...))` produces its own JS chunk and is fetched on
// demand by React Router.
const QATests = lazy(() => import("./pages/QATests"));
const MemoryChallenge = lazy(() => import("./pages/MemoryChallenge"));
const EmojiMatch = lazy(() => import("./pages/EmojiMatch"));
const EmotionMatch = lazy(() => import("./pages/EmotionMatch"));
const MoodMountain = lazy(() => import("./pages/MoodMountain"));
const ThoughtDetective = lazy(() => import("./pages/ThoughtDetective"));
const BalloonPositivityGame = lazy(() => import("./pages/BalloonPositivityGame"));
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
const MemoryMirror = lazy(() => import("./pages/MemoryMirror"));
const SafetyPlan = lazy(() => import("./pages/SafetyPlan"));

const queryClient = new QueryClient();

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
          <Route path="/therapist-bridge" element={<TherapistBridge />} />
          <Route path="/booking/:id" element={<Booking />} />
          <Route path="/qa-tests" element={<QATests />} />
          <Route path="/me" element={<Me />} />
          <Route path="/me/memory" element={<MemoryMirror />} />
          <Route path="/safety-plan" element={<SafetyPlan />} />

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
          <Route path="/memory-challenge" element={<MemoryChallenge />} />
          <Route path="/emoji-match" element={<EmojiMatch />} />
          <Route path="/emotion-match" element={<EmotionMatch />} />
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
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <ProductAnalyticsProvider>
                  <AppContent />
                </ProductAnalyticsProvider>
              </BrowserRouter>
            </TooltipProvider>
          </AuthProvider>
        </div>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
