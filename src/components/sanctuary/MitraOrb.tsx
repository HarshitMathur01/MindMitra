import {
  motion,
  useMotionValue,
  useSpring,
  AnimatePresence,
} from "framer-motion";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAmbience } from "./AmbienceProvider";
import { usePersonality } from "@/hooks/usePersonality";
import { useSettings } from "@/hooks/useSettings";
import { pickOrbWhisper } from "@/data/orbWhispers";
import type { SupportedLanguage } from "@/lib/locale";

export function MitraOrb() {
  const { t } = useTranslation("sanctuary");
  const ambience = useAmbience();
  const { personality, companionName } = usePersonality();
  const { settings } = useSettings();
  const language = (settings?.language as SupportedLanguage) ?? "english";

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 40, damping: 18, mass: 0.8 });
  const sy = useSpring(y, { stiffness: 40, damping: 18, mass: 0.8 });
  const [whisper, setWhisper] = useState<string | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const cx = window.innerWidth - 80;
      const cy = window.innerHeight - 80;
      x.set((e.clientX - cx) * 0.06);
      y.set((e.clientY - cy) * 0.06);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [x, y]);

  useEffect(() => {
    if (!whisper) return;
    const t = setTimeout(() => setWhisper(null), 5000);
    return () => clearTimeout(t);
  }, [whisper]);

  const onClick = () => {
    setWhisper(
      pickOrbWhisper({
        personality: personality.id,
        language,
        timeBucket: ambience.timeBucket,
        valenceBucket: ambience.valenceBucket,
        crisisQuiet: ambience.crisisQuiet,
      }),
    );
  };

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-40 hidden md:block">
      <motion.button
        type="button"
        aria-label={t("orb.aria", { companion: companionName })}
        onClick={onClick}
        style={{ x: sx, y: sy }}
        className="pointer-events-auto relative grid h-16 w-16 place-items-center rounded-full"
      >
        <motion.span
          aria-hidden
          animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0.75, 0.5] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full"
          style={{
            background: ambience.orbHalo,
            filter: "blur(2px)",
          }}
        />
        <motion.div
          aria-hidden
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-3 overflow-hidden rounded-full"
        >
          {/* Static orb art (was a TalkingHead iframe: ~1.2 MB of CDN
              three.js plus a 60 MB GLB for a 64 px decoration). This is the
              same gradient that shipped as the iframe's designed fallback. */}
          <span
            aria-hidden
            className="block h-full w-full rounded-full"
            style={{
              background:
                "radial-gradient(circle at 30% 25%, var(--paper), color-mix(in oklab, var(--accent-sky) 30%, var(--paper-soft)))",
              boxShadow:
                "0 10px 30px -10px color-mix(in oklab, var(--ink) 40%, transparent), inset 0 0 18px color-mix(in oklab, var(--accent-sage) 30%, transparent)",
            }}
          />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {whisper && (
          <motion.div
            key={whisper}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pointer-events-auto absolute bottom-20 right-0 max-w-[16rem] rounded-2xl border px-4 py-3 text-sm italic shadow-lg"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--paper)",
              color: "var(--ink)",
              fontFamily: "var(--font-serif)",
            }}
          >
            {whisper}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
