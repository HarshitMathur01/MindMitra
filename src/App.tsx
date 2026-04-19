import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/context/ThemeContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Chat from "./pages/Chat";
import QATests from "./pages/QATests";
import MemoryChallenge from "./pages/MemoryChallenge";
import EmojiMatch from "./pages/EmojiMatch";
import EmotionMatch from "./pages/EmotionMatch";
import MoodMountain from "./pages/MoodMountain";
import ThoughtDetective from "./pages/ThoughtDetective";
import NotFound from "./pages/NotFound";
import BalloonPositivityGame from "./pages/BalloonPositivityGame";
import TherapistBridge from "./pages/TherapistBridge";
import Booking from "./pages/Booking";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import PeerSupport from "./pages/PeerSupport";
import PsychologicalContent from "./pages/PsychologicalContent";
import GroundingRitualsArticle from "./pages/GroundingRitualsArticle";
import NervousSystemResetArticle from "./pages/NervousSystemResetArticle";
import BedtimeRoutineArticle from "./pages/BedtimeRoutineArticle";
import MountainResetGuideArticle from "./pages/MountainResetGuideArticle";
import NatureFocusVisualGroundingArticle from "./pages/NatureFocusVisualGroundingArticle";
import { DashboardSkeleton } from "@/components/layout/DashboardSkeleton";
import Journal from "./pages/Journal";
import MindGymHub from "./pages/mindgym/MindGymHub";
import MindGymToolPage from "./pages/mindgym/MindGymToolPage";
import Me from "./pages/Me";
import SafetyPlan from "./pages/SafetyPlan";
import { ProductAnalyticsProvider } from "@/components/analytics/ProductAnalyticsProvider";

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
        <Routes location={location}>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/therapist-bridge" element={<TherapistBridge />} />
          <Route path="/booking/:id" element={<Booking />} />
          <Route path="/qa-tests" element={<QATests />} />
          <Route path="/me" element={<Me />} />
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
          <Route path="/mindgym/:toolId" element={<MindGymToolPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

const App = () => (
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
);

export default App;
