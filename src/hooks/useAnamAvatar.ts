/**
 * useAnamAvatar — manages the full Anam AI avatar lifecycle for MindMitra.
 *
 * ─── PIPELINE MODES ──────────────────────────────────────────────────────────
 *
 * Controlled by VITE_ANAM_PIPELINE_MODE (set in frontend .env):
 *
 *  false (default) — "MindMitra Backend Pipeline"
 *    User mic → Azure STT → FastAPI /chat (MindMitra LLM)
 *      → addAvatarMessage() → speakWithAnam()
 *      → Azure TTS (Raw16Khz16BitMonoPcm) → AgentAudioInputStream → Anam lipsync only
 *    Anam's own STT/LLM/TTS is MUTED via muteInputAudio() immediately after connect.
 *    Memory + chat history work normally through the existing /chat pipeline.
 *
 *  true — "Anam Pipeline Mode"
 *    User mic → Anam's WebRTC STT → Anam LLM → Anam TTS (Anam speaks directly)
 *    On MESSAGE_HISTORY_UPDATED: `onAnamTurn(userText, agentText)` fires so the
 *    parent can inject messages into the chat UI and persist them to Supabase.
 *    MindMitra's LLM pipeline is NOT called. speakWithAnam() is a no-op.
 *
 * ─── SDK v4 Audio Passthrough API (MindMitra pipeline mode) ──────────────────
 *   client.createAgentAudioInputStream({ encoding: 'pcm_s16le', sampleRate: 16000, channels: 1 })
 *   → stream.sendAudioChunk(Uint8Array)   (call as PCM arrives from Azure TTS)
 *   → stream.endSequence()               (call when utterance is complete)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, AnamEvent, type AnamClient } from "@anam-ai/js-sdk";
import type { AgentAudioInputStream, Message as AnamMessage } from "@anam-ai/js-sdk";
import { loadAzureSpeechSDK } from "@/lib/azureSpeechLoader";

// ─── Constants ────────────────────────────────────────────────────────────────

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim() ?? "";
const AZURE_KEY    = import.meta.env.VITE_AZURE_TTS_KEY as string | undefined;
const AZURE_REGION = (import.meta.env.VITE_AZURE_TTS_REGION as string | undefined) ?? "eastus";

/**
 * Feature flag: true → Anam handles LLM/TTS; false (default) → MindMitra backend.
 * Parsed once at module load — change in .env + page reload to toggle.
 */
export const ANAM_PIPELINE_MODE: boolean =
    import.meta.env.VITE_ANAM_PIPELINE_MODE === "true" ||
    import.meta.env.VITE_ANAM_PIPELINE_MODE === "1";

// Azure TTS voice for MindMitra pipeline mode lipsync.
const ANAM_TTS_VOICE = "en-IN-NeerjaNeural";
const ANAM_TTS_LANG  = "en-IN";

// Session token cache (55 min — Anam tokens are valid ~60 min)
let _cachedToken: string | null = null;
let _tokenExpiresAt = 0;
const TOKEN_CACHE_MS = 55 * 60 * 1000;

// ─── Token helpers ────────────────────────────────────────────────────────────

async function fetchSessionToken(supabaseJwt: string): Promise<string> {
    const now = Date.now();
    if (_cachedToken && now < _tokenExpiresAt) return _cachedToken;

    const res = await fetch(`${BACKEND_URL}/anam/session-token`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${supabaseJwt}`,
            "Content-Type": "application/json",
        },
    });

    if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Anam session-token fetch failed (${res.status}): ${detail}`);
    }

    const data = (await res.json()) as { sessionToken: string };
    _cachedToken = data.sessionToken;
    _tokenExpiresAt = now + TOKEN_CACHE_MS;
    return _cachedToken;
}

