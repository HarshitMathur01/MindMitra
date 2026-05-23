import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Quote } from "lucide-react";

const WHISPERS = [
  { text: "i kept the lamp on tonight. small, but mine.", tag: "from a peer · 19" },
  { text: "told my sister i'm tired. she just sat with me.", tag: "from a peer · 22" },
  { text: "didn't open the app for a week. came back anyway.", tag: "from a peer · 24" },
  { text: "the panic passed. it always does. i forget that.", tag: "from a peer · 17" },
  { text: "ate something warm before replying to the email.", tag: "from a peer · 26" },
];

export function WhisperWall() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % WHISPERS.length), 5500);
    return () => clearInterval(t);
  }, []);

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
            whisper wall · anonymous · moderated
          </p>
          <span className="flex items-center gap-1.5">
            {WHISPERS.map((_, idx) => (
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
              key={i}
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
                "{WHISPERS[i].text}"
              </p>
              <p
                className="mt-3 text-[0.7rem] uppercase tracking-[0.3em]"
                style={{ color: "var(--ink-faint)" }}
              >
                {WHISPERS[i].tag}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
