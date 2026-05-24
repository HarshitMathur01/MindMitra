import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { MOOD_LABELS, useMoodLog, type MoodLabel } from "@/hooks/useMoodLog";

const COLORS = [
  "oklch(0.55 0.05 280)",
  "oklch(0.65 0.06 240)",
  "oklch(0.78 0.04 95)",
  "oklch(0.78 0.10 130)",
  "oklch(0.82 0.13 70)",
];

export function MoodPulse() {
  const { t } = useTranslation("sanctuary");
  const { todayLog, logMood, isSaving } = useMoodLog();
  const pickedIndex = todayLog?.mood_index ?? null;
  const pickedLabel: MoodLabel | null = todayLog?.mood_label ?? null;

  return (
    <div className="flex flex-col items-start gap-3">
      <p
        className="text-[0.7rem] uppercase tracking-[0.35em]"
        style={{ color: "var(--ink-faint)", fontFamily: "var(--font-sans)" }}
      >
        {t("moodPulse.prompt")}
      </p>
      <div className="flex items-center gap-3">
        {MOOD_LABELS.map((label, i) => {
          const active = pickedIndex === i;
          return (
            <button
              key={label}
              type="button"
              onClick={() => logMood(i)}
              disabled={isSaving}
              aria-label={`Mood: ${t(`moodPulse.labels.${label}`)}`}
              aria-pressed={active}
              className="group relative grid place-items-center outline-none disabled:cursor-wait"
            >
              <motion.span
                animate={{
                  scale: active ? 1.35 : 1,
                  boxShadow: active
                    ? `0 0 0 6px color-mix(in oklab, ${COLORS[i]} 25%, transparent)`
                    : "0 0 0 0px transparent",
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="block h-3.5 w-3.5 rounded-full"
                style={{ backgroundColor: COLORS[i], opacity: active ? 1 : 0.55 }}
              />
              <span
                className="pointer-events-none absolute -bottom-6 text-[0.65rem] uppercase tracking-[0.2em] opacity-0 transition-opacity group-hover:opacity-100"
                style={{ color: "var(--ink-soft)" }}
              >
                {t(`moodPulse.labels.${label}`)}
              </span>
            </button>
          );
        })}
        {pickedLabel && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className="ml-3 text-xs italic"
            style={{ color: "var(--ink-soft)", fontFamily: "var(--font-serif)" }}
          >
            {t("moodPulse.logged", { label: t(`moodPulse.labels.${pickedLabel}`) })}
          </motion.span>
        )}
      </div>
    </div>
  );
}