function invalidateTokenCache() {
    _cachedToken = null;
    _tokenExpiresAt = 0;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface UseAnamAvatarOptions {
    /** Supabase access_token for authenticating backend requests. */
    supabaseJwt: string | null;
    /** HTML `id` of the <video> element Anam renders into. */
    videoElementId: string;
    /** Called when the avatar finishes playing the current message (MindMitra mode). */
    onMessagePlayed: () => void;
    /**
     * Called in Anam pipeline mode when a complete user→agent turn is detected.
     * The parent should use this to inject messages into the chat UI and
     * persist them to Supabase — MindMitra's LLM is NOT called.
     */
    onAnamTurn?: (userText: string, agentText: string) => void;
}

export interface UseAnamAvatarReturn {
    isReady: boolean;
    isSpeaking: boolean;
    error: string | null;
    /** Active pipeline: 'anam' (Anam LLM) or 'mindmitra' (MindMitra backend). */
    pipelineMode: "anam" | "mindmitra";
    /** Synthesise text via Azure TTS and drive Anam lipsync (MindMitra mode only). */
    speakWithAnam: (text: string) => Promise<void>;
    /** Immediately stop lipsync / Azure TTS (barge-in). Works in both modes. */
    interruptAnam: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAnamAvatar({
    supabaseJwt,
    videoElementId,
    onMessagePlayed,
    onAnamTurn,
}: UseAnamAvatarOptions): UseAnamAvatarReturn {
    const [isReady,    setIsReady]    = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [error,      setError]      = useState<string | null>(null);

    const clientRef       = useRef<AnamClient | null>(null);
    const audioStreamRef  = useRef<AgentAudioInputStream | null>(null);
    const mountedRef      = useRef(true);
    const speakAbortRef   = useRef<AbortController | null>(null);
    const synthesizerRef  = useRef<any>(null);
    const onAnamTurnRef   = useRef(onAnamTurn);
    const lastHistoryRef  = useRef<AnamMessage[]>([]);

    // Keep callback ref fresh so the Anam event listener always calls latest version
    useEffect(() => { onAnamTurnRef.current = onAnamTurn; }, [onAnamTurn]);

    // ── Cleanup on unmount ────────────────────────────────────────────────────
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            speakAbortRef.current?.abort();
            try { synthesizerRef.current?.close(); } catch { /* ignore */ }
            if (clientRef.current) {
                clientRef.current.stopStreaming().catch(() => { /* ignore */ });
                clientRef.current = null;
            }
        };
    }, []);

    // ── Initialise Anam client ────────────────────────────────────────────────
    useEffect(() => {
        if (!supabaseJwt) return;

        let cancelled = false;

        const init = async () => {
            try {
                setError(null);
                const token = await fetchSessionToken(supabaseJwt);
                if (cancelled || !mountedRef.current) return;

                if (clientRef.current) {
                    await clientRef.current.stopStreaming().catch(() => {});
                    clientRef.current = null;
                }

                const client = createClient(token);
                clientRef.current = client;

                if (ANAM_PIPELINE_MODE) {
                    // ── Anam pipeline: listen for completed turns ────────────
                    // MESSAGE_HISTORY_UPDATED fires after every complete turn with
                    // the full conversation as Message[].
                    // We diff against the previous snapshot to find new user→persona
                    // pairs and surface them via onAnamTurn().
                    client.addListener(
                        AnamEvent.MESSAGE_HISTORY_UPDATED,
                        (messages: AnamMessage[]) => {
                            if (!mountedRef.current) return;
                            const prev = lastHistoryRef.current;
                            const newMsgs = messages.slice(prev.length);
                            lastHistoryRef.current = messages;

                            for (let i = 0; i < newMsgs.length - 1; i++) {
                                const m0 = newMsgs[i];
                                const m1 = newMsgs[i + 1];
                                if (
                                    m0.role === "user" &&
                                    m1.role === "persona" &&
                                    !m1.interrupted
                                ) {
                                    console.info(
                                        `[AnamAvatar] 📝 Anam turn complete: "${m0.content.slice(0, 40)}…"`,
                                    );
                                    onAnamTurnRef.current?.(m0.content, m1.content);
                                    i++; // consumed the persona message too
                                }
                            }
                        },
                    );
                    console.info("[AnamAvatar] 🔊 Anam Pipeline Mode — Anam LLM/TTS active");
                }

                await client.streamToVideoElement(videoElementId);

                if (!ANAM_PIPELINE_MODE) {
                    // ── MindMitra mode: silence Anam's mic ───────────────────
                    // Without this, Anam's WebRTC captures the user mic and runs
                    // Anam's own STT → LLM → TTS, overriding MindMitra's responses.
                    client.muteInputAudio();
                    console.info("[AnamAvatar] 🔇 Anam mic muted — MindMitra pipeline only");
                }

                if (!cancelled && mountedRef.current) {
                    setIsReady(true);
                    console.info(
                        `[AnamAvatar] ✅ WebRTC active → #${videoElementId} | mode=${ANAM_PIPELINE_MODE ? "anam" : "mindmitra"}`,
                    );
                }
            } catch (err) {
                if (cancelled) return;
                const msg = err instanceof Error ? err.message : String(err);
                console.error("[AnamAvatar] ❌ Init failed:", msg);
                invalidateTokenCache();
                if (mountedRef.current) {
                    setError(msg);
                    setIsReady(false);
                }
            }
        };

        void init();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [supabaseJwt]);

    // ── speakWithAnam: Azure TTS (PCM) → AgentAudioInputStream → lipsync ─────
    // MindMitra pipeline mode only. In Anam pipeline mode Anam speaks itself —
    // this is a deliberate no-op that just unblocks the queue.
    const speakWithAnam = useCallback(async (text: string) => {
        if (ANAM_PIPELINE_MODE) {
            // Anam handles voice — we have nothing to do here.
            onMessagePlayed();
            return;
        }

        const client = clientRef.current;
        if (!isReady || !client) {
            console.warn("[AnamAvatar] speakWithAnam called before ready — ignoring");
            return;
        }
        if (!text.trim()) { onMessagePlayed(); return; }
        if (!AZURE_KEY) {
            console.error("[AnamAvatar] VITE_AZURE_TTS_KEY is not set");
            onMessagePlayed();
            return;
        }

        speakAbortRef.current?.abort();
        const abort = new AbortController();
        speakAbortRef.current = abort;
        try { synthesizerRef.current?.close(); } catch { /* ignore */ }
        try { audioStreamRef.current?.endSequence(); } catch { /* ignore */ }
        audioStreamRef.current = null;

        setIsSpeaking(true);

        try {
            const SpeechSDK = await loadAzureSpeechSDK();
            if (abort.signal.aborted || !mountedRef.current) return;

            const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(AZURE_KEY, AZURE_REGION);
            speechConfig.speechSynthesisVoiceName = ANAM_TTS_VOICE;
            speechConfig.speechSynthesisLanguage  = ANAM_TTS_LANG;
            speechConfig.speechSynthesisOutputFormat =
                SpeechSDK.SpeechSynthesisOutputFormat.Raw16Khz16BitMonoPcm;

            const anamStream = client.createAgentAudioInputStream({
                encoding: "pcm_s16le",
                sampleRate: 16000,
                channels: 1,
            });
            audioStreamRef.current = anamStream;

            const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, null);
            synthesizerRef.current = synthesizer;

            await new Promise<void>((resolve, reject) => {
                synthesizer.synthesizing = (_sender: unknown, e: any) => {
                    if (abort.signal.aborted) return;
                    const audioData: ArrayBuffer | undefined = e.result?.audioData;
                    if (!audioData || audioData.byteLength === 0) return;
                    try {
                        anamStream.sendAudioChunk(new Uint8Array(audioData));
                    } catch (sendErr) {
                        console.warn("[AnamAvatar] sendAudioChunk error:", sendErr);
                    }
                };

                synthesizer.speakTextAsync(
                    text,
                    (result: any) => {
                        synthesizer.close();
                        synthesizerRef.current = null;
                        if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
                            resolve();
                        } else {
                            reject(new Error(result.errorDetails ?? "Azure TTS failed"));
                        }
                    },
                    (err: unknown) => {
                        synthesizer.close();
                        synthesizerRef.current = null;
                        reject(err instanceof Error ? err : new Error(String(err)));
                    },
                );
            });

            if (!abort.signal.aborted) {
                try { anamStream.endSequence(); } catch { /* ignore */ }
                audioStreamRef.current = null;
            }

            if (!abort.signal.aborted && mountedRef.current) {
                setIsSpeaking(false);
                onMessagePlayed();
            }
        } catch (err) {
            if (abort.signal.aborted) return;
            const msg = err instanceof Error ? err.message : String(err);
            console.error("[AnamAvatar] ❌ TTS error:", msg);
            if (mountedRef.current) {
                setIsSpeaking(false);
                onMessagePlayed();
            }
        }
    }, [isReady, onMessagePlayed]);

    // ── interruptAnam ─────────────────────────────────────────────────────────
    const interruptAnam = useCallback(() => {
        speakAbortRef.current?.abort();
        speakAbortRef.current = null;
        try { synthesizerRef.current?.close(); } catch { /* ignore */ }
        synthesizerRef.current = null;
        try { audioStreamRef.current?.endSequence(); } catch { /* ignore */ }
        audioStreamRef.current = null;
        if (clientRef.current) {
            try { clientRef.current.interruptPersona(); } catch { /* ignore */ }
        }
        setIsSpeaking(false);
    }, []);

    return {
        isReady,
        isSpeaking,
        error,
        pipelineMode: ANAM_PIPELINE_MODE ? "anam" : "mindmitra",
        speakWithAnam,
        interruptAnam,
    };
}
