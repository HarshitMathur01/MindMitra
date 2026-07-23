import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Reusable TalkingHead iframe wrapper.
 *
 * Opt-in component — only MemoryChallenge mounts it today. Other tools can
 * adopt it by rendering `<Buddy cue={...}>` inside their own framed container.
 * Visual chrome (frames, vignettes, fallback art) stays the caller's
 * responsibility; this component owns the iframe lifecycle and message
 * protocol only.
 */

export interface BuddyCue {
  emotion: string;
  intensity?: number;
  gesture?: string | null;
  flashEmotion?: string;
  flashIntensity?: number;
}

interface BuddyProps {
  enabled?: boolean;
  avatar?: string;
  cue?: BuddyCue;
  cameraView?: string;
  transparent?: boolean;
  ttsLang?: string;
  ttsVoice?: string;
  className?: string;
  // Rendered until the iframe signals `ready`, and when it fails to load.
  fallback?: ReactNode;
  // Per-cue side-effects can be suppressed (e.g. reduce-motion gesture skip).
  reduceMotion?: boolean;
}

const DEFAULT_AVATAR = "/talkinghead/avatars/Olaf.glb";

export default function Buddy({
  enabled = true,
  avatar = DEFAULT_AVATAR,
  cue,
  cameraView = "full",
  transparent = true,
  ttsLang = "en-IN",
  ttsVoice = "en-IN-Neural2-A",
  className,
  fallback,
  reduceMotion = false,
}: BuddyProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const lastGestureKeyRef = useRef<string | null>(null);
  const emotionSettleTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams({
      avatarUrl: avatar,
      cameraView,
      transparent: transparent ? "1" : "0",
      ttsLang,
      ttsVoice,
      // The iframe disables secondary motion and its own gesture schedulers;
      // this complements the cue-level gesture skip below.
      reducedMotion: reduceMotion ? "1" : "0",
    });
    return `/talkinghead.html?${params.toString()}`;
  }, [avatar, cameraView, reduceMotion, transparent, ttsLang, ttsVoice]);

  const postToAvatar = useCallback((data: object) => {
    iframeRef.current?.contentWindow?.postMessage(data, window.location.origin);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const fallbackTimer = window.setTimeout(() => {
      if (!isReady) setLoadFailed(true);
    }, 8000);
    return () => window.clearTimeout(fallbackTimer);
  }, [enabled, isReady]);

  useEffect(() => {
    if (!enabled) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;

      const { type } = event.data || {};
      if (type === "needConfig") {
        postToAvatar({
          type: "config",
          googleKey: "",
          azureKey: "",
          azureRegion: "eastasia",
        });
      }
      if (type === "ready") {
        setIsReady(true);
        setLoadFailed(false);
      }
      if (type === "error") {
        setLoadFailed(true);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [enabled, postToAvatar]);

  useEffect(() => {
    if (!enabled || !isReady || loadFailed || !cue) return;

    if (emotionSettleTimerRef.current) {
      window.clearTimeout(emotionSettleTimerRef.current);
      emotionSettleTimerRef.current = null;
    }

    postToAvatar({
      type: "setEmotion",
      emotion: cue.flashEmotion ?? cue.emotion,
      intensity: cue.flashIntensity ?? cue.intensity ?? 1,
    });

    if (cue.flashEmotion) {
      emotionSettleTimerRef.current = window.setTimeout(() => {
        postToAvatar({
          type: "setEmotion",
          emotion: cue.emotion,
          intensity: cue.intensity ?? 1,
        });
        emotionSettleTimerRef.current = null;
      }, 720);
    }

    const gesture = reduceMotion ? null : cue.gesture ?? null;
    const gestureKey = `${cue.emotion}:${gesture ?? "none"}`;
    if (gesture && gestureKey !== lastGestureKeyRef.current) {
      lastGestureKeyRef.current = gestureKey;
      postToAvatar({ type: "triggerGesture", gesture });
    }
  }, [enabled, isReady, loadFailed, cue, postToAvatar, reduceMotion]);

  useEffect(
    () => () => {
      if (emotionSettleTimerRef.current) {
        window.clearTimeout(emotionSettleTimerRef.current);
      }
      postToAvatar({ type: "pause" });
    },
    [postToAvatar],
  );

  if (!enabled) return <>{fallback}</>;

  return (
    <>
      {!loadFailed && (
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title="MindGym buddy"
          className={`border-0 transition-opacity duration-500 ${isReady ? "opacity-100" : "opacity-0"} ${className ?? ""}`}
          allow="autoplay"
          sandbox="allow-scripts allow-same-origin"
          style={{ backgroundColor: "transparent" }}
        />
      )}
      {(!isReady || loadFailed) && fallback}
    </>
  );
}
