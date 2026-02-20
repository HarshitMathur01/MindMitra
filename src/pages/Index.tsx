import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WelcomeHero from "@/components/sections/WelcomeHero";
import DailyAffirmation from "@/components/sections/DailyAffirmation";
import AvatarShowcase from "@/components/sections/AvatarShowcase";
import FeaturesPreview from "@/components/sections/FeaturesPreview";
import StatsSection from "@/components/sections/StatsSection";
import TestimonialCarousel from "@/components/sections/TestimonialCarousel";
import CrisisSafetyBadge from "@/components/sections/CrisisSafetyBadge";
import BreathingWidget from "@/components/sections/BreathingWidget";
import ScrollToTop from "@/components/sections/ScrollToTop";
import { useAuth } from "@/hooks/useAuth";
import { Brain } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Brain className="h-12 w-12 text-primary mx-auto mb-4 pulse-gentle" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <WelcomeHero />
        <DailyAffirmation />

        {/* 3D Avatar Conversation Showcase */}
        <AvatarShowcase />

        <FeaturesPreview />
        <StatsSection />
        <TestimonialCarousel />
      </main>

      <Footer />

      {/* Fixed Crisis Safety Badge */}
      <CrisisSafetyBadge />
      <BreathingWidget />
      <ScrollToTop />
    </div>
  );
};

export default Index;
