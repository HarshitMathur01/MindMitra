import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadAzureSpeechSDK } from "@/lib/azureSpeechLoader";
import { voiceForLocale } from "@/lib/locale";

interface UseAzureNarrationOptions {
    voiceName?: string;
    language?: string;
    role?: string;
    style?: string;
}

interface UseAzureNarrationReturn {
    isSupported: boolean;
    isSpeaking: boolean;
    error: string | null;
    speak: (text: string) => Promise<boolean>;
    cancel: () => void;
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function buildSsml(
    text: string,
    options: Required<Pick<UseAzureNarrationOptions, "voiceName" | "language">> & UseAzureNarrationOptions,
): string {
    const voiceAttrs = [
        `name="${options.voiceName}"`,
    ];
    const expressAttrs = [
        options.style ? `style="${options.style}"` : "",
        options.role ? `role="${options.role}"` : "",
    ].filter(Boolean).join(" ");

    const innerText = escapeXml(text);
    const expressOpen = expressAttrs ? `<mstts:express-as ${expressAttrs}>` : "";
    const expressClose = expressAttrs ? "</mstts:express-as>" : "";

    return [
        `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="${options.language}">`,
        `<voice ${voiceAttrs.join(" ")}>`,
        `${expressOpen}${innerText}${expressClose}`,
        `</voice>`,
        `</speak>`,
    ].join("");
}

export function useAzureNarration(
    options: UseAzureNarrationOptions = {},
): UseAzureNarrationReturn {
    const azureKey = import.meta.env.VITE_AZURE_TTS_KEY;
    const azureRegion = import.meta.env.VITE_AZURE_TTS_REGION || "eastasia";
    const defaultVoice = voiceForLocale("english");
    const voiceName = options.voiceName || defaultVoice.ttsVoice;
    const language = options.language || defaultVoice.ttsLang;
    const role = options.role || "Girl";
    const style = options.style || "whispering";

    const [isSpeaking, setIsSpeaking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const synthesizerRef = useRef<any>(null);
    const requestIdRef = useRef(0);

    const cancel = useCallback(() => {
        requestIdRef.current += 1;

        const synthesizer = synthesizerRef.current;
        if (synthesizer) {
            try {
                synthesizer.close();
            } catch {
                // ignore close failures on teardown
            }
            synthesizerRef.current = null;
        }

        setIsSpeaking(false);
    }, []);

    useEffect(() => () => cancel(), [cancel]);

    const speak = useCallback(
        async (text: string) => {
            const utterance = text.trim();
            if (!utterance) return false;

            if (!azureKey || typeof window === "undefined") {
                setError("Azure TTS key is not configured.");
                return false;
            }

            cancel();

            const requestId = requestIdRef.current;
            setError(null);
            setIsSpeaking(true);

            try {
                const SpeechSDK = await loadAzureSpeechSDK();
                if (requestId !== requestIdRef.current) return false;

                const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(azureKey, azureRegion);
                speechConfig.speechSynthesisVoiceName = voiceName;
                speechConfig.speechSynthesisLanguage = language;
                speechConfig.speechSynthesisOutputFormat =
                    SpeechSDK.SpeechSynthesisOutputFormat.Audio24Khz96KBitRateMonoMp3;

                const attemptSpeak = async (useSsml: boolean): Promise<boolean> => {
                    const audioConfig = SpeechSDK.AudioConfig.fromDefaultSpeakerOutput();
                    const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, audioConfig);
                    synthesizerRef.current = synthesizer;

                    const ssml = buildSsml(utterance, { voiceName, language, role, style });
                    const finalizeSynthesizer = () => {
                        if (synthesizerRef.current === synthesizer) {
                            synthesizerRef.current = null;
                        }

                        try {
                            synthesizer.close();
                        } catch {
                            // ignore close failures after playback or cancellation
                        }
                    };

                    return await new Promise<boolean>((resolve) => {
                        const settle = (success: boolean, message?: string) => {
                            finalizeSynthesizer();

                            if (requestId !== requestIdRef.current) {
                                resolve(false);
                                return;
                            }

                            setIsSpeaking(false);
                            if (!success && message) setError(message);
                            resolve(success);
                        };

                        const handleSuccess = (result: any) => {
                            if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
                                settle(true);
                                return;
                            }

                            if (useSsml) {
                                if (requestId !== requestIdRef.current) {
                                    finalizeSynthesizer();
                                    resolve(false);
                                    return;
                                }
                                finalizeSynthesizer();
                                void attemptSpeak(false).then(resolve);
                                return;
                            }

                            settle(false, result.errorDetails || "Azure narration could not be synthesized.");
                        };

                        const handleError = (err: unknown) => {
                            if (useSsml) {
                                if (requestId !== requestIdRef.current) {
                                    finalizeSynthesizer();
                                    resolve(false);
                                    return;
                                }
                                finalizeSynthesizer();
                                void attemptSpeak(false).then(resolve);
                                return;
                            }

                            settle(false, err instanceof Error ? err.message : "Azure narration failed.");
                        };

                        if (useSsml) {
                            synthesizer.speakSsmlAsync(ssml, handleSuccess, handleError);
                        } else {
                            synthesizer.speakTextAsync(utterance, handleSuccess, handleError);
                        }
                    });
                };

                return await attemptSpeak(true);
            } catch (err) {
                if (requestId === requestIdRef.current) {
                    setIsSpeaking(false);
                    setError(err instanceof Error ? err.message : "Azure narration failed.");
                }
                return false;
            }
        },
        [azureKey, azureRegion, cancel, language, voiceName],
    );

    return useMemo(
        () => ({
            isSupported: Boolean(azureKey),
            isSpeaking,
            error,
            speak,
            cancel,
        }),
        [azureKey, cancel, error, isSpeaking, speak],
    );
}