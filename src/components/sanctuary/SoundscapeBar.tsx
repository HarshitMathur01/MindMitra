import { useState } from "react";
import { motion } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";

const TRACKS = [
  { id: "rain", label: "rain", glyph: "◌" },
  { id: "cafe", label: "cafe", glyph: "◍" },
  { id: "tanpura", label: "tanpura", glyph: "◎" },
] as const;

export function SoundscapeBar() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <div
      className="mx-auto mt-2 flex w-fit items-center gap-1 rounded-full border px-2 py-1.5 backdrop-blur"
      style={{
        borderColor: "var(--border)",
        backgroundColor: "color-mix(in oklab, var(--paper) 80%, transparent)",
      }}
    >
      <span
        className="px-2 text-[0.6rem] uppercase tracking-[0.35em]"
        style={{ color: "var(--ink-faint)" }}
      >
        soundscape
      </span>
      {TRACKS.map((t) => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(on ? null : t.id)}
            aria-pressed={on}
            className="relative grid place-items-center rounded-full px-3 py-1 text-xs transition-colors"
            style={{
              color: on ? "var(--paper)" : "var(--ink-soft)",
              backgroundColor: on ? "var(--ink)" : "transparent",
              fontFamily: "var(--font-sans)",
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
            <span className="relative">{t.label}</span>
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
    </div>
  );
}
