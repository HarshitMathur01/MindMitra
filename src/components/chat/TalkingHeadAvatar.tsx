import { memo, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useChat } from "../../hooks/useChat";
import { Skeleton } from "@/components/ui/skeleton";
import avatarBackdropVideos from "virtual:avatar-backdrop-videos";

// Map facial expressions from backend/detectSentiment → bridge emotion names.
// The iframe’s MindMitraBridge has 6 injected therapeutic moods (empathy, concern,
// encouragement, acknowledgment, calm, listening) plus TalkingHead built-ins.
const EXPRESSION_TO_EMOTION: Record<string, string> = {
    // Therapeutic emotions (from expanded backend _detect_emotion)
    empathy: "empathy",
    concern: "concern",
    encouragement: "encouragement",
    acknowledgment: "acknowledgment",
    calm: "calm",
    listening: "listening",
    // Standard / legacy expressions → closest therapeutic mood
    smile: "encouragement",
    happy: "encouragement",
    sad: "empathy",
    angry: "concern",
    surprised: "acknowledgment",
    gentle: "calm",
    compassionate: "empathy",
    concerned: "concern",
    thoughtful: "acknowledgment",
    hopeful: "encouragement",
    default: "neutral",
};

/**
 * Estimate playback duration from text length (rough heuristic).
 * ~130 words/min average speaking rate.
 */
function estimateSpeakDurationMs(text: string): number {
    const wordCount = text.trim().split(/\s+/).length;
    const baseSec = (wordCount / 130) * 60; // seconds
    return Math.max(3000, (baseSec + 1.5) * 1000); // min 3s, add 1.5s buffer
}

/**
 * Split text into sentence-level chunks for parallel TTS.
 * Mirrors the logic in talkinghead.html → splitIntoSentences().
 * Handles Latin (.!?), Japanese (。！？), and Indic danda (।) terminators.
 */
function splitIntoSentences(text: string): string[] {
    const raw = text.match(/[^.!?。！？।]+(?:[.!?。！？।]+(?:\s|$)|$)/g) ?? [text];
    return raw.map((s) => s.trim()).filter((s) => s.length > 1);
}

interface Props {
    /** Google Cloud TTS API key.
     *  Falls back to VITE_GOOGLE_TTS_KEY env var.
     *  Without a key the avatar still animates using Web Speech API for audio. */
    googleKey?: string;
    /** Google Cloud TTS voice name. Default: en-IN-Neural2-A (Indian English female, Neural2) */
    ttsVoice?: string;
    /** BCP-47 language tag for the voice. Default: en-IN */
    ttsLang?: string;
    /** Avatar GLB URL relative to public root. Defaults to brunette. */
    avatarUrl?: string;
    /**
     * TalkingHead camera framing preset:
     *   "full"  — full body (default for legacy half-pane)
     *   "mid"   — mid-body, shoulders down (current default)
     *   "upper" — bust-shot, ideal for face-to-face Presence Mode
     *   "head"  — tight headshot
     */
    cameraView?: "full" | "mid" | "upper" | "head";
    /**
     * Hide the small "Speaking" pill in the corner. Used by Presence
     * Mode where the MicFAB already conveys speaking state and we
     * want to minimize visual chrome around the face.
     */
    hideChrome?: boolean;
    /**
     * Make the iframe background blend with the parent (transparent +
     * the iframe's body/canvas bleeds through). Used by Presence Mode
     * so the sage gradient backdrop is continuous behind the avatar.
     */
    transparentBackground?: boolean;
}

function hashString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return hash;
}

type AvatarBackdropVideo = (typeof avatarBackdropVideos)[number];

function resolveAvatarBackdropVideo(avatarUrl: string): AvatarBackdropVideo | undefined {
    if (avatarBackdropVideos.length === 0) return undefined;
    return avatarBackdropVideos[hashString(avatarUrl) % avatarBackdropVideos.length];
}

function usePrefersReducedMotion(): boolean {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => setPrefersReducedMotion(mediaQuery.matches);
        update();
        mediaQuery.addEventListener("change", update);
        return () => mediaQuery.removeEventListener("change", update);
    }, []);

    return prefersReducedMotion;
}

function useSaveData(): boolean {
    const [saveData, setSaveData] = useState(false);

    useEffect(() => {
        const connection = (navigator as Navigator & {
            connection?: {
                saveData?: boolean;
                addEventListener?: (type: "change", listener: () => void) => void;
                removeEventListener?: (type: "change", listener: () => void) => void;
            };
        }).connection;
        if (!connection) return;

        const update = () => setSaveData(Boolean(connection.saveData));
        update();
        connection.addEventListener?.("change", update);
        return () => connection.removeEventListener?.("change", update);
    }, []);

    return saveData;
}

