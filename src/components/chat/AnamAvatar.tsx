import { memo, useCallback, useEffect, useId, useRef, useState } from "react";
import {
    createClient,
    AnamEvent,
    MessageRole,
    type AnamClient,
    type Message,
    type MessageStreamEvent,
} from "@anam-ai/js-sdk";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

/**
 * Anam.ai hosted avatar (turnkey mode).
 *
 * Prop-compatible with `TalkingHeadAvatar` so the two render sites can switch
 * on `AVATAR_PROVIDER` without touching their surrounding layout.
 *
 * Turnkey means Anam owns the whole loop — microphone, STT, LLM and TTS. This
 * component therefore does NOT consume the `useChat()` avatar message queue:
 * nothing here speaks text produced by `POST /chat`. It only mounts the
 * session, hands back the transcript, and tears the session down.
 *
 * Because Anam's LLM answers directly, replies on this path never pass through
 * `crisis_bypass.py` or `safety_gate.py`. That is why `AVATAR_PROVIDER`
 * defaults to `talkinghead` — see src/lib/avatarProvider.ts.
 */

/** Anam's transcript role for its own speech. `MessageRole.USER` is the student. */
export type AnamTranscriptRole = "user" | "persona";

export interface AnamTranscriptEntry {
    id: string;
    role: AnamTranscriptRole;
    content: string;
}

interface Props {
    /** Avatar id from AVATAR_OPTIONS. The backend maps it to an Anam persona. */
    avatarId: string;
    /** Hide the small corner status pill. Presence Mode passes this. */
    hideChrome?: boolean;
    /** Blend the stage with the parent background instead of the dark plate. */
    transparentBackground?: boolean;
    /** Called whenever Anam updates the conversation history. */
    onTranscript?: (entries: AnamTranscriptEntry[]) => void;
    /** Called when the persona starts/stops holding the floor. */
    onSpeakingChange?: (speaking: boolean) => void;
}

type Status = "connecting" | "live" | "error";

const getSessionTokenEndpoint = (): string => {
    const backendUrl = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim();
    if (backendUrl) return `${backendUrl.replace(/\/$/, "")}/avatar/session-token`;
    if (import.meta.env.PROD) {
        throw new Error("Missing VITE_BACKEND_URL for production avatar deployment");
    }
    return `${window.location.origin.replace(/\/$/, "")}/avatar/session-token`;
};

async function fetchSessionToken(avatarId: string, signal: AbortSignal): Promise<string> {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    const response = await fetch(getSessionTokenEndpoint(), {
        method: "POST",
        signal,
        headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ avatar_id: avatarId }),
    });

    if (!response.ok) {
        // 503 is the common, actionable case: the persona has no Anam
        // catalogue ids filled in yet, or ANAM_API_KEY is unset.
        throw new Error(
            response.status === 503
                ? "The avatar isn't configured yet."
                : `Couldn't start the avatar (${response.status}).`,
        );
    }

    const payload = (await response.json()) as { session_token?: string };
    if (!payload.session_token) throw new Error("The avatar session couldn't be created.");
    return payload.session_token;
}

