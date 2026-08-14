import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useBridge } from "./BridgeContext";

// smooth sinusoidal ease-in-out for seamless mirrored loops
const sine: [number, number, number, number] = [0.45, 0, 0.55, 1];

/**
 * Layered organic depth: a soft breathing "listener" halo, a central textured
 * form, and floating accent stones. Parallax follows the pointer gently; 
 * everything settles into a static composition when the user prefers reduced motion.
 */
export function LivingForm({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const { mood } = useBridge();
  const ref = useRef<HTMLDivElement>(null);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const spring = { stiffness: 28, damping: 26, mass: 1.1, restDelta: 0.0001 };
  const sx = useSpring(mx, spring);
  const sy = useSpring(my, spring);

  const useLayer = (depth: number) => ({
    x: useTransform(sx, (v) => v * depth),
    y: useTransform(sy, (v) => v * depth),
  });

  const core = useLayer(10);
  const halo = useLayer(4);
  const stoneA = useLayer(22);
  const stoneB = useLayer(-16);

  const slow = reduced ? 0 : 1;
  const tempo = 1 / (0.55 + mood.tempo * 0.65);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={className}
      onPointerMove={(e) => {
        if (reduced) return;
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => {
        mx.set(0);
        my.set(0);
      }}
    >
      <div className="relative h-full w-full">
        {/* ambient glow */}
        <div
          className="absolute -inset-[12%] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(60% 60% at 35% 30%, color-mix(in oklab, var(--sage) 42%, transparent), transparent 70%), radial-gradient(55% 55% at 75% 75%, color-mix(in oklab, var(--peach) 34%, transparent), transparent 70%)",
            opacity: 0.75 + mood.warmth * 0.2,
          }}
        />

        {/* breathing listener halo */}
        <motion.div
          style={{ ...halo, borderRadius: "40% 60% 70% 30% / 40% 50% 60% 50%", willChange: "transform, opacity" }}
          className="absolute left-1/2 top-1/2 h-[80%] w-[80%] -translate-x-1/2 -translate-y-1/2 bg-sage/35 blur-md"
          animate={reduced ? {} : { scale: 1.05, opacity: 0.72 }}
          initial={reduced ? false : { scale: 1, opacity: 0.5 }}
          transition={{ duration: 7 * tempo, repeat: Infinity, repeatType: "mirror", ease: sine }}
        />

        {/* central textured form */}
        <motion.div
          style={{ ...core, willChange: "transform" }}
          className="absolute left-1/2 top-1/2 h-[64%] w-[64%] -translate-x-1/2 -translate-y-1/2"
          initial={reduced ? false : { rotate: -2.5, scale: 1 }}
          animate={reduced ? {} : { rotate: 2.5, scale: 1.02 }}
          transition={{ duration: 14 * tempo, repeat: Infinity, repeatType: "mirror", ease: sine }}
        >
          <div
            className="relative h-full w-full overflow-hidden shadow-2xl"
            style={{
              borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%",
              background:
                "linear-gradient(150deg, color-mix(in oklab, var(--moss) 88%, white 12%), var(--primary) 62%, color-mix(in oklab, var(--primary) 82%, black 18%))",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/25 to-transparent opacity-50" />
            <div className="paper-grain absolute inset-0 opacity-40" />
            <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
              <path d="M0,110 C30,155 80,55 200,105 L200,200 L0,200 Z" fill="var(--parchment)" opacity="0.1" />
              <path d="M0,140 C40,175 90,95 200,140 L200,200 L0,200 Z" fill="var(--parchment)" opacity="0.08" />
            </svg>
            {/* soft inner light that drifts */}
            <motion.div
              className="absolute left-[22%] top-[18%] h-24 w-24 rounded-full bg-white/25 blur-2xl"
              style={{ willChange: "transform, opacity" }}
              initial={reduced ? false : { x: 0, y: 0, opacity: 0.5 }}
              animate={reduced ? {} : { x: 22, y: 16, opacity: 0.85 }}
              transition={{ duration: 9 * tempo, repeat: Infinity, repeatType: "mirror", ease: sine }}
            />
          </div>
        </motion.div>

        {/* floating accent stones */}
        <motion.div
          style={{ ...stoneA, willChange: "transform" }}
          className="absolute right-[8%] top-[12%] h-20 w-20 rounded-full bg-clay/70 shadow-lg mix-blend-multiply blur-[1px] sm:h-24 sm:w-24"
          initial={reduced ? false : { y: 0 }}
          animate={reduced ? {} : { y: -14 }}
          transition={{ duration: 6 * tempo, repeat: Infinity, repeatType: "mirror", ease: sine }}
        />
        <motion.div
          style={{ ...stoneB, willChange: "transform" }}
          className="absolute bottom-[12%] left-[4%] h-24 w-24 rounded-full bg-sage/70 shadow-xl mix-blend-multiply sm:h-32 sm:w-32"
          initial={reduced ? false : { scale: 1, y: 0 }}
          animate={reduced ? {} : { scale: 1.07, y: 10 }}
          transition={{ duration: 8 * tempo, repeat: Infinity, repeatType: "mirror", ease: sine }}
        />
      </div>
    </div>
  );
}
