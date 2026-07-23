import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Volume2, VolumeX } from "lucide-react";
import { useAmbience } from "./AmbienceProvider";
import {
  currentSoundscape,
  playSoundscape,
  stopSoundscape,
  subscribeSoundscape,
  type SoundscapeTrack,
} from "@/lib/sanctuary/soundscape";

const TRACKS: { id: SoundscapeTrack; glyph: string }[] = [
  { id: "rain", glyph: "◌" },
  { id: "cafe", glyph: "◍" },
  { id: "tanpura", glyph: "◎" },
];

const STORAGE_KEY = "mindmitra-sanctuary-soundscape";

/**
 * Default track suggestion: low valence at any time → rain; late-night
 * → tanpura; afternoon → cafe; otherwise null (no auto-play). The bar
 * highlights the suggestion but does NOT auto-play until the user clicks
 * — auto-audio breaks consent and Lighthouse / accessibility alike.
 */
function suggestionFor(valence: number, timeBucket: string): SoundscapeTrack | null {
  if (valence < -0.3) return "rain";
  if (timeBucket === "late-night" || timeBucket === "night") return "tanpura";
  if (timeBucket === "afternoon") return "cafe";
  return null;
}

export function SoundscapeBar() {
  const { t } = useTranslation("sanctuary");
  const ambience = useAmbience();
  const [active, setActive] = useState<SoundscapeTrack | null>(() =>
    currentSoundscape(),
  );
  const [suggestion, setSuggestion] = useState<SoundscapeTrack | null>(null);

  // Mirror the singleton so the pressed state resets if playback fails
  // (missing file, blocked) or is stopped elsewhere (guided video starting).
  useEffect(() => subscribeSoundscape(setActive), []);

  // The soundscape belongs to this room — leaving the page fades it out.
  useEffect(() => () => stopSoundscape(), []);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as SoundscapeTrack | null;
    if (stored && TRACKS.some((tr) => tr.id === stored)) {
      setSuggestion(stored);
      return;
    }
    setSuggestion(suggestionFor(ambience.valence, ambience.timeBucket));
  }, [ambience.valence, ambience.timeBucket]);

  const toggle = (id: SoundscapeTrack) => {
    const next = active === id ? null : id;
    if (next) {
      playSoundscape(next);
      localStorage.setItem(STORAGE_KEY, next);
    } else {
      stopSoundscape();
    }
  };

  return (
    <div
      className="flex w-fit items-center gap-1 rounded-full border px-2 py-1.5 backdrop-blur"
      style={{
        borderColor: "var(--border)",
        backgroundColor:
          "color-mix(in oklab, var(--paper) 80%, transparent)",
      }}
    >
      <span
        className="px-2 text-[0.6rem] uppercase tracking-[0.35em]"
        style={{ color: "var(--ink-faint)" }}
      >
        {t("soundscape.label")}
      </span>
      {TRACKS.map((tr) => {
        const on = active === tr.id;
        const suggested = !on && suggestion === tr.id;
        return (
          <button
            key={tr.id}
            type="button"
            onClick={() => toggle(tr.id)}
            aria-pressed={on}
            className="relative grid place-items-center rounded-full px-3 py-1 text-xs transition-colors"
            style={{
              color: on ? "var(--paper)" : "var(--ink-soft)",
              backgroundColor: on ? "var(--ink)" : "transparent",
              fontFamily: "var(--font-sans)",
              borderColor: suggested ? "var(--ink-faint)" : "transparent",
              borderStyle: "solid",
              borderWidth: 1,
            }}
          >
            {on && (
              <motion.span
                aria-hidden
                animate={{ opacity: [0.3, 0.8, 0.3] }}
                transition={{ duration: 2.2, repeat: Infinity }}
                className="absolute inset-0 rounded-full"
                style={{
                  boxShadow:
                    "0 0 12px color-mix(in oklab, var(--accent-sage) 60%, transparent)",
                }}
              />
            )}
            <span className="relative">{t(`soundscape.${tr.id}`)}</span>
          </button>
        );
      })}
      <span
        className="ml-1 grid h-7 w-7 place-items-center rounded-full"
        style={{ color: "var(--ink-soft)" }}
        aria-hidden
      >
        {active ? (
          <Volume2 className="h-3.5 w-3.5" strokeWidth={1.6} />
        ) : (
          <VolumeX className="h-3.5 w-3.5" strokeWidth={1.6} />
        )}
      </span>
      <span className="sr-only" role="status" aria-live="polite">
        {active
          ? t("soundscape.playing", { track: t(`soundscape.${active}`) })
          : t("soundscape.off")}
      </span>
    </div>
  );
}
