/**
 * useVoiceTurn — voice endpointing + presence-mode auto-listen for the chat
 * surface.
 *
 * Deliberately ONE hook, not separate endpointing/presence hooks: the silence
 * timer clearing also clears the presence start timer, the no-input timeout
 * writes presenceAutoListenPausedRef, and stopVoiceRecordingAndSend serves
 * both the half-pane and presence paths — the entanglement is real, so it
 * lives in one module instead of threading refs between two.
 *
 * Owns: the voice temp message bubble, all endpointing timers (silence /
 * no-input / max-duration / presence-start) and their refs, the presence
 * auto-listen loop, and the mic tap handlers. The orchestrator keeps
 * useVoiceRecording itself (composer props and debug output read it) plus
 * the pending voice-analysis refs consumed by the send pipeline, which it
 * receives through onVoiceResult.
 */

import {
    useEffect,
    useRef,
    useState,
    type Dispatch,
    type SetStateAction,
} from "react";

import type { useVoiceRecording, VoiceAnalysis } from "@/hooks/useVoiceRecording";
import { useLocalizedT } from "@/hooks/useLocalizedT";
import type { Message } from "../chatTypes";

const PRESENCE_START_DELAY_MS = 1400;
const NO_INPUT_TIMEOUT_MS = 10_000;
const END_OF_TURN_SILENCE_MS = 2200;
const SHORT_UTTERANCE_EXTRA_MS = 800;
const MAX_RECORDING_MS = 60_000;

const looksLikeIncompleteVoiceTurn = (text: string): boolean => {
    const trimmed = text.trim();
    if (trimmed.length < 18) return true;
    return /\b(and|but|because|so|then|like|matlab|ki|to|aur)$/i.test(trimmed);
};

export type MicState = "disabled" | "processing" | "listening" | "speaking" | "idle";

type VoiceRecordingApi = Pick<
    ReturnType<typeof useVoiceRecording>,
    | "isRecording"
    | "isProcessing"
    | "toggleRecording"
    | "cancelRecording"
    | "currentTranscript"
    | "hasTranscript"
    | "lastTranscriptAt"
>;

