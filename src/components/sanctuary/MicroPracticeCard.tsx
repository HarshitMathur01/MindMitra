import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Wind, Pause, Play } from "lucide-react";
import { useAmbience } from "./AmbienceProvider";

type Phase = "in" | "hold" | "out" | "rest";
const PHASE_KEY: Record<Phase, "phaseIn" | "phaseHold" | "phaseOut" | "phaseRest"> = {
  in: "phaseIn",
  hold: "phaseHold",
  out: "phaseOut",
  rest: "phaseRest",
};

export function MicroPracticeCard() {
  const { t } = useTranslation("sanctuary");
  const ambience = useAmbience();
  const [playing, setPlaying] = useState(false);
  const [phase, setPhase] = useState<Phase>("in");

  useEffect(() => {
    if (!playing) return;
    const order: Phase[] = ["in", "hold", "out", "rest"];
    const t = setTimeout(() => {
      const i = order.indexOf(phase);
      setPhase(order[(i + 1) % order.length]);
    }, 4000);
    return () => clearTimeout(t);
  }, [playing, phase]);

  // Phase 2: when ambience.crisisQuiet fires, swap the active exercise for
  // a "sit with me" variant. No CTA, no phase cycling, no urgency.
  if (ambience.crisisQuiet) {
    return (
      <div className="w-full">
        <div
          className="relative grid grid-cols-1 items-center gap-8 overflow-hidden rounded-3xl border p-7 md:p-10"
          style={{
            borderColor: "var(--border)",
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--accent-sky) 18%, var(--paper-soft)), var(--paper-soft))",
          }}
        >
          <div className="mx-auto max-w-md text-center">
            <motion.div
              animate={{ scale: [1, 1.06, 1], opacity: [0.55, 0.85, 0.55] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="mx-auto mb-6 h-20 w-20 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 35% 30%, color-mix(in oklab, var(--accent-sky) 50%, transparent), transparent 70%)",
              }}
            />
            <p
              className="text-sm italic"
              style={{ color: "var(--ink-soft)", fontFamily: "var(--font-serif)" }}
            >
              {t("orb.aria", { companion: "Mitra" })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const label = t(`microPractice.${PHASE_KEY[phase]}`);
  const scale = { in: 1.25, hold: 1.25, out: 0.85, rest: 0.85 }[phase];

  return (
    <div className="w-full">
      <div
        className="relative grid grid-cols-1 items-center gap-8 overflow-hidden rounded-3xl border p-7 md:grid-cols-[1fr_auto] md:p-10"
        style={{
          borderColor: "var(--border)",
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--accent-sky) 14%, var(--paper-soft)), var(--paper-soft))",
        }}
      >
        <div>
          <p
            className="mb-3 inline-flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.35em]"
            style={{ color: "var(--ink-faint)" }}
          >
            <Wind className="h-3 w-3" strokeWidth={1.6} />
            {t("microPractice.eyebrow")}
          </p>
          <h2
            className="leading-tight"
            style={{
              fontFamily: "var(--font-serif)",
              color: "var(--ink)",
              fontSize: "clamp(1.6rem, 2.6vw, 2.1rem)",
              fontWeight: 500,
            }}
          >
            {t("microPractice.heading")}
          </h2>

          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="mt-6 inline-flex items-center gap-2.5 rounded-full px-5 py-2.5 text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {playing ? t("microPractice.stop") : t("microPractice.start")}
          </button>
        </div>

        <div className="relative mx-auto grid h-44 w-44 place-items-center md:h-52 md:w-52">
          <motion.div
            animate={{ scale: playing ? scale : 1, opacity: playing ? 1 : 0.7 }}
            transition={{ duration: 4, ease: "easeInOut" }}
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 35% 30%, color-mix(in oklab, var(--accent-sage) 55%, transparent), transparent 70%)",
            }}
          />
          <motion.div
            animate={{ scale: playing ? scale * 0.9 : 0.9 }}
            transition={{ duration: 4, ease: "easeInOut" }}
            className="absolute inset-6 rounded-full border"
            style={{
              borderColor: "color-mix(in oklab, var(--ink) 25%, transparent)",
            }}
          />
          <span
            className="relative text-xs uppercase tracking-[0.4em]"
            style={{ color: "var(--ink-soft)" }}
          >
            {playing ? label : "ready"}
          </span>
        </div>
      </div>
    </div>
  );
}
