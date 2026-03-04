/**
 * Act 0 — PatternInterrupt
 *
 * Full-screen black → breathing circle + "Breathe." →
 * warm glow + "You made it here." → gentle emphasis + "That matters." →
 * exit fade → onComplete
 *
 * Visual layers (full / standard tier):
 *  1. Breathing circle — concentric rings that expand/contract on the "Breathe" phase
 *  2. Soft radial glow that pulses behind each phrase
 *  3. Text entrance with scale + opacity + vertical slide
 *  4. Subtle particle dots drifting upward (full tier only)
 *
 * Lite tier: CSS opacity transitions only (no motion / no circles).
 *
 * All animations use transform + opacity only (GPU-safe, 60fps on budget Android).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ActSkip from './ActSkip';
import type { DeviceTier } from '@/hooks/useDeviceCapability';

interface PatternInterruptProps {
  onComplete: () => void;
  onSkip: () => void;
  tier: DeviceTier;
  language: 'en' | 'hi';
}

/* ── Phase content ─────────────────────────────────────────────────── */
const PHASES_EN = ['Breathe.', 'You made it here.', 'That matters.'];
const PHASES_HI = ['सांस लो.', 'तुम यहाँ आए.', 'यह मायने रखता है.'];

// How long each phase is displayed (ms) — generous time to let the visual breathe
const DISPLAY_MS = [3800, 2600, 2400];
// Extra pause before onComplete — allows the final fade-out to finish gracefully
const EXIT_MS = 900;

/* ── Breathing ring config ─────────────────────────────────────────── */
const RING_COUNT = 3;
const RING_COLORS = [
  'rgba(139,92,246,0.18)',   // violet-500
  'rgba(139,92,246,0.10)',   // violet-500 lighter
  'rgba(99,102,241,0.06)',   // indigo-500 barely visible
];

/* ── Floating particles (full tier only) ───────────────────────────── */
const PARTICLE_COUNT = 14;

function useParticles(tier: DeviceTier) {
  return useMemo(() => {
    if (tier !== 'full') return [];
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      left: `${8 + Math.random() * 84}%`,
      size: 2 + Math.random() * 3,
      delay: Math.random() * 4,
      duration: 5 + Math.random() * 6,
      opacity: 0.15 + Math.random() * 0.25,
    }));
  }, [tier]);
}

