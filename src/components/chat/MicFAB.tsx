/**
 * MicFAB — the single, beautiful microphone control inside Presence Mode.
 *
 * Five visual states that map 1:1 to the voice pipeline so the user always
 * knows what's happening:
 *
 *   idle        — large, calm, ready. Tap to start.
 *   listening   — soft pulsing halo (we're capturing audio + interim STT).
 *   processing  — spinning ring (Azure → Whisper fallback / LLM round-trip).
 *   speaking    — glowing ring synced to avatar talking.
 *   disabled    — greyed-out (no Azure key configured / mic permission denied).
 *
 * Design references (CITATIONS.md):
 *   - Inworld latency study — visual feedback < 100 ms from intent makes
 *     the user *believe* the system is fast even when audio takes longer.
 *   - Voice-First AI Mental Health Companion (IJERT 2024) — single, big,
 *     high-affordance mic > a row of small controls in a distress context.
 *   - JMIR ECA review — non-verbal feedback (visual presence cues) ↑
 *     perceived empathy.
 */

import { motion, useReducedMotion } from "framer-motion";
import { Mic, Loader2, Volume2, MicOff } from "lucide-react";

export type MicState =
    | "idle"
    | "listening"
    | "processing"
    | "speaking"
    | "disabled";

interface MicFABProps {
    state: MicState;
    /** Tap handler — start/stop recording. Ignored when state==='disabled'. */
    onTap: () => void;
    /** Optional label text shown beneath the FAB (e.g. "Listening…"). */
    label?: string;
}

const STATE_LABEL: Record<MicState, string> = {
    idle: "Tap to speak",
    listening: "Listening…",
    processing: "Thinking…",
    speaking: "Mitra is speaking",
    disabled: "Voice unavailable",
};

const MicFAB = ({ state, onTap, label }: MicFABProps) => {
    const isDisabled = state === "disabled";
    const displayLabel = label ?? STATE_LABEL[state];
    const reduceMotion = useReducedMotion();

    // Color tokens map cleanly onto the Sanctuary palette so the FAB
    // never looks foreign against the sage backdrop.
    const ringColor = {
        idle: "rgba(255,255,255,0.35)",
        listening: "rgba(186, 230, 211, 0.85)",   // mint-soft
        processing: "rgba(255,255,255,0.55)",
        speaking: "rgba(255, 220, 160, 0.85)",    // warm glow when speaking
        disabled: "rgba(255,255,255,0.2)",
    }[state];

    return (
        <div className="flex flex-col items-center gap-2.5 select-none">
            {/* Outer animated ring(s). Layered to give a multi-frequency
                pulse that reads as "alive" without being noisy. */}
            <button
                type="button"
                onClick={onTap}
                disabled={isDisabled}
                aria-label={displayLabel}
                aria-pressed={state === "listening"}
                className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed"
            >
                {/* Halo 1 — slow breathing (always present except disabled).
                    Suppressed entirely when prefers-reduced-motion is on,
                    leaving a single static ring so users sensitive to
                    motion still get a clear visual affordance. */}
                {state !== "disabled" && !reduceMotion && (
                    <motion.span
                        aria-hidden
                        className="absolute inset-0 rounded-full"
                        style={{ boxShadow: `0 0 0 0 ${ringColor}` }}
                        animate={{
                            boxShadow: [
                                `0 0 0 0 ${ringColor}`,
                                `0 0 0 18px ${ringColor.replace(/[\d.]+\)$/, "0)")}`,
                            ],
                        }}
                        transition={{
                            duration: state === "listening" ? 1.6 : 2.6,
                            repeat: Infinity,
                            ease: "easeOut",
                        }}
                    />
                )}
                {/* Halo 2 — faster pulse only while actively listening, to
                    distinguish from idle "alive" state. */}
                {state === "listening" && !reduceMotion && (
                    <motion.span
                        aria-hidden
                        className="absolute inset-0 rounded-full"
                        style={{ boxShadow: `0 0 0 0 ${ringColor}` }}
                        animate={{
                            boxShadow: [
                                `0 0 0 0 ${ringColor}`,
                                `0 0 0 32px ${ringColor.replace(/[\d.]+\)$/, "0)")}`,
                            ],
                        }}
                        transition={{
                            duration: 2.2,
                            repeat: Infinity,
                            ease: "easeOut",
                            delay: 0.4,
                        }}
                    />
                )}
                {/* Static ring fallback for reduced-motion users — ensures
                    the FAB still reads as "interactive / live". */}
                {state !== "disabled" && reduceMotion && (
                    <span
                        aria-hidden
                        className="absolute -inset-1.5 rounded-full ring-2 ring-white/25"
                    />
                )}

                {/* Inner solid disc — the actual button surface. */}
                <span
                    className={`absolute inset-0 rounded-full backdrop-blur-md ring-1 transition-colors duration-300 ${
                        state === "listening"
                            ? "bg-[hsl(var(--mint-400))]/85 ring-white/40"
                            : state === "speaking"
                            ? "bg-[hsl(var(--warmth-300))]/80 ring-white/35"
                            : state === "processing"
                            ? "bg-white/25 ring-white/30"
                            : isDisabled
                            ? "bg-white/10 ring-white/15"
                            : "bg-white/20 ring-white/30 hover:bg-white/30 active:bg-white/40"
                    }`}
                />

                {/* Icon. Loader spins for processing; volume animates for speaking. */}
                <span className="absolute inset-0 flex items-center justify-center text-white">
                    {state === "processing" ? (
                        <Loader2 className="h-7 w-7 sm:h-8 sm:w-8 animate-spin" />
                    ) : state === "speaking" ? (
                        <Volume2 className="h-7 w-7 sm:h-8 sm:w-8" />
                    ) : isDisabled ? (
                        <MicOff className="h-7 w-7 sm:h-8 sm:w-8 opacity-70" />
                    ) : (
                        <Mic className="h-7 w-7 sm:h-8 sm:w-8" />
                    )}
                </span>
            </button>

            <span
                className={`text-[12.5px] font-medium tracking-wide transition-colors ${
                    state === "listening"
                        ? "text-[hsl(var(--mint-400))]"
                        : state === "speaking"
                        ? "text-[hsl(var(--warmth-200))]"
                        : isDisabled
                        ? "text-white/40"
                        : "text-white/75"
                }`}
            >
                {displayLabel}
            </span>
        </div>
    );
};

export default MicFAB;
