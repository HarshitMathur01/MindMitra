import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Mic, ArrowUpRight, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAmbience } from "./AmbienceProvider";
import { usePersonality } from "@/hooks/usePersonality";
import { useVisitContext } from "@/hooks/useVisitContext";
import { timeBucketFor } from "@/lib/sanctuary/ambience";

type VariantId = "lateNight" | "morning" | "afternoon" | "evening" | "night";

function variantForBucket(timeBucket: ReturnType<typeof timeBucketFor>): VariantId {
  return timeBucket === "late-night" ? "lateNight" : (timeBucket as VariantId);
}

/**
 * Arrival-scene greeting. The scene artwork behind it belongs to the parent
 * SceneSection, so this is a single text column: eyebrow, headline, subcopy,
 * visit line, the two chat CTAs, and a scroll cue into the check-in scene.
 */
export function HeroPanel({ name }: { name: string }) {
  const { t } = useTranslation("sanctuary");
  const ambience = useAmbience();
  const { companionName } = usePersonality();
  const { bucket } = useVisitContext();
  const reducedMotion = useReducedMotion();

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
    <motion.div
      key={variant}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-2xl"
      data-greeting-variant={variant}
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

      <a
        href="#checkin"
        className="mt-12 inline-flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.3em] transition-colors hover:text-[var(--ink)]"
        style={{ color: "var(--ink-faint)" }}
      >
        <motion.span
          aria-hidden
          animate={reducedMotion ? undefined : { y: [0, 4, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="grid place-items-center"
        >
          <ChevronDown className="h-4 w-4" strokeWidth={1.6} />
        </motion.span>
        {t("hero.scrollCue")}
      </a>
    </motion.div>
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
