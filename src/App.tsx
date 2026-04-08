import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/context/ThemeContext";
import { useFirstTimeUser } from "@/hooks/useFirstTimeUser";
import FirstTimeExperience from "@/components/onboarding/FirstTimeExperience";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Chat from "./pages/Chat";
import QATests from "./pages/QATests";
import WellnessCheckIn from "./pages/WellnessCheckIn";
import Games from "./pages/Games";
import MemoryChallenge from "./pages/MemoryChallenge";
import EmojiMatch from "./pages/EmojiMatch";
import EmotionMatch from "./pages/EmotionMatch";
import MoodMountain from "./pages/MoodMountain";
import HealthyHabits from "./pages/HealthyHabits";
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
import Breathe from "./pages/Breathe";
import Meditate from "./pages/Meditate";
import Journal from "./pages/Journal";
import Gratitude from "./pages/Gratitude";
import StressControl from "./pages/StressControl";
import Nutrition from "./pages/Nutrition";
import MindGymHub from "./pages/mindgym/MindGymHub";
import MindGymToolPage from "./pages/mindgym/MindGymToolPage";

const queryClient = new QueryClient();

import { triggerMindGymClinicalSync } from "@/lib/api/syncMindGymClinicalData";

/**
 * AppContent — lives inside BrowserRouter so hooks that need router context
 * work correctly.
 *
 * Gate logic:
 *  loading              → fullscreen spinner
 *  isFirstTime && !done → FirstTimeExperience orchestrator
 *  otherwise            → normal Routes
 */
function AppContent() {
  const { isFirstTime, loading, onboardingStep } = useFirstTimeUser();
  const [onboardingDone, setOnboardingDone] = useState(false);
  const location = useLocation();

  // Silent fallback sync: Ensure any stranded offline MindGym data 
  // trapped in localStorage pushes to Supabase when the user boots.
  useEffect(() => {
    // Fire-and-forget; no await required on boot. Non-blocking.
    triggerMindGymClinicalSync().catch((err) => {
      console.warn("Silent Boot Sync for MindGym deferred:", err);
    });
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (isFirstTime && !onboardingDone) {
    return (
      <FirstTimeExperience
        initialStep={onboardingStep}
        onComplete={() => setOnboardingDone(true)}
      />
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
      >
        <Routes location={location}>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/therapist-bridge" element={<TherapistBridge />} />
          <Route path="/booking/:id" element={<Booking />} />
          <Route path="/qa-tests" element={<QATests />} />
          <Route path="/wellness-checkin" element={<WellnessCheckIn />} />
          <Route path="/games" element={<Games />} />
          <Route path="/memory-challenge" element={<MemoryChallenge />} />
          <Route path="/emoji-match" element={<EmojiMatch />} />
          <Route path="/emotion-match" element={<EmotionMatch />} />
          <Route path="/mood-mountain" element={<MoodMountain />} />
          <Route path="/healthy-habits" element={<HealthyHabits />} />
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
          <Route path="/breathe" element={<Breathe />} />
          <Route path="/meditate" element={<Meditate />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/gratitude" element={<Gratitude />} />
          <Route path="/stress-control" element={<StressControl />} />
          <Route path="/nutrition" element={<Nutrition />} />
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
      <div className="min-h-screen bg-background text-text-primary transition-colors duration-300">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </div>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
