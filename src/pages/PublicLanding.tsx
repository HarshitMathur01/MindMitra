import { Suspense, lazy } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WelcomeHero from "@/components/sections/WelcomeHero";
import DailyAffirmation from "@/components/sections/DailyAffirmation";
import FeaturesPreview from "@/components/sections/FeaturesPreview";
import TestimonialCarousel from "@/components/sections/TestimonialCarousel";
import CrisisSafetyBadge from "@/components/sections/CrisisSafetyBadge";
import BreathingWidget from "@/components/sections/BreathingWidget";
import ScrollToTop from "@/components/sections/ScrollToTop";

const AvatarShowcase = lazy(() => import("@/components/sections/AvatarShowcase"));

/**
 * Public landing — "a room with a lamp on".
 *
 * Flow intent: a single greeting, a small set of invitations, a soft
 * daily affirmation, a look at the companion, and one human voice.
 * No stats section — numbers create comparison anxiety in a mental
 * wellness context.
 */
const PublicLanding = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main>
        <WelcomeHero />
        <FeaturesPreview />
        <DailyAffirmation />
        <Suspense
          fallback={
            <div className="mx-auto my-16 h-72 max-w-page rounded-2xl bg-ink-1" />
          }
        >
          <AvatarShowcase />
        </Suspense>
        <TestimonialCarousel />
      </main>
      <Footer />
      <CrisisSafetyBadge />
      <BreathingWidget />
      <ScrollToTop />
    </div>
  );
};

export default PublicLanding;
