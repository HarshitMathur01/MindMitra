import { motion } from "framer-motion";
import ForestBackdrop from "./ForestBackdrop";

interface MindGymLandingProps {
  onEnter: () => void;
}

// A handful of slow, softly drifting motes. Deterministic positions keep the
// scene stable across renders; animation happens in-place with framer-motion.
const MOTES = [
  { left: "12%", top: "28%", size: 4, delay: 0, duration: 9 },
  { left: "22%", top: "64%", size: 3, delay: 1.6, duration: 11 },
  { left: "38%", top: "18%", size: 2, delay: 0.8, duration: 8 },
  { left: "58%", top: "72%", size: 3, delay: 2.4, duration: 10 },
  { left: "72%", top: "32%", size: 4, delay: 0.4, duration: 12 },
  { left: "84%", top: "58%", size: 2, delay: 1.2, duration: 9 },
  { left: "46%", top: "84%", size: 3, delay: 2.0, duration: 11 },
];

export default function MindGymLanding({ onEnter }: MindGymLandingProps) {
  return (
    <div className="mindgym-root relative isolate min-h-screen overflow-hidden">
      <ForestBackdrop variant="full" />

      {/* Slow-drifting motes for a living, breathing scene */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-[1]">
        {MOTES.map((m, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full bg-[#fff4d6]"
            style={{
              left: m.left,
              top: m.top,
              width: m.size,
              height: m.size,
              filter: "blur(0.5px)",
              boxShadow: "0 0 8px rgba(255, 236, 190, 0.55)",
            }}
            initial={{ opacity: 0, y: 0 }}
            animate={{
              opacity: [0, 0.75, 0.75, 0],
              y: [0, -18, -28, -40],
            }}
            transition={{
              duration: m.duration,
              delay: m.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Soft vignette to draw the eye inward */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(40,28,18,0.18) 100%)",
        }}
      />

      <div className="relative z-10 flex min-h-screen flex-col">
        <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="text-[11px] font-medium uppercase tracking-[0.38em] text-[#9a4a2a]"
          >
            A quiet place
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="mt-5 font-serif-display text-[clamp(3.25rem,9vw,6.75rem)] font-light leading-[0.95] tracking-tight text-[#2a1c14]"
          >
            Mind Gym
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 1.0, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="mt-7 h-px w-16 origin-center bg-gradient-to-r from-transparent via-[#b08a6a] to-transparent"
          />

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="mt-7 max-w-[22rem] text-[15.5px] leading-[1.75] text-[#5b4a3e]"
          >
            Small practices for slow moments.
            <br />
            No scores. No pressure. Just space.
          </motion.p>

          {/* Breathing button — a gentle pulse invites without rushing. */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="relative mt-12"
          >
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full bg-[#fbf7ee]"
              animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.button
              type="button"
              onClick={onEnter}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="relative inline-flex items-center justify-center rounded-full bg-[#fbf7ee] px-9 py-3.5 text-[14px] font-medium tracking-wide text-[#2a1c14] shadow-[0_6px_20px_rgba(42,28,20,0.10)] ring-1 ring-black/5 transition-shadow hover:shadow-[0_10px_28px_rgba(42,28,20,0.16)]"
            >
              Step inside
            </motion.button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            transition={{ duration: 1.2, delay: 1.1 }}
            className="mt-6 text-[11px] tracking-[0.22em] text-[#8a6f5c]"
          >
            TAKE A BREATH FIRST
          </motion.p>
        </main>

        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.1, delay: 0.9 }}
          className="pb-10 text-center"
        >
          <p className="font-serif-display text-[14px] italic text-[#7a6556]">
            Take what you need. Leave the rest.
          </p>
        </motion.footer>
      </div>
    </div>
  );
}