const AnamAvatar = ({
    avatarId,
    hideChrome,
    transparentBackground,
    onTranscript,
    onSpeakingChange,
}: Props) => {
    // streamToVideoElement() resolves via document.getElementById, so the
    // element needs a real, unique DOM id — colons from useId() are stripped
    // to keep it usable as a CSS selector too.
    const videoElementId = `anam-video-${useId().replace(/:/g, "")}`;

    const [status, setStatus] = useState<Status>("connecting");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [retryNonce, setRetryNonce] = useState(0);

    const clientRef = useRef<AnamClient | null>(null);

    // Latest-callback refs: the parent re-renders on every transcript update,
    // so depending on the callbacks directly would tear down the session on
    // each message.
    const onTranscriptRef = useRef(onTranscript);
    const onSpeakingChangeRef = useRef(onSpeakingChange);
    useEffect(() => {
        onTranscriptRef.current = onTranscript;
        onSpeakingChangeRef.current = onSpeakingChange;
    }, [onTranscript, onSpeakingChange]);

    const markSpeaking = useCallback((speaking: boolean) => {
        setIsSpeaking(speaking);
        onSpeakingChangeRef.current?.(speaking);
    }, []);

    useEffect(() => {
        // StrictMode mounts effects twice in dev. A session is a billed,
        // concurrency-limited resource, so guard creation on a local flag and
        // always stop whatever this run started.
        let cancelled = false;
        const abortController = new AbortController();
        let client: AnamClient | null = null;

        // Transcript text comes from the settled history rather than the
        // stream chunks: MessageStreamEvent carries a `contentIndex`, so its
        // `content` may be a fragment rather than the full line. Subtitles
        // therefore land at end-of-turn instead of word-by-word.
        const handleHistory = (messages: Message[]) => {
            onTranscriptRef.current?.(
                messages.map((m) => ({
                    id: m.id,
                    role: m.role === MessageRole.USER ? "user" : "persona",
                    content: m.content,
                })),
            );
        };
        const handleVideoStarted = () => {
            if (!cancelled) setStatus("live");
        };
        const handleClosed = (_reason: unknown, details?: string) => {
            if (cancelled) return;
            markSpeaking(false);
            setStatus("error");
            setErrorMessage(details ? `Connection closed: ${details}` : "The avatar disconnected.");
        };
        const handleMicDenied = () => {
            if (cancelled) return;
            setStatus("error");
            setErrorMessage("Microphone access is needed to talk with the avatar.");
        };
        // Persona speaking state comes from the stream events' `endOfSpeech`
        // flag. AUDIO_STREAM_STARTED is NOT usable here — it fires once when
        // the WebRTC audio track opens, not per utterance, so it would latch
        // the indicator on for the whole session.
        const handleStreamEvent = (event: MessageStreamEvent) => {
            if (cancelled || event.role !== MessageRole.PERSONA) return;
            markSpeaking(!event.endOfSpeech && !event.interrupted);
        };
        // Barge-in: the user talking over the persona ends its turn.
        const handleUserSpeechStarted = () => markSpeaking(false);

        (async () => {
            try {
                setStatus("connecting");
                setErrorMessage(null);

                const sessionToken = await fetchSessionToken(avatarId, abortController.signal);
                if (cancelled) return;

                client = createClient(sessionToken);
                clientRef.current = client;

                client.addListener(AnamEvent.MESSAGE_HISTORY_UPDATED, handleHistory);
                client.addListener(AnamEvent.MESSAGE_STREAM_EVENT_RECEIVED, handleStreamEvent);
                client.addListener(AnamEvent.VIDEO_PLAY_STARTED, handleVideoStarted);
                client.addListener(AnamEvent.CONNECTION_CLOSED, handleClosed);
                client.addListener(AnamEvent.MIC_PERMISSION_DENIED, handleMicDenied);
                client.addListener(AnamEvent.USER_SPEECH_STARTED, handleUserSpeechStarted);

                await client.streamToVideoElement(videoElementId);
                if (cancelled) return;
                setStatus("live");
            } catch (err) {
                if (cancelled || abortController.signal.aborted) return;
                console.error("❌ [Anam] Session start failed:", err);
                setStatus("error");
                setErrorMessage(err instanceof Error ? err.message : "Couldn't start the avatar.");
            }
        })();

        return () => {
            cancelled = true;
            abortController.abort();
            const active = client;
            client = null;
            clientRef.current = null;
            if (!active) return;
            active.removeListener(AnamEvent.MESSAGE_HISTORY_UPDATED, handleHistory);
            active.removeListener(AnamEvent.MESSAGE_STREAM_EVENT_RECEIVED, handleStreamEvent);
            active.removeListener(AnamEvent.VIDEO_PLAY_STARTED, handleVideoStarted);
            active.removeListener(AnamEvent.CONNECTION_CLOSED, handleClosed);
            active.removeListener(AnamEvent.MIC_PERMISSION_DENIED, handleMicDenied);
            active.removeListener(AnamEvent.USER_SPEECH_STARTED, handleUserSpeechStarted);
            // Fire-and-forget: React cleanup is sync, but the session must be
            // released or it keeps billing until Anam's idle timeout.
            active.stopStreaming().catch((err) => {
                console.warn("⚠️ [Anam] stopStreaming during cleanup failed:", err);
            });
        };
    }, [avatarId, videoElementId, retryNonce, markSpeaking]);

    // Backgrounding the tab should release the session rather than stream video
    // and hold a microphone nobody is using. Remounting on return is handled by
    // the retry path.
    useEffect(() => {
        const releaseIfHidden = () => {
            if (document.visibilityState !== "hidden") return;
            const active = clientRef.current;
            if (!active?.isStreaming()) return;
            active.stopStreaming().catch(() => {
                /* session already gone */
            });
            markSpeaking(false);
            setStatus("error");
            setErrorMessage("Paused while the tab was in the background.");
        };
        document.addEventListener("visibilitychange", releaseIfHidden);
        return () => document.removeEventListener("visibilitychange", releaseIfHidden);
    }, [markSpeaking]);

    const useTransparentStage = Boolean(transparentBackground);

    return (
        <div
            className={`relative w-full h-full overflow-hidden ${useTransparentStage ? "bg-transparent" : "bg-[#1a1a2e]"
                }`}
        >
            <video
                id={videoElementId}
                className="relative z-[1] h-full w-full object-cover"
                autoPlay
                playsInline
                disablePictureInPicture
            />

            {status === "connecting" && (
                <div
                    className={`absolute inset-0 flex flex-col items-center justify-center z-10 p-6 space-y-6 animate-pulse ${useTransparentStage ? "bg-black/30 backdrop-blur-sm" : "bg-[#1a1a2e]"
                        }`}
                >
                    <div className="w-32 h-32 md:w-48 md:h-48 rounded-full bg-primary/10 border-4 border-primary/20 flex flex-col items-center justify-center space-y-4">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                    <div className="space-y-3 flex flex-col items-center w-full">
                        <Skeleton className="h-4 w-48 bg-primary/20" />
                        <Skeleton className="h-3 w-32 bg-primary/10" />
                    </div>
                </div>
            )}

            {status === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#1a1a2e]/90 z-10 px-4">
                    <p className="text-red-400 text-sm text-center">⚠️ {errorMessage}</p>
                    <button
                        type="button"
                        onClick={() => setRetryNonce((n) => n + 1)}
                        className="rounded-full bg-white/10 px-4 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/40"
                    >
                        Try again
                    </button>
                </div>
            )}

            {status === "live" && isSpeaking && !hideChrome && (
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
        </div>
    );
};

export default memo(AnamAvatar);
