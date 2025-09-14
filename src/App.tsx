import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
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
import BalloonPositivityGame from "./pages/BalloonPositivityGame";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/qa-tests" element={<QATests />} />
            <Route path="/wellness-checkin" element={<WellnessCheckIn />} />
            <Route path="/games" element={<Games />} />
            <Route path="/memory-challenge" element={<MemoryChallenge />} />
            <Route path="/emoji-match" element={<EmojiMatch />} />
            <Route path="/emotion-match" element={<EmotionMatch />} />
            <Route path="/mood-mountain" element={<MoodMountain />} />
            <Route path="/thought-detective" element={<ThoughtDetective />} />
            <Route path="/balloon-pop" element={<BalloonPositivityGame />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
