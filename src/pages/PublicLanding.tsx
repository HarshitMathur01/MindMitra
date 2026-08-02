import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useLowTierDevice } from "@/hooks/useLowTierDevice";
import { useLenisScroll } from "@/hooks/useLenisScroll";
import SEO from "@/components/system/SEO";
import { PaperTexture } from "@/components/landing/PaperTexture";
import { ScrollSpine } from "@/components/landing/ScrollSpine";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { Hero } from "@/components/landing/Hero";
import { ThreeAmSection } from "@/components/landing/ThreeAmSection";
import { Personas } from "@/components/landing/Personas";
import { ProofSection } from "@/components/landing/ProofSection";
import { TrustStrip } from "@/components/landing/TrustStrip";
import { LandingFooter } from "@/components/landing/LandingFooter";
import "@/components/landing/landing.css";

/**
 * Public landing — the unauthenticated `/` surface.
 *
 * A watercolour, scroll-told page: ink-bleed hero → a pinned 3AM dawn →
 * the five companions → the proof spread → recognitions. Every section
 * degrades to a static, legible layout under `prefers-reduced-motion` or on
 * a low-tier device; no copy is ever revealed *by* animation.
 *
 * This page is deliberately light-only and owns its palette (`.mm-landing`
 * plus the `forest` / `cream` / `terracotta` Tailwind tokens) instead of the
 * app's themed CSS variables — the authenticated app's dark mode must not
 * repaint the marketing surface.
 *
 * Loaded lazily from `pages/Index.tsx` so GSAP, Lenis and the landing CSS
 * never reach the authenticated bundle.
 */
const PublicLanding = () => {
  const reduced = usePrefersReducedMotion();
  const lowTier = useLowTierDevice();

  // Lenis smooths the scroll that the pinned 3AM timeline is scrubbed
  // against. Off for reduced motion and weak devices.
  useLenisScroll(!reduced && !lowTier);

  return (
    <div className="mm-landing relative min-h-screen bg-cream text-ink">
      <SEO
        title="Speak your mind, in your own words"
        description="MindMitra is an AI companion for students in India — Hindi, English, or Hinglish. Non-judgmental, anytime, anywhere. Even at 3 in the morning."
        path="/"
      />
      <PaperTexture />
      <ScrollSpine />
      <LandingHeader />
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <ThreeAmSection />
        <Personas />
        <ProofSection />
        <TrustStrip />
      </main>
      <LandingFooter />
    </div>
  );
};

export default PublicLanding;
