import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { useAmbience } from "@/components/sanctuary/AmbienceProvider";
import {
    CALM_DEFAULT,
    ambientStyleForAffect,
    isCrisisActive,
    loadingCopyForMode,
    springForWarmth,
    type TurnMeta,
} from "@/lib/chat/turnPersonalization";

interface ChatPersonalization {
    /** Last turn's parsed meta, or null before any reply has landed. */
    turn: TurnMeta | null;
    /** True iff urgency >= 2 — every visual layer should yield. */
    crisisActive: boolean;
    /** Mode attribute for the chat root. Empty string on crisis. */
    dataMode: string;
    /** Inline CSS custom properties to spread onto the chat root. */
    rootStyle: CSSProperties;
    /** Framer-motion spring for message bubble entry. */
    messageSpring: ReturnType<typeof springForWarmth>;
    /** Mode-appropriate loading phrases for the typing indicator. */
    loadingPhases: string[];
    /** Time bucket inherited from the AmbienceProvider. */
    timeBucket: ReturnType<typeof useAmbience>["timeBucket"];
}

function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(() => {
        if (typeof window === "undefined" || !window.matchMedia) return false;
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    });

    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return;
        const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
        const onChange = () => setReduced(mql.matches);
        mql.addEventListener?.("change", onChange);
        return () => mql.removeEventListener?.("change", onChange);
    }, []);

    return reduced;
}

/**
 * Derive every personalization-driven value the chat surface needs from
 * the latest turn's meta + the sanctuary ambience context.
 *
 * Crisis-safe by construction: `parseTurnMeta` returns CALM_DEFAULT on
 * urgency >= 2; this hook then forces a neutral data-mode, a still
 * messageSpring, and a paper-warmth that doesn't pulse.
 *
 * Honors `prefers-reduced-motion` — the spring degrades to an instant
 * transition (stiffness very high, damping high) so framer-motion
 * effectively snaps to position.
 */
export function useChatPersonalization(turn: TurnMeta | null): ChatPersonalization {
    const ambience = useAmbience();
    const reducedMotion = usePrefersReducedMotion();

    return useMemo(() => {
        const active = turn ?? CALM_DEFAULT;
        const crisis = isCrisisActive(turn);

        const ambient = crisis
            ? { paperWarmth: 0.55, accentTilt: "neutral" as const }
            : ambientStyleForAffect(active.affect);

        // Combine sanctuary's time-of-day warmth with the per-turn affect
        // warmth — multiply so a "warm room" + "low arousal" pair amplifies
        // gently, and never exceeds 1.0.
        const composedWarmth = Math.min(
            1,
            (ambience.paperWarmth ?? 1) * ambient.paperWarmth,
        );

        const baseSpring = springForWarmth(active.tone.warmth);
        const messageSpring = reducedMotion
            ? { type: "spring" as const, stiffness: 1000, damping: 60, mass: 0.3 }
            : baseSpring;

        const rootStyle: CSSProperties = {
            // Consumed by the chat-personalization CSS layer in globals.css
            // for the AI bubble background, ambient overlay, and entry
            // transition timing.
            ["--mm-chat-warmth" as string]: composedWarmth.toFixed(3),
            ["--mm-chat-accent" as string]: ambience.sceneAccent,
            ["--mm-chat-warmth-tilt" as string]:
                ambient.accentTilt === "warm"
                    ? "1"
                    : ambient.accentTilt === "cool"
                      ? "-1"
                      : "0",
        };

        return {
            turn,
            crisisActive: crisis,
            dataMode: crisis ? "" : active.mode,
            rootStyle,
            messageSpring,
            loadingPhases: loadingCopyForMode(active.mode),
            timeBucket: ambience.timeBucket,
        };
    }, [turn, ambience, reducedMotion]);
}
