import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WelcomeHero from "@/components/sections/WelcomeHero";
import HowItWorks from "@/components/sections/HowItWorks";
import FeaturesPreview from "@/components/sections/FeaturesPreview";
import TestimonialCarousel from "@/components/sections/TestimonialCarousel";
import CTABanner from "@/components/sections/CTABanner";

/**
 * Public landing — "a room with a warm lamp on".
 *
 * Flow: Hero → How it works → Features → Testimonials → CTA → Footer
 */
const PublicLanding = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main>
        <WelcomeHero />
        <HowItWorks />
        <FeaturesPreview />
        <TestimonialCarousel />
        <CTABanner />
      </main>
      <Footer />
    </div>
  );
};

export default PublicLanding;
