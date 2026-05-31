/**
 * PresenceMode — full-screen voice + face surface for the MindMitra companion.
 *
 * This is the **Phase 1 skeleton**: it owns the full-viewport overlay,
 * mounts the existing TalkingHeadAvatar inside a calm bust-shot frame,
 * and provides a clean entry/exit transition. Mic, VAD, subtitles,
 * sentence-streaming, emotion indicators, PiP, and safety overlay are
 * added in Phases 2-4 (tracked in docs/research/CITATIONS.md and the in-repo plan).
 *
 * Design references applied here (see docs/research/CITATIONS.md):
 *   - JMIR (2025) PMC12007843 — animation features ↑ trust → invest in
 *     a clean full-screen mount rather than a windowed avatar.
 *   - JMIR Scoping Review 2017 — face-to-face activation of social
 *     cognition; presence must feel intentional, not modal-noise.
 *   - Stanley-Brown SPI — exit + crisis access must be ≤ 1 tap.
 *
 * Architectural rules:
 *   1. Single TalkingHeadAvatar instance. When `isPresenceMode` is true,
 *      ChatGPTInterface suppresses the half-pane mount so we never
 *      render two iframes (which would compete for mic + audio).
 *   2. ESC closes — keyboard-first accessibility.
 *   3. Body scroll is locked while open to keep the experience immersive.
 *   4. Reduced-motion respected (no large entry animation if user opted out).
 */

import { useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, Keyboard } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { CHAT_MESSAGE_SPRING } from "./chatConstants";
import TalkingHeadAvatar from "./TalkingHeadAvatar";
import MicFAB, { type MicState } from "./MicFAB";
import TypewriterText from "./TypewriterText";
import PresenceSafetyOverlay from "./PresenceSafetyOverlay";
import { useLocalizedT } from "@/hooks/useLocalizedT";

interface PresenceModeProps {
    /** GLB avatar URL to render. */
    avatarUrl: string;
    /** Azure / Google TTS language tag, e.g. "en-IN", "hi-IN". */
    ttsLang: string;
    /** Voice name passed to TalkingHeadAvatar. */
    ttsVoice: string;
    /** Live mic state — drives MicFAB visuals. */
    micState: MicState;
    /** Tap handler — start/stop voice capture. */
    onMicTap: () => void;
    /** Live interim transcript (string while user is speaking). */
    interimTranscript?: string;
}

const PresenceMode = ({
    avatarUrl,
    ttsLang,
    ttsVoice,
    micState,
    onMicTap,
    interimTranscript,
}: PresenceModeProps) => {
    const {
        isPresenceMode,
        exitPresenceMode,
        message: avatarCurrentMessage,
    } = useChat();
    const reduceMotion = useReducedMotion();
    const { t } = useLocalizedT();
    const isSpeaking = micState === "speaking" && Boolean(avatarCurrentMessage?.text);
    const avatarCameraView = "upper";
    // Namaste greeting on Presence-Mode entry — Olaf only. Maps to the
    // product's "session start" beat and uses the existing TalkingHead
    // built-in `namaste` gesture template (both-hands symmetric, so it
    // reads cleanly on Olaf's shoulderless rig).
    const greetingGesture = /\/Olaf\.glb(?:$|\?)/i.test(avatarUrl) ? "namaste" : undefined;

    // Lock body scroll + ESC-to-exit while presence mode is open.
    // We do this in a single effect so the cleanup pairs with the
    // setup deterministically when the overlay unmounts.
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
                    key="presence-mode"
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.02 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
                    transition={CHAT_MESSAGE_SPRING}
                    className="fixed inset-0 z-50 overflow-hidden"
                    role="dialog"
                    aria-modal="true"
                    aria-label={t("chat.presence.rootAria", "Presence Mode — voice conversation with Mitra")}
                >
                    {/* Calming sage gradient backdrop. Avoids stark black, which
                        clinical UX research (JMIR ECA review) flags as
                        emotionally cold for distressed users. Uses Sanctuary v4
                        deep-sage + ink-9 (deepest charcoal) tokens. */}
                    <div
                        aria-hidden
                        className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--accent-700))] via-[hsl(var(--accent-600))] to-[hsl(var(--ink-9))]"
                    />
                    {/* Subtle vignette to focus attention on the avatar bust. */}
                    <div
                        aria-hidden
                        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_40%,_rgba(0,0,0,0.55)_100%)]"
                    />

                    {/* Top control bar — exit + mode label. Kept minimal so
                        nothing competes with the face. */}
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

                    {/* Avatar stage. Sits above the gradient, below the
                        controls. The TalkingHeadAvatar iframe handles its
                        own layout — we give it a centered viewport-sized
                        canvas and let it fill.

                        cameraView="upper" produces the bust-shot framing
                        used by therapeutic ECA studies (face + shoulders
                        visible) — see docs/research/CITATIONS.md JMIR scoping review. */}
                    <div className="absolute inset-0 z-10 flex items-end sm:items-center justify-center pointer-events-none">
                        <div className="relative h-full w-full pointer-events-auto">
                            <TalkingHeadAvatar
                                avatarUrl={avatarUrl}
                                ttsLang={ttsLang}
                                ttsVoice={ttsVoice}
                                cameraView={avatarCameraView}
                                hideChrome
                                transparentBackground
                                greetingGesture={greetingGesture}
                            />
                        </div>
                    </div>

                    {/* Bottom dock — caption (interim user transcript OR
                        avatar subtitles) + MicFAB.

                        Showing what's being heard reduces anxiety about
                        being misunderstood (frequent complaint in voice-
                        first mental-health UX studies — docs/research/CITATIONS.md
                        IJERT 2024). Showing what the avatar said in
                        parallel (subtitles) addresses voice-fatigue and
                        accessibility for hearing-impaired users (WCAG). */}
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
                                    // Mirror the avatar subtitle's a11y treatment so
                                    // screen-reader users hear what the system thinks
                                    // they're saying as they speak. `polite` keeps it
                                    // from interrupting in-flight assistant audio.
                                    aria-live="polite"
                                    aria-atomic="false"
                                >
                                    {interimTranscript}
                                </motion.p>
                            ) : null}
                        </AnimatePresence>
                        <MicFAB state={micState} onTap={onMicTap} />

                        {/* "Type instead" — exits Presence and returns to
                            the text composer. Distress users sometimes
                            don't want to speak; honor that without making
                            them feel they failed at voice. */}
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

                    {/* Safety overlay — Phase 4 (Stanley-Brown SPI; see
                        docs/research/CITATIONS.md). Always one tap away. */}
                    <PresenceSafetyOverlay />
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default PresenceMode;
