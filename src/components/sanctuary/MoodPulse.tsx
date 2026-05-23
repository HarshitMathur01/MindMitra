import { useState } from "react";
import { motion } from "framer-motion";

const LABELS = ["heavy", "low", "okay", "lifting", "bright"] as const;
const COLORS = [
  "oklch(0.55 0.05 280)",
  "oklch(0.65 0.06 240)",
  "oklch(0.78 0.04 95)",
  "oklch(0.78 0.10 130)",
  "oklch(0.82 0.13 70)",
];

export function MoodPulse() {
  const [picked, setPicked] = useState<number | null>(null);

  return (
    <div className="flex flex-col items-start gap-3">
      <p
        className="text-[0.7rem] uppercase tracking-[0.35em]"
        style={{ color: "var(--ink-faint)", fontFamily: "var(--font-sans)" }}
      >
        how's the weather, inside?
      </p>
      <div className="flex items-center gap-3">
        {LABELS.map((label, i) => {
          const active = picked === i;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setPicked(i)}
              aria-label={`Mood: ${label}`}
              aria-pressed={active}
              className="group relative grid place-items-center outline-none"
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
                {label}
              </span>
            </button>
          );
        })}
        {picked !== null && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className="ml-3 text-xs italic"
            style={{ color: "var(--ink-soft)", fontFamily: "var(--font-serif)" }}
          >
            logged · {LABELS[picked]}
          </motion.span>
        )}
      </div>
    </div>
  );
}
