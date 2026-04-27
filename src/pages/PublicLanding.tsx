import Header from "@/components/layout/Header";
import HeroVideo from "@/components/sections/HeroVideo";
import HowItWorks from "@/components/sections/HowItWorks";
import FeaturesPreview from "@/components/sections/FeaturesPreview";
import TestimonialCarousel from "@/components/sections/TestimonialCarousel";
import CTABanner from "@/components/sections/CTABanner";
import { HillsFooter } from "@/components/layout/HillsFooter";
import SEO from "@/components/system/SEO";

/**
 * Public landing — "a room with a warm lamp on".
 *
 * Quiet Companion design language: warm cream canvas, watercolor
 * illustrations, Fraunces serif headlines, generous whitespace,
 * one-idea-per-section rhythm. Honors candlelight night mode via
 * the global ThemeContext (data-theme="dark" on <html>).
 */
const PublicLanding = () => {
  return (
    <div className="qc-canvas min-h-screen">
      <SEO
        title="A quiet companion"
        description="A private place to think out loud, return to the same conversation tomorrow, and reach a real therapist when you're ready. Built for the way young people in India actually talk."
        path="/"
        ogVideo="/video/hero.mp4"
      />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:shadow"
      >
        skip to content
      </a>
      <Header />
      <main id="main-content" tabIndex={-1}>
        <HeroVideo
          headline="something soft to set things down on, for the loud days."
          subheadline="a private place to think out loud, return to the same conversation tomorrow, and reach a real therapist when you're ready."
          primaryCta={{ text: "open mindmitra", href: "/auth" }}
          secondaryCta={{ text: "how it holds you", href: "#how-it-works" }}
        />
        <HowItWorks />
        <FeaturesPreview />
        <TestimonialCarousel />
        <CTABanner />
      </main>
      <HillsFooter
        message="rest now. tomorrow finds you here."
        smallPrint="MindMitra · a quiet companion. private by default."
      />
    </div>
  );
};

export default PublicLanding;