const TalkingHeadAvatar = ({
    googleKey,
    ttsVoice = "en-IN-Neural2-A",
    ttsLang = "en-IN",
    avatarUrl = "/talkinghead/avatars/brunette.glb",
    cameraView,
    hideChrome = false,
    transparentBackground = false,
}: Props) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isReady, setIsReady] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [shouldLoadBackdropVideo, setShouldLoadBackdropVideo] = useState(false);
    const playbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastMessageTextRef = useRef<string>("");
    /** Prevents double onMessagePlayed when iframe speakingEnd and heuristic timer both fire. */
    const messagePlayedForCurrentRef = useRef(false);

    // Resolve Google key: prop > env var > empty (Web Speech fallback)
    const resolvedGoogleKey: string =
        googleKey || import.meta.env.VITE_GOOGLE_TTS_KEY || "";

    // Resolve Azure TTS credentials from env vars (fallback when no Google key)
    const resolvedAzureKey: string = import.meta.env.VITE_AZURE_TTS_KEY || "";
    const resolvedAzureRegion: string = import.meta.env.VITE_AZURE_TTS_REGION || "eastasia";

    const { message: avatarCurrentMessage, onMessagePlayed } = useChat();
    const prefersReducedMotion = usePrefersReducedMotion();
    const saveData = useSaveData();
    const backdropVideo = useMemo(() => resolveAvatarBackdropVideo(avatarUrl), [avatarUrl]);
    const canPlayBackdropVideo = Boolean(backdropVideo?.src) && !prefersReducedMotion && !saveData;
    const useTransparentStage = transparentBackground || Boolean(backdropVideo);

    // Build iframe src — non-secret config only.
    //
    // Security: TTS API keys (Google + Azure) are intentionally NOT in
    // the URL. If they were, they'd land in browser history, the Referer
    // header on every cross-origin fetch the iframe makes, and DevTools.
    // Keys are sent over `postMessage` after the iframe asks for them
    // via { type: "needConfig" }. See public/talkinghead.html for the
    // gated init().
    const iframeSrc = useMemo(() => {
        const params = new URLSearchParams();
        params.set("ttsVoice", ttsVoice);
        params.set("ttsLang", ttsLang);
        params.set("avatarUrl", avatarUrl);
        if (cameraView) params.set("cameraView", cameraView);
        if (useTransparentStage) params.set("transparent", "1");
        return `/talkinghead.html?${params.toString()}`;
    }, [avatarUrl, cameraView, ttsLang, ttsVoice, useTransparentStage]);

    // ── Post a message to the iframe ────────────────────────────────────────
    // Defense in depth: scope `postMessage` to our own origin instead of
    // the wildcard "*". The iframe is same-origin (it lives at
    // /talkinghead.html on the same host), so this never breaks delivery
    // but prevents data leaking to a different document if the iframe
    // were ever pointed at a third-party origin in the future.
    const postToIframe = useCallback((data: object) => {
        iframeRef.current?.contentWindow?.postMessage(data, window.location.origin);
    }, []);

    // ── Listen for messages FROM the iframe ────────────────────────────────
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            // Two safety checks: same-origin AND comes from our specific iframe.
            // Without the source check, any same-origin window (e.g. a future
            // sibling iframe) could spoof a "needConfig" and exfiltrate keys.
            if (event.origin !== window.location.origin) return;
            if (event.source !== iframeRef.current?.contentWindow) return;
            const { type, message } = event.data || {};

            switch (type) {
                case "needConfig":
                    // Iframe is asking for the secret-bearing config. Send
                    // keys via postMessage scoped to our origin (see
                    // postToIframe). The iframe will not init TalkingHead
                    // until it receives this payload.
                    postToIframe({
                        type: "config",
                        googleKey: resolvedGoogleKey,
                        azureKey: resolvedAzureKey,
                        azureRegion: resolvedAzureRegion,
                    });
                    break;

                case "ready":
                    setIsReady(true);
                    setLoadError(null);
                    break;

                case "speakingStart":
                    setIsSpeaking(true);
                    break;

                case "speakingEnd":
                    setIsSpeaking(false);
                    if (playbackTimerRef.current) {
                        clearTimeout(playbackTimerRef.current);
                        playbackTimerRef.current = null;
                    }
                    if (!messagePlayedForCurrentRef.current) {
                        messagePlayedForCurrentRef.current = true;
                        onMessagePlayed();
                    }
                    break;

                case "error":
                    setLoadError(message || "Avatar failed to load");
                    break;
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [onMessagePlayed, postToIframe, resolvedGoogleKey, resolvedAzureKey, resolvedAzureRegion]);

    // ── React to new avatar messages ────────────────────────────────────────
    useEffect(() => {
        if (!isReady || !avatarCurrentMessage) return;

        const text = avatarCurrentMessage.text;
        if (!text || text === lastMessageTextRef.current) return;
        lastMessageTextRef.current = text;
        messagePlayedForCurrentRef.current = false;

        // Neutral mouth/face before TTS: MindMitra therapeutic moods inject mouth
        // morphs in baselines; those fight Oculus viseme phoneme tracks (TalkingHead
        // README: viseme-driven lip-sync needs a neutral mouth baseline). Upper-face
        // empathy can be reintroduced later via iframe APIs if product wants it.
        postToIframe({ type: "setEmotion", emotion: "neutral" });

        // Split text into sentences and dispatch speakTextStream so the iframe can
        // join text, run Azure/Google once, and call speakAudio with aligned visemes.
        const sentences = splitIntoSentences(text);
        postToIframe({ type: "speakTextStream", sentences });

        // Fallback: mark message as played after estimated duration
        // (in case the iframe doesn't send speakingEnd). Slightly padded so we do not
        // beat real audio + lip-sync on long replies.
        const duration = Math.round(estimateSpeakDurationMs(text) * 1.2);
        if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
        playbackTimerRef.current = setTimeout(() => {
            setIsSpeaking(false);
            if (!messagePlayedForCurrentRef.current) {
                messagePlayedForCurrentRef.current = true;
                onMessagePlayed();
            }
        }, duration);
    }, [avatarCurrentMessage, isReady, postToIframe, onMessagePlayed]);

    // Let the iframe and controls mount first, then start the decorative
    // backdrop video only when the user's device preferences allow it.
    useEffect(() => {
        setShouldLoadBackdropVideo(false);
        if (!canPlayBackdropVideo) return;

        const timer = window.setTimeout(() => {
            setShouldLoadBackdropVideo(true);
        }, 250);

        return () => window.clearTimeout(timer);
    }, [backdropVideo?.src, canPlayBackdropVideo]);

    useEffect(() => {
        if (!shouldLoadBackdropVideo) return;

        const syncVideoWithPageVisibility = () => {
            const video = videoRef.current;
            if (!video) return;

            if (document.hidden) {
                video.pause();
                return;
            }

            video.play().catch(() => {
                // Autoplay can still be denied in unusual browser policies.
            });
        };

        document.addEventListener("visibilitychange", syncVideoWithPageVisibility);
        return () => document.removeEventListener("visibilitychange", syncVideoWithPageVisibility);
    }, [shouldLoadBackdropVideo]);

    // ── Cleanup timer on unmount ────────────────────────────────────────────
    useEffect(() => {
        return () => {
            if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
        };
    }, []);

    return (
        <div
            className={`relative w-full h-full overflow-hidden ${
                useTransparentStage ? "bg-transparent" : "bg-[#1a1a2e]"
            }`}
        >
            {backdropVideo?.poster && (
                <img
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full object-cover"
                    src={backdropVideo.poster}
                    alt=""
                    decoding="async"
                />
            )}

            {backdropVideo?.src && shouldLoadBackdropVideo && (
                <video
                    ref={videoRef}
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full object-cover"
                    src={backdropVideo.src}
                    poster={backdropVideo.poster}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="none"
                    disablePictureInPicture
                />
            )}

            {/* TalkingHead iframe */}
            <iframe
                ref={iframeRef}
                src={iframeSrc}
                title="MindMitra Avatar"
                className="relative z-[1] w-full h-full border-0"
                style={useTransparentStage ? { backgroundColor: "transparent" } : undefined}
                allow="autoplay; microphone"
                sandbox="allow-scripts allow-same-origin"
            />

            {/* Loading overlay — shown until iframe reports ready */}
            {!isReady && !loadError && (
                <div
                    className={`absolute inset-0 flex flex-col items-center justify-center z-10 p-6 space-y-6 animate-pulse ${
                        useTransparentStage ? "bg-black/30 backdrop-blur-sm" : "bg-[#1a1a2e]"
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

            {/* Error overlay */}
            {loadError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a2e]/90 z-10 px-4">
                    <p className="text-red-400 text-sm text-center">⚠️ {loadError}</p>
                </div>
            )}

            {/* Speaking indicator — suppressed in Presence Mode where the
                MicFAB carries this signal more clearly. */}
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
        </div>
    );
};

export default memo(TalkingHeadAvatar);
