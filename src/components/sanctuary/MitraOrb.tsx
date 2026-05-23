import { motion, useMotionValue, useSpring, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import Buddy from "@/components/mindgym/shared/Buddy";

const WHISPERS = [
  "one breath. that's enough for now.",
  "you don't have to solve it tonight.",
  "the loop is loud — you are not the loop.",
  "soft is also a kind of strong.",
  "name one thing in the room. begin there.",
];

export function MitraOrb() {
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

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-40 hidden md:block">
      <motion.button
        type="button"
        aria-label="A small whisper from Mitra"
        onClick={() =>
          setWhisper(WHISPERS[Math.floor(Math.random() * WHISPERS.length)])
        }
        style={{ x: sx, y: sy }}
        className="pointer-events-auto relative grid h-16 w-16 place-items-center rounded-full"
      >
        <motion.span
          aria-hidden
          animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0.75, 0.5] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 35% 30%, color-mix(in oklab, var(--accent-sage) 70%, transparent), transparent 70%)",
            filter: "blur(2px)",
          }}
        />
        <motion.div
          aria-hidden
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-3 overflow-hidden rounded-full"
        >
          <Buddy
            avatar="/talkinghead/avatars/Little_kid_4.glb"

            cameraView="full"
            className="pointer-events-none h-full w-full"
            fallback={
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
            }
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
