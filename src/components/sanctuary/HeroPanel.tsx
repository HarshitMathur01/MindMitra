import { useMemo } from "react";
import { motion } from "framer-motion";
import { Mic, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import heroImg from "@/assets/sanctuary/hero.jpg";
import { MoodPulse } from "./MoodPulse";
import { useAmbience } from "./AmbienceProvider";
import { usePersonality } from "@/hooks/usePersonality";
import { useVisitContext } from "@/hooks/useVisitContext";
import { timeBucketFor } from "@/lib/sanctuary/ambience";

type VariantId = "lateNight" | "morning" | "afternoon" | "evening" | "night";

// To give a time-of-day its own artwork, drop the file into
// src/assets/sanctuary/ and swap the import on the matching line below.
// e.g. import heroMorning from "@/assets/sanctuary/hero-morning.jpg";
const heroImages: Record<VariantId, string> = {
  lateNight: heroImg,
  morning: heroImg,
  afternoon: heroImg,
  evening: heroImg,
  night: heroImg,
};

function variantForBucket(timeBucket: ReturnType<typeof timeBucketFor>): VariantId {
  return timeBucket === "late-night" ? "lateNight" : (timeBucket as VariantId);
}

export function HeroPanel({ name }: { name: string }) {
  const { t } = useTranslation("sanctuary");
  const ambience = useAmbience();
  const { companionName } = usePersonality();
  const { bucket } = useVisitContext();

  const variant: VariantId = useMemo(
    () => variantForBucket(ambience.timeBucket),
    [ambience.timeBucket],
  );

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Hide first-visit subcopy entirely — even an empty string here would
  // reserve vertical space and make the layout feel like it's "waiting"
  // for the user to do something.
  const visitLine =
    bucket === "first-visit" ? null : t(`hero.visit.${bucketToKey(bucket)}`);

  return (
    <section
      className="relative mx-auto w-full max-w-6xl px-6 pb-10 pt-4 md:px-12 md:pb-16 md:pt-6"
      aria-label={t(`hero.${variant}.eyebrow`)}
      data-greeting-variant={variant}
    >
      <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-[1.05fr_0.95fr] md:gap-16">
        <motion.div
          key={variant}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <p
            className="mb-5 inline-flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.4em]"
            style={{ color: "var(--ink-faint)" }}
          >
            <span>
              {t(`hero.${variant}.eyebrow`)} · {today}
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
            {t(`hero.${variant}.headline`)}{" "}
            <span style={{ fontStyle: "italic", color: ambience.sceneAccent }}>
              {name}
            </span>
            .
            <br />
            <span
              style={{
                fontStyle: "italic",
                color: "var(--ink-soft)",
                fontSize: "0.7em",
              }}
            >
              {t(`hero.${variant}.italicTail`, { companion: companionName })}
            </span>
          </h1>

          <p
            className="mt-5 max-w-md text-base leading-relaxed md:text-lg"
            style={{ color: "var(--ink-soft)" }}
          >
            {t(`hero.${variant}.subcopy`)}
          </p>

          {visitLine && (
            <p
              className="mt-3 max-w-md text-sm italic"
              style={{ color: "var(--ink-faint)", fontFamily: "var(--font-serif)" }}
            >
              {visitLine}
            </p>
          )}

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
                style={{ backgroundColor: ambience.sceneAccent }}
              >
                <Mic className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
              {t("hero.ctaContinue")}
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
              {t("hero.ctaFresh")}
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
              key={variant}
              src={heroImages[variant]}
              alt={t(`hero.${variant}.heroAlt`)}
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
              background: `radial-gradient(circle at 30% 30%, ${ambience.sceneAccent}, transparent 70%)`,
            }}
          />
        </motion.div>
      </div>
    </section>
  );
}

function bucketToKey(b: ReturnType<typeof useVisitContext>["bucket"]):
  | "today"
  | "thisWeek"
  | "returningAfterGap" {
  if (b === "today") return "today";
  if (b === "this-week") return "thisWeek";
  return "returningAfterGap";
}
