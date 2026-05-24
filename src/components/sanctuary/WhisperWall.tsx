import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Quote } from "lucide-react";
import { WHISPERS, type Whisper } from "@/data/whisperWall";
import { useSettings } from "@/hooks/useSettings";
import { useSnapshot } from "@/hooks/useSnapshot";
import { useAmbience } from "./AmbienceProvider";
import type { SupportedLanguage } from "@/lib/locale";

const THEMED_CAP = 3;
const RANDOM_CAP = 2;

/**
 * Build the whisper rotation. `dominantThemes` is the user's top recurring
 * themes from /me/snapshot — we use them to *rank* the pool, never to
 * label anything on screen. The cap (3 themed + 2 random) keeps the wall
 * from pigeonholing a user who's just had one rough week of, say, sleep
 * problems.
 */
function filterWhispers(
  language: SupportedLanguage,
  lowAffect: boolean,
  dominantThemes: string[],
): Whisper[] {
  // Prefer same-language quotes, fall back to English if none.
  const sameLang = WHISPERS.filter((w) => w.language === language);
  const pool = sameLang.length > 0 ? sameLang : WHISPERS.filter((w) => w.language === "english");
  const safe = lowAffect ? pool.filter((w) => w.lowAffectSafe) : pool;
  if (safe.length === 0) return [];

  if (dominantThemes.length === 0) return safe;

  const themeSet = new Set(dominantThemes);
  const themed = safe.filter((w) => w.themes.some((t) => themeSet.has(t)));
  if (themed.length === 0) return safe;

  const themedPicked = themed.slice(0, THEMED_CAP);
  const themedIds = new Set(themedPicked.map((w) => w.id));
  const randomPool = safe.filter((w) => !themedIds.has(w.id));
  return [...themedPicked, ...randomPool.slice(0, RANDOM_CAP)];
}

export function WhisperWall() {
  const { t } = useTranslation("sanctuary");
  const { settings } = useSettings();
  const ambience = useAmbience();
  const { data: snapshot } = useSnapshot();

  const language = (settings?.language as SupportedLanguage) ?? "english";
  const lowAffect = ambience.valence < -0.3;

  // Phase 2: hide the WhisperWall entirely during a crisis cooldown —
  // peer voices can land wrong in that window.
  const hidden = ambience.crisisQuiet;

  const dominantThemes = snapshot?.dominant_themes ?? [];

  const filtered = useMemo(
    () => filterWhispers(language, lowAffect, dominantThemes),
    [language, lowAffect, dominantThemes],
  );

  const [i, setI] = useState(0);

  useEffect(() => {
    setI(0);
  }, [filtered.length]);

  useEffect(() => {
    if (filtered.length === 0) return;
    const t = setInterval(
      () => setI((p) => (p + 1) % filtered.length),
      5500,
    );
    return () => clearInterval(t);
  }, [filtered.length]);

  if (hidden || filtered.length === 0) return null;
  const current = filtered[i];

  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-12 md:px-12">
      <div
        className="relative overflow-hidden rounded-3xl border p-7 md:p-9"
        style={{
          borderColor: "var(--border)",
          background:
            "radial-gradient(ellipse at top right, color-mix(in oklab, var(--accent-blush) 22%, var(--paper-soft)), var(--paper-soft))",
        }}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <p
            className="text-[0.7rem] uppercase tracking-[0.4em]"
            style={{ color: "var(--ink-faint)" }}
          >
            {t("whisperWall.eyebrow")}
          </p>
          <span className="flex items-center gap-1.5">
            {filtered.map((_, idx) => (
              <span
                key={idx}
                className="h-1 rounded-full transition-all"
                style={{
                  width: idx === i ? 18 : 5,
                  backgroundColor:
                    idx === i
                      ? "var(--ink)"
                      : "color-mix(in oklab, var(--ink) 25%, transparent)",
                }}
              />
            ))}
          </span>
        </div>

        <div className="relative min-h-[120px]">
          <Quote
            aria-hidden
            className="absolute -left-1 -top-1 h-8 w-8 opacity-20"
            style={{ color: "var(--ink)" }}
            strokeWidth={1.2}
          />
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="pl-8"
            >
              <p
                className="leading-snug"
                style={{
                  fontFamily: "var(--font-serif)",
                  color: "var(--ink)",
                  fontSize: "clamp(1.3rem, 2.4vw, 1.8rem)",
                  fontStyle: "italic",
                  fontWeight: 500,
                }}
              >
                "{current.text}"
              </p>
              <p
                className="mt-3 text-[0.7rem] uppercase tracking-[0.3em]"
                style={{ color: "var(--ink-faint)" }}
              >
                {current.tag}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