export function useVoiceTurn({
    recording,
    voiceSupported,
    isPresenceMode,
    isAvatarVisible,
    isLoading,
    avatarCurrentMessage,
    currentSessionId,
    setMessages,
    onVoiceResult,
    sendMessage,
}: {
    recording: VoiceRecordingApi;
    voiceSupported: boolean;
    isPresenceMode: boolean;
    isAvatarVisible: boolean;
    /** Orchestrator's request-in-flight flag. */
    isLoading: boolean;
    /** Current avatar utterance (truthy while Mitra is speaking). */
    avatarCurrentMessage: unknown;
    currentSessionId: string | null;
    setMessages: Dispatch<SetStateAction<Message[]>>;
    /** Hands the captured Azure analysis/audio to the send pipeline's pending refs. */
    onVoiceResult: (analysis: VoiceAnalysis | null, audioData: string | null) => void;
    sendMessage: (text: string) => Promise<void>;
}) {
    const {
        isRecording,
        isProcessing,
        toggleRecording,
        cancelRecording,
        currentTranscript,
        hasTranscript,
        lastTranscriptAt,
    } = recording;

    const { t: tSanctuary } = useLocalizedT();

    const [voiceTempMsgId, setVoiceTempMsgId] = useState<string | null>(null);
    const voiceSilenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const voiceNoInputTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const voiceMaxDurationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const presenceStartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTranscriptRef = useRef("");
    const hasTranscriptRef = useRef(false);
    const presenceAutoListenPausedRef = useRef(false);
    const wasPresenceModeRef = useRef(false);
    const isAutoStoppingRef = useRef(false);

    // Mirror the live transcript into the temp voice bubble while recording.
    useEffect(() => {
        if (isRecording && voiceTempMsgId && currentTranscript) {
            setMessages((msgs) =>
                msgs.map((m) =>
                    m.id === voiceTempMsgId
                        ? { ...m, content: currentTranscript || tSanctuary("chat.voice.recording") }
                        : m,
                ),
            );
        }
    }, [isRecording, currentTranscript, voiceTempMsgId, tSanctuary, setMessages]);

    useEffect(() => {
        hasTranscriptRef.current = hasTranscript;
    }, [hasTranscript]);

    useEffect(() => {
        if (isPresenceMode && !wasPresenceModeRef.current) {
            presenceAutoListenPausedRef.current = false;
        }
        if (!isPresenceMode) {
            presenceAutoListenPausedRef.current = false;
        }
        wasPresenceModeRef.current = isPresenceMode;
    }, [isPresenceMode]);

    const clearVoiceSilenceTimer = () => {
        if (voiceSilenceTimeoutRef.current) {
            clearTimeout(voiceSilenceTimeoutRef.current);
            voiceSilenceTimeoutRef.current = null;
        }
        if (voiceNoInputTimeoutRef.current) {
            clearTimeout(voiceNoInputTimeoutRef.current);
            voiceNoInputTimeoutRef.current = null;
        }
        if (voiceMaxDurationTimeoutRef.current) {
            clearTimeout(voiceMaxDurationTimeoutRef.current);
            voiceMaxDurationTimeoutRef.current = null;
        }
        if (presenceStartTimeoutRef.current) {
            clearTimeout(presenceStartTimeoutRef.current);
            presenceStartTimeoutRef.current = null;
        }
    };

    const clearVoiceTempMessage = () => {
        if (voiceTempMsgId) {
            setMessages((msgs) => msgs.filter((m) => m.id !== voiceTempMsgId));
            setVoiceTempMsgId(null);
        }
    };

    const stopVoiceRecordingAndSend = async () => {
        if (!isRecording || isAutoStoppingRef.current) return;
        isAutoStoppingRef.current = true;
        try {
            const result = await toggleRecording(
                currentSessionId || undefined,
                voiceTempMsgId || undefined,
            );
            clearVoiceTempMessage();
            if (result?.transcript) {
                onVoiceResult(result.voiceAnalysis || null, result.audioData || null);
                await sendMessage(result.transcript);
                onVoiceResult(null, null);
            }
        } finally {
            isAutoStoppingRef.current = false;
            clearVoiceSilenceTimer();
            lastTranscriptRef.current = "";
        }
    };

    // Voice endpointing: wait longer for short/incomplete utterances, but do
    // not leave the mic open indefinitely if the user says nothing.
    useEffect(() => {
        if (!isRecording) {
            clearVoiceSilenceTimer();
            lastTranscriptRef.current = "";
            return;
        }

        voiceMaxDurationTimeoutRef.current = setTimeout(() => {
            stopVoiceRecordingAndSend();
        }, MAX_RECORDING_MS);

        voiceNoInputTimeoutRef.current = setTimeout(() => {
            if (!hasTranscriptRef.current) {
                presenceAutoListenPausedRef.current = isPresenceMode;
                stopVoiceRecordingAndSend();
            }
        }, NO_INPUT_TIMEOUT_MS);

        return () => {
            clearVoiceSilenceTimer();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRecording]);

    useEffect(() => {
        if (hasTranscript && voiceNoInputTimeoutRef.current) {
            clearTimeout(voiceNoInputTimeoutRef.current);
            voiceNoInputTimeoutRef.current = null;
        }
    }, [hasTranscript]);

    useEffect(() => {
        const voiceLoopActive = isRecording && (isAvatarVisible || isPresenceMode);
        if (!voiceLoopActive) {
            if (voiceSilenceTimeoutRef.current) {
                clearTimeout(voiceSilenceTimeoutRef.current);
                voiceSilenceTimeoutRef.current = null;
            }
            return;
        }
        const transcript = currentTranscript.trim();
        if (!transcript || transcript === lastTranscriptRef.current) return;

        lastTranscriptRef.current = transcript;
        if (voiceSilenceTimeoutRef.current) {
            clearTimeout(voiceSilenceTimeoutRef.current);
            voiceSilenceTimeoutRef.current = null;
        }

        const delay =
            END_OF_TURN_SILENCE_MS +
            (looksLikeIncompleteVoiceTurn(transcript) ? SHORT_UTTERANCE_EXTRA_MS : 0);
        voiceSilenceTimeoutRef.current = setTimeout(() => {
            stopVoiceRecordingAndSend();
        }, delay);

        return () => {
            if (voiceSilenceTimeoutRef.current) {
                clearTimeout(voiceSilenceTimeoutRef.current);
                voiceSilenceTimeoutRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRecording, isAvatarVisible, isPresenceMode, currentTranscript, lastTranscriptAt, currentSessionId, voiceTempMsgId]);

    useEffect(() => {
        return () => {
            clearVoiceSilenceTimer();
        };
    }, []);

    /**
     * Voice handler dedicated to Presence Mode: no temp bubble (the overlay
     * shows the interim transcript itself), and un-pauses auto-listen.
     */
    const handlePresenceMicTap = async () => {
        if (!voiceSupported) return;
        try {
            if (isRecording) {
                await stopVoiceRecordingAndSend();
            } else if (isProcessing || isLoading || avatarCurrentMessage) {
                // No automatic barge-in yet: don't start STT while Mitra is
                // thinking or speaking, because TTS cancellation is separate.
                return;
            } else {
                clearVoiceSilenceTimer();
                lastTranscriptRef.current = "";
                presenceAutoListenPausedRef.current = false;
                await toggleRecording(currentSessionId || undefined, undefined);
            }
        } catch (err) {
            console.error("❌ [Presence] Mic tap error:", err);
        }
    };

    /**
     * Derive a single MicState for the FAB. Order matters — `processing`
     * must trump `speaking` so the loader doesn't disappear while the
     * round-trip is still mid-flight.
     */
    const micState: MicState = (() => {
        if (!voiceSupported) return "disabled" as const;
        if (isProcessing || (isLoading && !avatarCurrentMessage)) return "processing" as const;
        if (isRecording) return "listening" as const;
        if (avatarCurrentMessage) return "speaking" as const;
        return "idle" as const;
    })();

    /**
     * Presence Mode auto-listen. Starts on entry and after each avatar turn,
     * but only when the UI is genuinely idle and the prior no-input turn did
     * not pause auto-listening.
     */
    useEffect(() => {
        if (
            !isPresenceMode ||
            !voiceSupported ||
            isRecording ||
            isProcessing ||
            isLoading ||
            avatarCurrentMessage ||
            presenceAutoListenPausedRef.current
        ) {
            if (presenceStartTimeoutRef.current) {
                clearTimeout(presenceStartTimeoutRef.current);
                presenceStartTimeoutRef.current = null;
            }
            return;
        }

        presenceStartTimeoutRef.current = setTimeout(() => {
            presenceStartTimeoutRef.current = null;
            if (
                isPresenceMode &&
                voiceSupported &&
                !isRecording &&
                !isProcessing &&
                !isLoading &&
                !avatarCurrentMessage &&
                !presenceAutoListenPausedRef.current
            ) {
                clearVoiceSilenceTimer();
                lastTranscriptRef.current = "";
                toggleRecording(currentSessionId || undefined, undefined).catch((err) => {
                    console.error("❌ [Presence] Auto-start failed:", err);
                });
            }
        }, PRESENCE_START_DELAY_MS);

        return () => {
            if (presenceStartTimeoutRef.current) {
                clearTimeout(presenceStartTimeoutRef.current);
                presenceStartTimeoutRef.current = null;
            }
        };
    }, [isPresenceMode, voiceSupported, isRecording, isProcessing, isLoading, avatarCurrentMessage, currentSessionId, toggleRecording]);

    useEffect(() => {
        if (isPresenceMode) return;
        // If user is exiting and we're still recording, cancel cleanly — don't
        // auto-send half a sentence the user didn't intend to be heard.
        clearVoiceSilenceTimer();
        isAutoStoppingRef.current = false;
        if (isRecording) {
            try {
                cancelRecording();
            } catch (err) {
                console.warn("⚠️ [Presence] cancelRecording on exit failed:", err);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPresenceMode]);

    const handleVoiceInput = async () => {
        try {
            if (isRecording) {
                await stopVoiceRecordingAndSend();
            } else if (isProcessing || isLoading || avatarCurrentMessage) {
                return;
            } else {
                clearVoiceSilenceTimer();
                lastTranscriptRef.current = "";
                const tempId = `voice-${Date.now()}`;
                setVoiceTempMsgId(tempId);
                setMessages((msgs) => [
                    ...msgs,
                    {
                        id: tempId,
                        content: tSanctuary("chat.voice.recording"),
                        sender: "user",
                        timestamp: new Date(),
                    },
                ]);
                await toggleRecording(currentSessionId, tempId);
            }
        } catch (error) {
            console.error("❌ [UI] Voice input error:", error);
        }
    };

    return { handleVoiceInput, handlePresenceMicTap, micState };
}
