import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AuthProvider } from "@/hooks/useAuth";
import { ScrollProgressIndicator } from "@/components/ui/scroll-progress";
import { BackToTopButton } from "@/components/ui/back-to-top";
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
import ThoughtDetective from "./pages/ThoughtDetective";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Page transition variants for mental wellness
const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
    scale: 0.98
  },
  in: {
    opacity: 1,
    y: 0,
    scale: 1
  },
  out: {
    opacity: 0,
    y: -20,
    scale: 1.02
  }
};

const pageTransition = {
  type: "tween" as const,
  ease: "anticipate" as const,
  duration: 0.4
};

// Animated Route wrapper with calming transitions
const AnimatedRoute = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  
  return (
    <motion.div
      key={location.pathname}
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      className="min-h-screen"
    >
      {children}
    </motion.div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ScrollProgressIndicator />
        <BackToTopButton />
        <BrowserRouter>
          <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={
                  <AnimatedRoute>
                    <Index />
                  </AnimatedRoute>
                } />
                <Route path="/auth" element={
                  <AnimatedRoute>
                    <Auth />
                  </AnimatedRoute>
                } />
                <Route path="/chat" element={
                  <AnimatedRoute>
                    <Chat />
                  </AnimatedRoute>
                } />
                <Route path="/qa-tests" element={
                  <AnimatedRoute>
                    <QATests />
                  </AnimatedRoute>
                } />
                <Route path="/wellness-checkin" element={
                  <AnimatedRoute>
                    <WellnessCheckIn />
                  </AnimatedRoute>
                } />
                <Route path="/games" element={
                  <AnimatedRoute>
                    <Games />
                  </AnimatedRoute>
                } />
                <Route path="/memory-challenge" element={
                  <AnimatedRoute>
                    <MemoryChallenge />
                  </AnimatedRoute>
                } />
                <Route path="/emoji-match" element={
                  <AnimatedRoute>
                    <EmojiMatch />
                  </AnimatedRoute>
                } />
                <Route path="/emotion-match" element={
                  <AnimatedRoute>
                    <EmotionMatch />
                  </AnimatedRoute>
                } />
                <Route path="/mood-mountain" element={
                  <AnimatedRoute>
                    <MoodMountain />
                  </AnimatedRoute>
                } />
                <Route path="/thought-detective" element={
                  <AnimatedRoute>
                    <ThoughtDetective />
                  </AnimatedRoute>
                } />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={
                  <AnimatedRoute>
                    <NotFound />
                  </AnimatedRoute>
                } />
              </Routes>
            </AnimatePresence>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
