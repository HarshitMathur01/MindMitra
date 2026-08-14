/**
 * AnamAvatar — replaces TalkingHeadAvatar.tsx.
 *
 * Renders a photorealistic Anam AI avatar via WebRTC (SDK v4).
 *
 * Pipeline modes (controlled by VITE_ANAM_PIPELINE_MODE):
 *
 *  false (default) — MindMitra Backend Pipeline:
 *    Anam mic muted. Avatar does lipsync only, driven by Azure TTS.
 *    Messages come from useChat() → speakWithAnam() → AgentAudioInputStream.
 *
 *  true — Anam Pipeline Mode:
 *    Anam mic open. Anam handles STT + LLM + TTS autonomously.
 *    On each completed Anam turn, `onAnamTurn` prop fires so ChatGPTInterface
 *    can inject messages into the chat UI and persist to Supabase.
 *    MindMitra's LLM is NEVER called — except the crisis path, which still runs
 *    through /anam/crisis-check and surfaces via `onCrisis`.
 */

import { memo, useCallback, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useChat } from "@/hooks/useChat";
import { useAnamAvatar, ANAM_PIPELINE_MODE } from "@/hooks/useAnamAvatar";
import { Skeleton } from "@/components/ui/skeleton";

/** "9:05" — never negative, never past 59 seconds on the seconds side. */
function formatRemaining(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Below this, the remaining-time pill switches to a warning style. */
const LOW_QUOTA_WARNING_SECONDS = 60;

interface AnamAvatarProps {
    /**
     * Hide the "Speaking" indicator pill.
     * Used by PresenceModeAnam where the MicFAB already signals state.
     */
    hideChrome?: boolean;
    /**
     * Make the video background transparent so the parent gradient shows through.
     * Used in full-screen Presence Mode.
     */
    transparentBackground?: boolean;
    /**
     * Anam pipeline mode only: called with (userText, agentText) whenever
     * a complete conversation turn is detected via MESSAGE_HISTORY_UPDATED.
     * ChatGPTInterface uses this to inject messages into the UI + Supabase.
     */
    onAnamTurn?: (userText: string, agentText: string) => void;
    /** Backend session id, so crisis screening shares the chat's Redis session. */
    sessionId?: string | null;
    /**
     * Anam pipeline mode only: fired when the crisis interceptor trips. The
     * avatar is already speaking the clinician-reviewed template; the parent
     * should show the same text in the chat UI, verbatim.
     */
    onCrisis?: (content: string, crisisNumbers: string[]) => void;
    /** BCP-47 tag for what Anam should expect to hear. Changing it reconnects. */
    language?: string;
    /**
     * Vertical placement of the aspect-locked video stage inside the container.
     * `"center"` (default) suits the chat side pane; `"bottom-mobile"` keeps
     * Presence Mode's original bottom-anchored framing on small screens, where
     * the MicFAB dock owns the lower third.
     */
    stageAlign?: "center" | "bottom-mobile";
}

const AnamAvatar = ({
    hideChrome = false,
    transparentBackground = false,
    onAnamTurn,
    sessionId,
    onCrisis,
    language,
    stageAlign = "center",
}: AnamAvatarProps) => {
    // Stable video element id — useId() never changes for the same mount.
    const rawId  = useId();
    const videoId = `anam-video-${rawId.replace(/:/g, "")}`;

    const [supabaseJwt, setSupabaseJwt] = useState<string | null>(null);
    const { message: avatarCurrentMessage, onMessagePlayed } = useChat();

    // Resolve Supabase JWT once on mount for the session-token backend call.
    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSupabaseJwt(data.session?.access_token ?? null);
        });
    }, []);

    const {
        isReady,
        isSpeaking,
        error,
        pipelineMode,
        speakWithAnam,
        interruptAnam,
        remainingSeconds,
        quotaExhausted,
    } = useAnamAvatar({
        supabaseJwt,
        videoElementId: videoId,
        onMessagePlayed,
        onAnamTurn, // bubbled up to ChatGPTInterface for UI injection
        sessionId,
        onCrisis,
        language,
    });

    // ── Aspect-locked stage ───────────────────────────────────────────────────
    // Anam never tells us the stream's dimensions up front: the SDK assigns
    // srcObject inside its `ontrack` handler, so intrinsic size is only known
    // once a track lands. Letting the raw <video> fill the container instead
    // meant a landscape stream in the tall laptop side pane (~460×700) was
    // scaled to the pane height and centre-cropped to roughly a third of its
    // width. We measure the stream, fit a box of the same ratio inside the
    // container, and let the leftover space fall through to the pane backdrop.
    const rootRef  = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [streamAspect, setStreamAspect] = useState<number | null>(null);
    const [stageBox, setStageBox] = useState<{ w: number; h: number } | null>(null);

    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;

        // `resize` (not just `loadedmetadata`) because Anam can renegotiate the
        // track mid-session and hand us a different resolution.
        const readAspect = () => {
            if (el.videoWidth > 0 && el.videoHeight > 0) {
                setStreamAspect(el.videoWidth / el.videoHeight);
            }
        };

        readAspect();
        el.addEventListener("loadedmetadata", readAspect);
        el.addEventListener("resize", readAspect);
        return () => {
            el.removeEventListener("loadedmetadata", readAspect);
            el.removeEventListener("resize", readAspect);
        };
    }, []);

    // Presence Mode wants the avatar edge-to-edge on its gradient; the side
    // pane insets the frame so its rounded corners and shadow have somewhere
    // to fall.
    const framePad = transparentBackground ? 0 : 16;

    const fitStage = useCallback(() => {
        const root = rootRef.current;
        if (!root || !streamAspect) return;
        const availW = root.clientWidth - framePad * 2;
        const availH = root.clientHeight - framePad * 2;
        if (availW <= 0 || availH <= 0) return; // hidden / not laid out
        const w = Math.min(availW, availH * streamAspect);
        setStageBox({ w, h: w / streamAspect });
    }, [streamAspect, framePad]);

    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        fitStage();
        const observer = new ResizeObserver(fitStage);
        observer.observe(root);
        return () => observer.disconnect();
    }, [fitStage]);

    // Before the first track lands the box is unknown; fill the container so
    // nothing jumps. The loading skeleton covers this window anyway.
    const stageStyle: CSSProperties = stageBox
        ? { width: `${stageBox.w}px`, height: `${stageBox.h}px` }
        : { width: "100%", height: "100%" };

    // ── React to avatar messages (MindMitra pipeline mode only) ───────────────
    // In Anam pipeline mode this effect is a no-op because:
    //   a) MindMitra's LLM never calls addAvatarMessage()
    //   b) speakWithAnam() returns immediately (no-op) in Anam mode
    const lastMessageIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!isReady || !avatarCurrentMessage) return;
        if (ANAM_PIPELINE_MODE) return; // Anam speaks for itself

        const msgId = avatarCurrentMessage.utteranceId ?? avatarCurrentMessage.id ?? null;
        if (msgId && msgId === lastMessageIdRef.current) return;
        lastMessageIdRef.current = msgId;

        const text = (avatarCurrentMessage.text ?? "").trim();
        if (!text) { onMessagePlayed(); return; }

        if (isSpeaking) interruptAnam();
        void speakWithAnam(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [avatarCurrentMessage, isReady]);

    // Presence Mode stays transparent so the overlay's sage gradient reads
    // through; everywhere else the stage paints its own token-driven backdrop.
    const bgClass = transparentBackground ? "bg-transparent" : "mm-avatar-stage";
    const frameClass = transparentBackground ? "" : "mm-avatar-frame";
    const alignClass = stageAlign === "bottom-mobile" ? "items-end sm:items-center" : "items-center";

    return (
        <div ref={rootRef} className={`relative w-full h-full overflow-hidden ${bgClass}`}>
            {/* Aspect-locked stage — matches the stream's ratio, so the <video>
                below fills it exactly: no crop, no letterbox, no stretch. */}
            <div className={`absolute inset-0 flex justify-center ${alignClass}`}>
                <div
                    className={`relative shrink-0 overflow-hidden ${frameClass}`}
                    style={stageStyle}
                    data-speaking={isReady && isSpeaking ? "true" : "false"}
                >
                    {/*
                     * IMPORTANT: this <video> must be in the DOM before the hook calls
                     * client.streamToVideoElement(videoId). The id is stable because
                     * useId() never changes for the same component mount.
                     */}
                    <video
                        ref={videoRef}
                        id={videoId}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                        style={transparentBackground ? { background: "transparent" } : undefined}
                        aria-label="MindMitra AI avatar"
                    />

                    {/* Speaking indicator — hidden in Presence Mode (hideChrome=true).
                        Anchored to the stage so it sits on the avatar, not the backdrop. */}
                    {isReady && isSpeaking && !hideChrome && (
                        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5">
                            {[0, 0.15, 0.3].map((delay) => (
                                <span
                                    key={delay}
                                    className="block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce"
                                    style={{ animationDelay: `${delay}s` }}
                                />
                            ))}
                            <span className="text-white/80 text-xs ml-1">Speaking</span>
                        </div>
                    )}

                    {/* Daily video quota remaining — top-left, out of the way of the
                        speaking indicator (top-right) and mode badge (bottom-left). */}
                    {isReady && !hideChrome && remainingSeconds !== null && (
                        <div className="absolute top-3 left-3 z-10">
                            <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm ${
                                    remainingSeconds <= LOW_QUOTA_WARNING_SECONDS
                                        ? "bg-amber-500/30 text-amber-100 border border-amber-400/40"
                                        : "bg-black/40 text-white/70 border border-white/10"
                                }`}
                            >
                                {formatRemaining(remainingSeconds)} left today
                            </span>
                        </div>
                    )}

                    {/* Pipeline mode badge — subtle indicator, visible only on avatar surface */}
                    {isReady && !hideChrome && (
                        <div className="absolute bottom-3 left-3 z-10">
                            <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm ${
                                    pipelineMode === "anam"
                                        ? "bg-violet-500/30 text-violet-200 border border-violet-400/30"
                                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-400/20"
                                }`}
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                                {pipelineMode === "anam" ? "Anam LLM" : "MindMitra LLM"}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Daily quota exhausted — an expected, user-facing state, not a
                failure, so it gets its own card rather than the error overlay. */}
            {quotaExhausted && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/85 backdrop-blur-sm z-10 px-4 gap-2 text-center">
                    <p className="text-foreground text-sm font-medium">Today's avatar time is used up</p>
                    <p className="text-muted-foreground text-xs max-w-xs leading-relaxed">
                        You get 10 minutes of avatar video a day. It resets at midnight — text chat is still here anytime.
                    </p>
                </div>
            )}

            {/* Loading skeleton while Anam WebRTC session initialises */}
            {!isReady && !error && !quotaExhausted && (
                <div
                    className={`absolute inset-0 flex flex-col items-center justify-center z-10 p-6 space-y-6 animate-pulse ${
                        transparentBackground ? "bg-black/30 backdrop-blur-sm" : "mm-avatar-stage"
                    }`}
                >
                    <div className="w-32 h-32 md:w-48 md:h-48 rounded-full bg-primary/10 border-4 border-primary/20 flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                    <div className="space-y-3 flex flex-col items-center w-full">
                        <Skeleton className="h-4 w-48 bg-primary/20" />
                        <Skeleton className="h-3 w-32 bg-primary/10" />
                    </div>
                </div>
            )}

            {/* Error overlay. Backdrop-blurred rather than opaque so the stage
                stays visible behind it in both themes and in Presence Mode. */}
            {error && !quotaExhausted && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/85 backdrop-blur-sm z-10 px-4 gap-3">
                    <p className="text-destructive text-sm text-center">⚠️ Avatar unavailable</p>
                    <p className="text-muted-foreground text-xs text-center max-w-xs leading-relaxed">{error}</p>
                </div>
            )}

        </div>
    );
};

export default memo(AnamAvatar);
