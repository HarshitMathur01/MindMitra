import Header from "@/components/layout/Header";
import HeroVideo from "@/components/sections/HeroVideo";
import HowItWorks from "@/components/sections/HowItWorks";
import FeaturesPreview from "@/components/sections/FeaturesPreview";
import TestimonialCarousel from "@/components/sections/TestimonialCarousel";
import CTABanner from "@/components/sections/CTABanner";
import { HillsFooter } from "@/components/layout/HillsFooter";
import SEO from "@/components/system/SEO";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Public landing — product-forward, minimal copy, poster-first hero.
 * QC canvas + night mode via ThemeContext.
 */
const PublicLanding = () => {
  const reduce = useReducedMotion();

  return (
    <div className="qc-canvas min-h-screen">
      <SEO
        title="Think out loud. Pick up tomorrow."
        description="MindMitra is a private AI companion for students in India — Hindi, English, or Hinglish — that remembers your thread, offers short resets, and connects you to vetted therapists when you want a human."
        path="/"
        ogImage="/video/hero-poster.jpg"
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
          headline="The layer before therapy — in the language you actually use."
          subheadline="One thread that remembers. Short tools when your head won’t quiet. A bridge to real people — never a replacement."
          primaryCta={{ text: "Begin with MindMitra", href: "/auth" }}
          secondaryCta={{ text: "See the three pieces", href: "#how-it-works" }}
          showVideo={false}
        />

        <motion.section
          aria-label="What MindMitra is"
          className="border-y border-[color:var(--qc-border-stronger)]/60 bg-[color:var(--qc-surface)]/80"
          initial={{ opacity: reduce ? 1 : 0, y: reduce ? 0 : 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{
            duration: reduce ? 0.01 : 0.55,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-4 py-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-6 sm:px-6 sm:py-10 md:px-8 md:py-12">
            {[
              { k: "Language", v: "Hindi · English · Hinglish" },
              { k: "Memory", v: "Your thread, not a questionnaire" },
              { k: "Care", v: "Crisis templates + optional therapists" },
            ].map((row) => (
              <div key={row.k} className="min-w-0 sm:max-w-[30%] sm:flex-1">
                <p className="qc-eyebrow text-[10px] sm:text-[11px] tracking-[0.22em]">{row.k}</p>
                <p className="qc-display mt-1 text-base sm:text-lg leading-snug text-[color:var(--qc-ink)] sm:text-xl">
                  {row.v}
                </p>
              </div>
            ))}
          </div>
        </motion.section>

        <HowItWorks />
        <FeaturesPreview />
        <TestimonialCarousel />
        <CTABanner />
      </main>
      <HillsFooter
        message="Same thread tomorrow. No performance required."
        smallPrint="MindMitra · built for students in India · private by default"
      />
    </div>
  );
};

export default PublicLanding;
