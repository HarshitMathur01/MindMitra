import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useMoodLog } from "@/hooks/useMoodLog";
import { moodSlope } from "@/lib/sanctuary/ambience";
import { useAmbience } from "./AmbienceProvider";

type TemplateKey =
  | "lift"
  | "level"
  | "heavy"
  | "morning_lift"
  | "morning_heavy"
  | "night_level"
  | "afternoon_lift"
  | "evening_heavy";

function pickTemplate(
  weekLogs: number,
  slope: number,
  timeBucket: string,
): TemplateKey {
  if (timeBucket === "morning") {
    if (slope > 0.1) return "morning_lift";
    if (slope < -0.1) return "morning_heavy";
  }
  if (timeBucket === "afternoon" && slope > 0.1) return "afternoon_lift";
  if (timeBucket === "evening" && slope < -0.1) return "evening_heavy";
  if (timeBucket === "night" && Math.abs(slope) <= 0.1) return "night_level";
  if (slope > 0.1) return "lift";
  if (slope < -0.1) return "heavy";
  return "level";
}

const ICON_FOR: Record<TemplateKey, string> = {
  lift: "🌤️",
  level: "⛅",
  heavy: "🌧️",
  morning_lift: "🌅",
  morning_heavy: "🌫️",
  night_level: "🌙",
  afternoon_lift: "🌤️",
  evening_heavy: "🌧️",
};

export function InnerWeather() {
  const { t } = useTranslation("sanctuary");
  const { weekLogs } = useMoodLog();
  const ambience = useAmbience();

  // Hide entirely on first-visit / sparse-data case. Better to show nothing
  // than to show fake weather.
  if (weekLogs.length < 3) return null;

  const slope = moodSlope(weekLogs);
  const key = pickTemplate(weekLogs.length, slope, ambience.timeBucket);

  return (
    <motion.aside
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.9 }}
      className="mx-auto w-full max-w-6xl px-6 md:px-12"
    >
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-full border px-4 py-2 text-xs"
        style={{
          borderColor: "var(--border)",
          backgroundColor:
            "color-mix(in oklab, var(--accent-sky) 8%, var(--paper-soft))",
          color: "var(--ink-soft)",
          width: "fit-content",
        }}
      >
        <span aria-hidden className="text-base">
          {ICON_FOR[key]}
        </span>
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            color: "var(--ink)",
          }}
        >
          {t("innerWeather.label")}
        </span>
        <span>{t(`innerWeather.templates.${key}`)}</span>
        <span
          className="ml-2 rounded-full px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.3em]"
          style={{
            backgroundColor: "var(--paper-deep)",
            color: "var(--ink-faint)",
          }}
        >
          {t("innerWeather.since")}
        </span>
      </div>
    </motion.aside>
  );
}
