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
 *    MindMitra's LLM is NEVER called.
 */

import { memo, useEffect, useId, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useChat } from "@/hooks/useChat";
import { useAnamAvatar, ANAM_PIPELINE_MODE } from "@/hooks/useAnamAvatar";
import { Skeleton } from "@/components/ui/skeleton";

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
}

const AnamAvatar = ({
    hideChrome = false,
    transparentBackground = false,
    onAnamTurn,
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

    const { isReady, isSpeaking, error, pipelineMode, speakWithAnam, interruptAnam } =
        useAnamAvatar({
            supabaseJwt,
            videoElementId: videoId,
            onMessagePlayed,
            onAnamTurn, // bubbled up to ChatGPTInterface for UI injection
        });

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

    const bgClass = transparentBackground ? "bg-transparent" : "bg-[#1a1a2e]";

    return (
        <div className={`relative w-full h-full overflow-hidden ${bgClass}`}>
            {/*
             * IMPORTANT: this <video> must be in the DOM before the hook calls
             * client.streamToVideoElement(videoId). The id is stable because
             * useId() never changes for the same component mount.
             */}
            <video
                id={videoId}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
                style={transparentBackground ? { background: "transparent" } : undefined}
                aria-label="MindMitra AI avatar"
            />

            {/* Loading skeleton while Anam WebRTC session initialises */}
            {!isReady && !error && (
                <div
                    className={`absolute inset-0 flex flex-col items-center justify-center z-10 p-6 space-y-6 animate-pulse ${
                        transparentBackground ? "bg-black/30 backdrop-blur-sm" : "bg-[#1a1a2e]"
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

            {/* Error overlay */}
            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a2e]/90 z-10 px-4 gap-3">
                    <p className="text-red-400 text-sm text-center">⚠️ Avatar unavailable</p>
                    <p className="text-white/50 text-xs text-center max-w-xs leading-relaxed">{error}</p>
                </div>
            )}

            {/* Speaking indicator — hidden in Presence Mode (hideChrome=true) */}
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
    );
};

export default memo(AnamAvatar);