/* ── Component ─────────────────────────────────────────────────────── */
export default function PatternInterrupt({
  onComplete,
  onSkip,
  tier,
  language,
}: PatternInterruptProps) {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [exiting, setExiting] = useState(false);

  const phases = language === 'hi' ? PHASES_HI : PHASES_EN;
  const particles = useParticles(tier);

  /* ── Timer chain — drives phase transitions ──────────────────────── */
  useEffect(() => {
    let t = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    DISPLAY_MS.forEach((dur, i) => {
      t += dur;
      if (i < DISPLAY_MS.length - 1) {
        timers.push(setTimeout(() => setPhaseIdx(i + 1), t));
      }
    });

    timers.push(setTimeout(() => setExiting(true), t));
    timers.push(setTimeout(onComplete, t + EXIT_MS));

    return () => timers.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentText = phases[phaseIdx] ?? '';
  const isBreathPhase = phaseIdx === 0;

  /* ── Lite tier: simple CSS transitions ───────────────────────────── */
  if (tier === 'lite') {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <ActSkip onClick={onSkip} />
        <p
          className="text-white text-3xl font-light tracking-widest text-center transition-opacity duration-700 px-8 max-w-2xl"
          style={{ opacity: exiting || !currentText ? 0 : 1 }}
        >
          {currentText}
        </p>
      </div>
    );
  }

  /* ── Full / Standard tier ────────────────────────────────────────── */
  return (
    <motion.div
      className="fixed inset-0 bg-black flex items-center justify-center z-50 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <ActSkip onClick={onSkip} />

      {/* ── Background radial glow (always visible, pulses gently) ── */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          opacity: exiting ? 0 : [0.3, 0.55, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          background:
            'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(139,92,246,0.12) 0%, transparent 70%)',
        }}
      />

      {/* ── Breathing rings — only on phase 0 ("Breathe.") ────────── */}
      <AnimatePresence>
        {isBreathPhase && !exiting && (
          <>
            {Array.from({ length: RING_COUNT }, (_, i) => (
              <motion.div
                key={`ring-${i}`}
                className="absolute rounded-full pointer-events-none"
                style={{
                  border: `1.5px solid ${RING_COLORS[i]}`,
                  width: 120 + i * 80,
                  height: 120 + i * 80,
                }}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{
                  opacity: [0, 0.9, 0.9, 0],
                  scale: [0.7, 1, 1.15, 1.3],
                }}
                exit={{ opacity: 0, scale: 1.5 }}
                transition={{
                  duration: 3.4,
                  delay: i * 0.35,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* ── Central glow orb — visible during breath phase ────────── */}
      <AnimatePresence>
        {isBreathPhase && !exiting && (
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 90,
              height: 90,
              background:
                'radial-gradient(circle, rgba(139,92,246,0.35) 0%, rgba(139,92,246,0.08) 60%, transparent 100%)',
              filter: 'blur(8px)',
            }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{
              opacity: [0.4, 0.8, 0.4],
              scale: [0.8, 1.2, 0.8],
            }}
            exit={{ opacity: 0, scale: 0.3 }}
            transition={{
              duration: 3.4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Floating particles (full tier only) ───────────────────── */}
      {particles.map(p => (
        <motion.div
          key={`particle-${p.id}`}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: p.left,
            bottom: '-4%',
            width: p.size,
            height: p.size,
            background: 'rgba(196,181,253,0.6)',
          }}
          animate={{
            y: [0, -window.innerHeight * 1.1],
            opacity: exiting ? [p.opacity, 0] : [0, p.opacity, p.opacity, 0],
          }}
          transition={{
            y: {
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: 'linear',
            },
            opacity: {
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            },
          }}
        />
      ))}

      {/* ── Phase text ────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {!exiting && currentText && (
          <motion.div
            key={phaseIdx}
            className="relative z-10 flex flex-col items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            {/* Text glow backdrop (non-breath phases) */}
            {!isBreathPhase && (
              <motion.div
                className="absolute pointer-events-none"
                style={{
                  width: 220,
                  height: 220,
                  borderRadius: '50%',
                  background:
                    phaseIdx === 1
                      ? 'radial-gradient(circle, rgba(251,191,36,0.10) 0%, transparent 70%)'
                      : 'radial-gradient(circle, rgba(52,211,153,0.10) 0%, transparent 70%)',
                }}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
            )}

            <motion.p
              className="text-white font-light tracking-widest text-center px-8 max-w-2xl select-none"
              style={{
                fontSize: isBreathPhase ? 'clamp(2rem, 6vw, 3.5rem)' : 'clamp(1.5rem, 4.5vw, 2.5rem)',
                textShadow: isBreathPhase
                  ? '0 0 40px rgba(139,92,246,0.4), 0 0 80px rgba(139,92,246,0.15)'
                  : '0 0 30px rgba(255,255,255,0.08)',
              }}
              initial={{ opacity: 0, scale: 0.85, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                duration: isBreathPhase ? 1.0 : 0.7,
                ease: [0.22, 1, 0.36, 1], // custom easeOutQuint
              }}
            >
              {currentText}
            </motion.p>

            {/* Subtle underline flourish on "That matters." */}
            {phaseIdx === 2 && (
              <motion.div
                className="mt-4 h-px rounded-full"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgba(52,211,153,0.5), transparent)',
                }}
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 120, opacity: 1 }}
                transition={{ duration: 1.0, delay: 0.4, ease: 'easeOut' }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Final exit overlay fade to black ──────────────────────── */}
      <AnimatePresence>
        {exiting && (
          <motion.div
            className="absolute inset-0 bg-black pointer-events-none z-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, ease: 'easeInOut' }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
