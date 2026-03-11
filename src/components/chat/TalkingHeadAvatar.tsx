import { useEffect, useRef, useState, useCallback } from "react";
import { useChat } from "../../hooks/useChat";
import { Skeleton } from "@/components/ui/skeleton";

// Map the app's facialExpression values → TalkingHead mood names
const EXPRESSION_TO_MOOD: Record<string, string> = {
    smile: "happy",
    happy: "happy",
    sad: "sad",
    angry: "angry",
    surprised: "surprised",
    gentle: "neutral",
    compassionate: "neutral",
    concerned: "neutral",
    thoughtful: "neutral",
    hopeful: "neutral",
    listening: "neutral",
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
}

const TalkingHeadAvatar = ({
    googleKey,
    ttsVoice = "en-IN-Neural2-A",
    ttsLang = "en-IN",
    avatarUrl = "/talkinghead/avatars/Brunette.glb",
}: Props) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isReady, setIsReady] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const playbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastMessageTextRef = useRef<string>("");

    // Resolve Google key: prop > env var > empty (Web Speech fallback)
    const resolvedGoogleKey: string =
        googleKey || import.meta.env.VITE_GOOGLE_TTS_KEY || "";

    const { message: avatarCurrentMessage, onMessagePlayed } = useChat();

    // Build iframe src — pass Google TTS config as URL search params
    const iframeSrc = (() => {
        const params = new URLSearchParams();
        if (resolvedGoogleKey) params.set("googleKey", resolvedGoogleKey);
        params.set("ttsVoice", ttsVoice);
        params.set("ttsLang", ttsLang);
        params.set("avatarUrl", avatarUrl);
        return `/talkinghead.html?${params.toString()}`;
    })();

    // ── Post a message to the iframe ────────────────────────────────────────
    const postToIframe = useCallback((data: object) => {
        iframeRef.current?.contentWindow?.postMessage(data, "*");
    }, []);

    // ── Listen for messages FROM the iframe ────────────────────────────────
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            // Only handle messages from our iframe
            if (event.source !== iframeRef.current?.contentWindow) return;
            const { type, message } = event.data || {};

            switch (type) {
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
                    onMessagePlayed();
                    break;

                case "error":
                    setLoadError(message || "Avatar failed to load");
                    break;
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [onMessagePlayed]);

    // ── React to new avatar messages ────────────────────────────────────────
    useEffect(() => {
        if (!isReady || !avatarCurrentMessage) return;

        const text = avatarCurrentMessage.text;
        if (!text || text === lastMessageTextRef.current) return;
        lastMessageTextRef.current = text;

        // Optionally set mood before speaking
        const expression = avatarCurrentMessage.facialExpression || "default";
        const mood = EXPRESSION_TO_MOOD[expression] ?? "neutral";
        postToIframe({ type: "setMood", mood });

        // Speak the text
        postToIframe({ type: "speakText", text });

        // Fallback: mark message as played after estimated duration
        // (in case the iframe doesn't send speakingEnd)
        const duration = estimateSpeakDurationMs(text);
        if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
        playbackTimerRef.current = setTimeout(() => {
            setIsSpeaking(false);
            onMessagePlayed();
        }, duration);
    }, [avatarCurrentMessage, isReady, postToIframe, onMessagePlayed]);

    // ── Cleanup timer on unmount ────────────────────────────────────────────
    useEffect(() => {
        return () => {
            if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
        };
    }, []);

    return (
        <div className="relative w-full h-full bg-[#1a1a2e] overflow-hidden">
            {/* TalkingHead iframe */}
            <iframe
                ref={iframeRef}
                src={iframeSrc}
                title="MindMitra Avatar"
                className="w-full h-full border-0"
                allow="autoplay; microphone"
                sandbox="allow-scripts allow-same-origin"
            />

            {/* Loading overlay — shown until iframe reports ready */}
            {!isReady && !loadError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a2e] z-10 p-6 space-y-6 animate-pulse">
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

            {/* Speaking indicator */}
            {isReady && isSpeaking && (
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

export default TalkingHeadAvatar;
