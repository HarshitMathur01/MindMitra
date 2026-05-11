import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { SurfaceTone } from "@/lib/mindgym/theme";

interface ParticleFieldProps {
  count?: number;
  tone: SurfaceTone;
  // 'ambient' = gentle in-place drift (used in tool practice).
  // 'rising'  = upward drift (used in game shell).
  motion?: "ambient" | "rising";
  // Show the soft radial glow overlay (warm tool surfaces use it).
  showGlow?: boolean;
  className?: string;
}

interface Mote {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

function buildMotes(count: number): Mote[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 1,
    duration: Math.random() * 22 + 18,
    delay: Math.random() * 14,
    opacity: Math.random() * 0.2 + 0.06,
  }));
}

export default function ParticleField({
  count = 24,
  tone,
  motion: motionStyle = "ambient",
  showGlow,
  className,
}: ParticleFieldProps) {
  const reduceMotion = useReducedMotion();
  const motes = useMemo(() => buildMotes(count), [count]);

  const dotClass =
    tone === "warm"
      ? "absolute rounded-full bg-emerald-200/55 blur-[1px]"
      : "absolute rounded-full bg-white blur-[1px]";

  const glowClass =
    tone === "warm"
      ? "absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.78)_0%,rgba(255,255,255,0)_60%)] pointer-events-none"
      : "absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.02)_0%,rgba(0,0,0,0)_60%)] pointer-events-none";

  const resolvedGlow = showGlow ?? motionStyle === "ambient";

  return (
    <div
      className={`absolute inset-0 z-0 pointer-events-none overflow-hidden ${className ?? ""}`}
    >
      {motes.map((p) => {
        const animate = reduceMotion
          ? { opacity: p.opacity }
          : motionStyle === "rising"
            ? {
                y: [0, -40, -80, -120],
                x: p.id % 2 === 0 ? [0, 10, -10, 0] : [0, -15, 15, 0],
                opacity: [0, p.opacity, p.opacity, 0],
              }
            : {
                y: [0, -36, 18, 0],
                x: [0, 18, -12, 0],
                opacity: [p.opacity, p.opacity * 1.25, p.opacity],
              };

        const transition = reduceMotion
          ? { duration: 0 }
          : {
              duration:
                motionStyle === "rising" ? p.duration : p.duration * 2.4,
              repeat: Infinity,
              ease: motionStyle === "rising" ? "linear" : "easeInOut",
              delay: p.delay,
            };

        return (
          <motion.div
            key={p.id}
            className={dotClass}
            style={{
              width: p.size,
              height: p.size,
              left: `${p.x}%`,
              top: `${p.y}%`,
              opacity: motionStyle === "rising" ? p.opacity : undefined,
            }}
            animate={animate}
            transition={transition}
          />
        );
      })}
      {resolvedGlow && <div className={glowClass} />}
    </div>
  );
}
