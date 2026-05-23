import { useMemo } from "react";
import { motion } from "framer-motion";
import { Mic, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import heroImg from "@/assets/sanctuary/hero.jpg";
import { MoodPulse } from "./MoodPulse";

type VariantId = "late-night" | "morning" | "afternoon" | "evening" | "night";

type GreetingVariant = {
  id: VariantId;
  eyebrow: string;
  headline: string;
  italicTail: string;
  subcopy: string;
  accent: string;
  heroAlt: string;
};

// To give a time-of-day its own artwork, drop the file into
// src/assets/sanctuary/ and swap the import on the matching line below.
// e.g. import heroMorning from "@/assets/sanctuary/hero-morning.jpg";
const heroImages: Record<VariantId, string> = {
  "late-night": heroImg,
  morning: heroImg,
  afternoon: heroImg,
  evening: heroImg,
  night: heroImg,
};

/**
 * Five time-of-day variants for the first slide. The bracket is picked once
 * per mount (memoized on the initial hour) so it stays stable for the session.
 */
function getGreetingVariant(hour: number): GreetingVariant {
  if (hour < 5) {
    return {
      id: "late-night",
      eyebrow: "still up",
      headline: "Still up,",
      italicTail: "i'm here.",
      subcopy:
        "the night gets quieter when you say it out loud. no pressure to be okay yet.",
      accent: "var(--accent-sky)",
      heroAlt: "Watercolor of a lamp-lit window against a deep blue sky",
    };
  }
  if (hour < 12) {
    return {
      id: "morning",
      eyebrow: "good morning",
      headline: "Good morning,",
      italicTail: "soft start.",
      subcopy:
        "let's start with one breath. the rest of the day can wait its turn.",
      accent: "var(--accent-amber)",
      heroAlt: "Watercolor of dawn light brushing the edge of a leafing tree",
    };
  }
  if (hour < 17) {
    return {
      id: "afternoon",
      eyebrow: "good afternoon",
      headline: "Soft afternoon,",
      italicTail: "let's check in.",
      subcopy:
        "what part of the day needs unpacking? pick a door, or just sit with me.",
      accent: "var(--accent-sage)",
      heroAlt: "Watercolor of a figure resting beneath a leafing tree",
    };
  }
  if (hour < 21) {
    return {
      id: "evening",
      eyebrow: "good evening",
      headline: "Good evening,",
      italicTail: "i remember.",
      subcopy:
        "what's the through-line of today — even if it feels tangled right now?",
      accent: "var(--accent-blush)",
      heroAlt: "Watercolor of a quiet garden flushed with golden hour",
    };
  }
  return {
    id: "night",
    eyebrow: "soft night",
    headline: "Soft night,",
    italicTail: "just sit.",
    subcopy:
      "leave the loud version of the day at the door. we don't have to fix anything.",
    accent: "var(--accent-sky)",
    heroAlt: "Watercolor of a still pond under a soft night sky",
  };
}

export function HeroPanel({ name }: { name: string }) {
  const variant = useMemo(() => getGreetingVariant(new Date().getHours()), []);
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <section
      className="relative mx-auto w-full max-w-6xl px-6 pb-10 pt-4 md:px-12 md:pb-16 md:pt-6"
      aria-label={`${variant.eyebrow} greeting`}
      data-greeting-variant={variant.id}
    >
      <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-[1.05fr_0.95fr] md:gap-16">
        <motion.div
          key={variant.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <p
            className="mb-5 inline-flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.4em]"
            style={{ color: "var(--ink-faint)" }}
          >
            <span>
              {variant.eyebrow} · {today}
            </span>
          </p>

          <h1
            className="leading-[1.05]"
            style={{
              fontFamily: "var(--font-serif)",
              color: "var(--ink)",
              fontSize: "clamp(2.4rem, 5vw, 4.2rem)",
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            {variant.headline}{" "}
            <span style={{ fontStyle: "italic", color: variant.accent }}>{name}</span>.
            <br />
            <span
              style={{
                fontStyle: "italic",
                color: "var(--ink-soft)",
                fontSize: "0.7em",
              }}
            >
              {variant.italicTail}
            </span>
          </h1>

          <p
            className="mt-5 max-w-md text-base leading-relaxed md:text-lg"
            style={{ color: "var(--ink-soft)" }}
          >
            {variant.subcopy}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/chat"
              className="group inline-flex items-center gap-3 rounded-full px-5 py-3 text-sm font-medium shadow-[0_10px_30px_-12px_rgba(0,0,0,0.25)] transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                backgroundColor: "var(--ink)",
                color: "var(--paper)",
                fontFamily: "var(--font-sans)",
              }}
            >
              <span
                className="grid h-7 w-7 place-items-center rounded-full transition-transform group-hover:rotate-12"
                style={{ backgroundColor: variant.accent }}
              >
                <Mic className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
              Continue your thread
            </Link>

            <Link
              to="/chat"
              className="inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                borderColor: "var(--border)",
                color: "var(--ink)",
                backgroundColor: "var(--paper)",
              }}
            >
              Start fresh
              <ArrowUpRight className="h-4 w-4" strokeWidth={1.7} />
            </Link>
          </div>

          <div className="mt-10">
            <MoodPulse />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          className="relative aspect-[5/4] w-full"
        >
          <div
            className="relative h-full w-full overflow-hidden rounded-[2rem]"
            style={{
              boxShadow:
                "0 30px 80px -40px color-mix(in oklab, var(--ink) 35%, transparent)",
            }}
          >
            <img
              key={variant.id}
              src={heroImages[variant.id]}
              alt={variant.heroAlt}
              width={1536}
              height={1024}
              className="h-full w-full object-cover mix-blend-multiply"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                boxShadow:
                  "inset 0 0 80px 16px color-mix(in oklab, var(--paper) 70%, transparent)",
              }}
            />
          </div>
          <motion.div
            aria-hidden
            animate={{ y: [0, -8, 0], rotate: [0, 3, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -right-2 top-6 h-12 w-12 rounded-full opacity-70"
            style={{
              background: `radial-gradient(circle at 30% 30%, ${variant.accent}, transparent 70%)`,
            }}
          />
        </motion.div>
      </div>
    </section>
  );
}
