/**
 * PresenceModeAnam — full-screen voice + Anam AI avatar surface.
 *
 * Replaces PresenceMode.tsx (which used TalkingHeadAvatar / iframe).
 * Layout, transitions, MicFAB, subtitles, safety overlay, and ESC-to-exit
 * are all preserved from the original. Only the avatar component changes
 * (AnamAvatar instead of TalkingHeadAvatar).
 *
 * Design references from the original PresenceMode are honoured:
 *   - JMIR (2025) — full-screen mount rather than windowed avatar
 *   - Stanley-Brown SPI — exit ≤ 1 tap, safety overlay always reachable
 *   - WCAG — subtitles for accessibility / hearing-impaired users
 *   - Reduced-motion respected (no large entry animation if opted out)
 *
 * Architectural rules (same as original):
 *   1. Single AnamAvatar instance — ChatGPTInterface suppresses its
 *      half-pane when Presence Mode is active.
 *   2. ESC closes the overlay.
 *   3. Body scroll locked while open.
 */

import { useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, Keyboard } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { CHAT_MESSAGE_SPRING } from "./chatConstants";
import AnamAvatar from "./AnamAvatar";
import MicFAB, { type MicState } from "./MicFAB";
import TypewriterText from "./TypewriterText";
import PresenceSafetyOverlay from "./PresenceSafetyOverlay";
import { useLocalizedT } from "@/hooks/useLocalizedT";

interface PresenceModeAnamProps {
    /** Live mic state — drives MicFAB visuals. */
    micState: MicState;
    /** Tap handler — start/stop voice capture. */
    onMicTap: () => void;
    /** Live interim transcript (string while user is speaking). */
    interimTranscript?: string;
    /**
     * Anam pipeline mode only: called with (userText, agentText) on each
     * completed turn from MESSAGE_HISTORY_UPDATED. Forwarded to AnamAvatar.
     */
    onAnamTurn?: (userText: string, agentText: string) => void;
    /** Backend session id, so crisis screening shares the chat's Redis session. */
    sessionId?: string | null;
    /** Anam pipeline mode only: crisis interceptor tripped. Forwarded to AnamAvatar. */
    onCrisis?: (content: string, crisisNumbers: string[]) => void;
    /** BCP-47 tag for what Anam should expect to hear. Forwarded to AnamAvatar. */
    language?: string;
}

const PresenceModeAnam = ({
    micState,
    onMicTap,
    interimTranscript,
    onAnamTurn,
    sessionId,
    onCrisis,
    language,
}: PresenceModeAnamProps) => {
    const {
        isPresenceMode,
        exitPresenceMode,
        message: avatarCurrentMessage,
    } = useChat();
    const reduceMotion = useReducedMotion();
    const { t } = useLocalizedT();

    const isSpeaking = micState === "speaking" && Boolean(avatarCurrentMessage?.text);

    // Lock body scroll + ESC-to-exit while presence mode is open.
    useEffect(() => {
        if (!isPresenceMode) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") exitPresenceMode();
        };
        window.addEventListener("keydown", onKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [isPresenceMode, exitPresenceMode]);

    return (
        <AnimatePresence>
            {isPresenceMode && (
                <motion.div
                    key="presence-mode-anam"
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.02 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
                    transition={CHAT_MESSAGE_SPRING}
                    className="fixed inset-0 z-50 overflow-hidden"
                    role="dialog"
                    aria-modal="true"
                    aria-label={t("chat.presence.rootAria", "Presence Mode — voice conversation with Mitra")}
                >
                    {/* Calming sage gradient backdrop — same as original PresenceMode */}
                    <div
                        aria-hidden
                        className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--accent-700))] via-[hsl(var(--accent-600))] to-[hsl(var(--ink-9))]"
                    />
                    {/* Vignette to focus attention on the avatar */}
                    <div
                        aria-hidden
                        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_40%,_rgba(0,0,0,0.55)_100%)]"
                    />

                    {/* Top control bar — exit + mode label */}
                    <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 sm:px-6 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex h-2 w-2 rounded-full bg-[hsl(var(--accent-300))] animate-pulse" />
                            <span className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/85">
                                Presence
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={exitPresenceMode}
                            className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-3 py-1.5 text-[13px] font-medium text-white hover:bg-white/15 active:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
                            aria-label={t("chat.presence.exitAria", "Exit Presence Mode")}
                        >
                            <X className="h-4 w-4" />
                            <span className="hidden sm:inline">Exit</span>
                        </button>
                    </div>

                    {/* Anam avatar stage — fills the overlay, transparent bg so
                        the gradient shows through behind the avatar video.
                        Placement now lives inside AnamAvatar, which locks the video
                        box to the stream's own ratio: on a laptop the overlay is
                        landscape, and centre-cropping a portrait stream into it was
                        cutting the persona's head off. `bottom-mobile` preserves the
                        original bottom-anchored framing on phones. */}
                    <div className="absolute inset-0 z-10">
                        <div className="relative h-full w-full">
                            <AnamAvatar
                                hideChrome
                                transparentBackground
                                stageAlign="bottom-mobile"
                                onAnamTurn={onAnamTurn}
                                sessionId={sessionId}
                                onCrisis={onCrisis}
                                language={language}
                            />
                        </div>
                    </div>

                    {/* Bottom dock — subtitle + MicFAB */}
                    <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center gap-3 px-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-6">
                        <AnimatePresence mode="wait">
                            {isSpeaking ? (
                                <motion.div
                                    key="subtitle"
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.2 }}
                                    className="max-w-[min(38rem,92vw)] rounded-2xl bg-black/35 backdrop-blur px-4 py-2.5 text-center shadow-sm"
                                    aria-live="polite"
                                    aria-atomic="false"
                                >
                                    <TypewriterText
                                        text={avatarCurrentMessage!.text}
                                        speed={120}
                                        maxVisibleWords={18}
                                        className="text-white/95 text-[14.5px] leading-snug font-medium"
                                    />
                                </motion.div>
                            ) : micState === "listening" && interimTranscript ? (
                                <motion.p
                                    key="interim"
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.18 }}
                                    className="max-w-[min(34rem,90vw)] rounded-2xl bg-white/12 backdrop-blur px-4 py-2 text-center text-[14px] leading-snug text-white/95 shadow-sm"
                                    aria-live="polite"
                                    aria-atomic="false"
                                >
                                    {interimTranscript}
                                </motion.p>
                            ) : null}
                        </AnimatePresence>
                        <MicFAB state={micState} onTap={onMicTap} />

                        {/* "Type instead" — exit voice, return to text chat */}
                        <button
                            type="button"
                            onClick={exitPresenceMode}
                            className="inline-flex items-center gap-1.5 rounded-full text-[12.5px] font-medium text-white/60 hover:text-white/90 transition-colors px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                            aria-label={t("chat.presence.typeInsteadAria", "Type instead — return to text chat")}
                        >
                            <Keyboard className="h-3.5 w-3.5" />
                            Type instead
                        </button>
                    </div>

                    {/* Safety overlay — always one tap away (Stanley-Brown SPI) */}
                    <PresenceSafetyOverlay />
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default PresenceModeAnam;
