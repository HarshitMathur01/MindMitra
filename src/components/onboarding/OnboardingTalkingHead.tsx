/**
 * OnboardingTalkingHead.tsx
 *
 * Standalone TalkingHead avatar for the onboarding flow.
 * Does NOT require ChatProvider — manages its own iframe lifecycle.
 *
 * Props:
 *   isSpeaking — kept for API compatibility; TalkingHead idles naturally
 *   avatarUrl  — GLB model URL, defaults to the brunette avatar
 *   className  — forwarded to the wrapper div
 */
import { useEffect, useRef, useState } from "react";

interface Props {
    isSpeaking?: boolean;
    avatarUrl?: string;
    className?: string;
}

export default function OnboardingTalkingHead({
    isSpeaking = false,
    avatarUrl = "/talkinghead/avatars/brunette.glb",
    className = "",
}: Props) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isReady, setIsReady] = useState(false);

    // Resolve Google TTS key from env (optional — Web Speech fallback used if absent)
    const googleKey: string = import.meta.env.VITE_GOOGLE_TTS_KEY ?? "";

    const iframeSrc = (() => {
        const params = new URLSearchParams();
        if (googleKey) params.set("googleKey", googleKey);
        params.set("ttsVoice", "en-IN-Neural2-A");
        params.set("ttsLang", "en-IN");
        params.set("avatarUrl", avatarUrl);
        return `/talkinghead.html?${params.toString()}`;
    })();

    // Listen for "ready" message from talkinghead.html
    useEffect(() => {
        const onMessage = (ev: MessageEvent) => {
            if (ev.data?.type === "ready") {
                setIsReady(true);
            }
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, []);

    // Map isSpeaking→ mood so the avatar looks engaged during speaking phases
    useEffect(() => {
        if (!isReady || !iframeRef.current?.contentWindow) return;
        iframeRef.current.contentWindow.postMessage(
            { type: "setMood", mood: isSpeaking ? "happy" : "neutral" },
            "*",
        );
    }, [isSpeaking, isReady]);

    return (
        <div className={`relative w-full h-full ${className}`}>
            {/* Loading shimmer until iframe signals ready */}
            {!isReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-transparent">
                    <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                </div>
            )}
            <iframe
                ref={iframeRef}
                src={iframeSrc}
                title="Onboarding Avatar"
                className={`w-full h-full border-none transition-opacity duration-500 ${isReady ? "opacity-100" : "opacity-0"}`}
                allow="autoplay; microphone"
            />
        </div>
    );
}
