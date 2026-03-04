/**
 * AmbientSound — opt-in background ambient sound during onboarding.
 *
 * Rules:
 *  - Full tier ONLY (no standard/lite)
 *  - Default OFF — user must explicitly enable via the subtle toggle
 *  - Uses Web Audio API with an <audio> element for seamless looping
 *  - Fade-in on enable, fade-out on disable or unmount
 *  - Headphones hint shown on first enable
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { DeviceTier } from '@/hooks/useDeviceCapability';

interface AmbientSoundProps {
    /** Only renders for 'full' tier */
    tier: DeviceTier;
    /** Ambient sound source — defaults to a gentle rain loop in /public/sounds/ */
    src?: string;
}

const DEFAULT_SRC = '/sounds/ambient-rain.mp3';
const FADE_MS = 800;
const MAX_VOLUME = 0.18; // subtle background level

export default function AmbientSound({ tier, src = DEFAULT_SRC }: AmbientSoundProps) {
    const [enabled, setEnabled] = useState(false);
    const [showHint, setShowHint] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const fadeRef = useRef<number | null>(null);

    // ── Fade helpers ─────────────────────────────────────────────────────
    const fadeIn = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.volume = 0;
        audio.play().catch(() => { }); // silenced autoplay error

        const steps = FADE_MS / 20;
        const increment = MAX_VOLUME / steps;
        let step = 0;

        if (fadeRef.current) cancelAnimationFrame(fadeRef.current);

        const tick = () => {
            step++;
            audio.volume = Math.min(step * increment, MAX_VOLUME);
            if (step < steps) {
                fadeRef.current = requestAnimationFrame(tick);
            }
        };
        fadeRef.current = requestAnimationFrame(tick);
    }, []);

    const fadeOut = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const startVol = audio.volume;
        const steps = FADE_MS / 20;
        const decrement = startVol / steps;
        let step = 0;

        if (fadeRef.current) cancelAnimationFrame(fadeRef.current);

        const tick = () => {
            step++;
            audio.volume = Math.max(startVol - step * decrement, 0);
            if (step < steps) {
                fadeRef.current = requestAnimationFrame(tick);
            } else {
                audio.pause();
            }
        };
        fadeRef.current = requestAnimationFrame(tick);
    }, []);

    // ── Toggle handler ───────────────────────────────────────────────────
    const handleToggle = useCallback(() => {
        setEnabled(prev => {
            const next = !prev;
            if (next) {
                fadeIn();
                setShowHint(true);
                setTimeout(() => setShowHint(false), 3500);
            } else {
                fadeOut();
            }
            return next;
        });
    }, [fadeIn, fadeOut]);

    // ── Cleanup on unmount ───────────────────────────────────────────────
    useEffect(() => {
        const currentAudio = audioRef.current;
        const currentFade = fadeRef.current;
        return () => {
            if (currentFade) cancelAnimationFrame(currentFade);
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.volume = 0;
            }
        };
    }, []);

    // ── Only render for full tier (after all hooks) ──────────────────────
    if (tier !== 'full') return null;

    return (
        <div className="fixed bottom-6 left-6 z-[110] flex flex-col items-start gap-2">
            {/* Headphones hint */}
            <AnimatePresence>
                {showHint && (
                    <motion.div
                        className="bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white/50 text-xs shadow-lg"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.25 }}
                    >
                        🎧 Best with headphones
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toggle button */}
            <button
                onClick={handleToggle}
                className="group flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors backdrop-blur-sm"
                style={{
                    background: enabled ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${enabled ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.08)'}`,
                }}
                aria-label={enabled ? 'Disable ambient sound' : 'Enable ambient sound'}
            >
                {/* Sound wave icon */}
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="flex-shrink-0"
                    style={{ opacity: enabled ? 1 : 0.4 }}
                >
                    <rect x="1" y="6" width="2" height="4" rx="1" fill="currentColor" className="text-violet-400" />
                    <rect x="4.5" y="4" width="2" height="8" rx="1" fill="currentColor" className="text-violet-400" />
                    <rect x="8" y="2.5" width="2" height="11" rx="1" fill="currentColor" className="text-violet-400" />
                    <rect x="11.5" y="5" width="2" height="6" rx="1" fill="currentColor" className="text-violet-400" />
                </svg>

                <span
                    className="text-xs transition-colors"
                    style={{ color: enabled ? 'rgba(196,181,253,0.8)' : 'rgba(255,255,255,0.3)' }}
                >
                    {enabled ? 'Sound on' : 'Ambient'}
                </span>
            </button>

            {/* Hidden audio element */}
            <audio
                ref={audioRef}
                src={src}
                loop
                preload="none"
                style={{ display: 'none' }}
            />
        </div>
    );
}
