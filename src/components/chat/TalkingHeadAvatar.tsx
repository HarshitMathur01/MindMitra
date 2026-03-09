import { useEffect, useRef, useState, useCallback } from "react";
import { useChat } from "../../hooks/useChat";
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
    /** Azure Cognitive Services TTS subscription key.
     *  Falls back to VITE_AZURE_TTS_KEY env var.
     *  Without a key the avatar still animates (text-based lipsync). */
    azureKey?: string;
    /** Azure region, e.g. "eastus". Falls back to VITE_AZURE_TTS_REGION env var. */
    azureRegion?: string;
    /** Azure Neural voice name. Default: en-US-Emma2:DragonHDLatestNeural */
     azureVoice?: string;
    /** BCP-47 language tag for the voice. Default: en-US */
    azureLang?: string;
    /** Avatar GLB URL relative to public root. Defaults to brunette. */
    avatarUrl?: string;
}

const TalkingHeadAvatar = ({
    azureKey,
    azureRegion,
    azureVoice = "en-US-JennyNeural",
    azureLang = "en-US",
    avatarUrl = "/talkinghead/avatars/brunette.glb",
}: Props) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isReady, setIsReady] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const playbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastMessageTextRef = useRef<string>("");

    // Resolve Azure key & region: prop > env var > fallback
    const resolvedAzureKey: string =
        azureKey || import.meta.env.VITE_AZURE_TTS_KEY || "";
    const resolvedAzureRegion: string =
        azureRegion || import.meta.env.VITE_AZURE_TTS_REGION || "eastus";

    const { message: avatarCurrentMessage, onMessagePlayed } = useChat();

    // Build iframe src — pass Azure config as URL search params
    const iframeSrc = (() => {
        const params = new URLSearchParams();
        if (resolvedAzureKey) params.set("azureKey", resolvedAzureKey);
        params.set("azureRegion", resolvedAzureRegion);
        params.set("azureVoice", azureVoice);
        params.set("azureLang", azureLang);
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
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a2e]/90 z-10">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                    <p className="text-white/70 text-sm font-medium">Loading avatar…</p>
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
