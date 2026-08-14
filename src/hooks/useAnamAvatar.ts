/**
 * useAnamAvatar — manages the full Anam AI avatar lifecycle for MindMitra.
 *
 * ─── PIPELINE MODES ──────────────────────────────────────────────────────────
 *
 * Controlled by VITE_ANAM_PIPELINE_MODE (set in frontend .env):
 *
 *  false — "MindMitra Backend Pipeline"
 *    User mic → Azure STT → FastAPI /chat (MindMitra LLM)
 *      → addAvatarMessage() → speakWithAnam()
 *      → Azure TTS (Raw16Khz16BitMonoPcm) → AgentAudioInputStream → Anam lipsync only
 *    Anam's own STT/LLM/TTS is MUTED via muteInputAudio() immediately after connect.
 *    Memory + chat history work normally through the existing /chat pipeline.
 *    NOTE: the session token minted by GET /anam/session-token now carries a
 *    full persona (LLM included), so this mode relies on muteInputAudio() alone
 *    to keep Anam's brain out of the conversation.
 *
 *  true — "Anam Pipeline Mode" (turnkey)
 *    User mic → Anam's WebRTC STT → Anam LLM → Anam TTS (Anam speaks directly)
 *    On MESSAGE_HISTORY_UPDATED: `onAnamTurn(userText, agentText)` fires so the
 *    parent can inject messages into the chat UI and persist them to Supabase.
 *    MindMitra's LLM pipeline is NOT called. speakWithAnam() is a no-op.
 *
 * ─── CRISIS INTERCEPTOR (turnkey mode only) ──────────────────────────────────
 *
 * Turnkey mode takes MindMitra's crisis_bypass off the turn, which would break
 * the invariant that crisis replies are fixed clinician-reviewed templates and
 * never LLM-generated. To put it back, every new user utterance is POSTed to
 * /anam/crisis-check the instant it lands — on the user-only history update,
 * while Anam is still composing its own answer. On a tier-3 result we call
 * interruptPersona() and make the avatar speak the template verbatim via
 * talk(). Screening runs in parallel with Anam's reply, so the normal path
 * costs nothing; a crisis simply cuts the persona off mid-sentence.
 *
 * ─── SDK v4 Audio Passthrough API (MindMitra pipeline mode) ──────────────────
 *   client.createAgentAudioInputStream({ encoding: 'pcm_s16le', sampleRate: 16000, channels: 1 })
 *   → stream.sendAudioChunk(Uint8Array)   (call as PCM arrives from Azure TTS)
 *   → stream.endSequence()               (call when utterance is complete)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, AnamEvent, ConnectionClosedCode, type AnamClient } from "@anam-ai/js-sdk";
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

// Must match avatar.session.heartbeat_interval_seconds in config.yaml — the
// backend clamps a single heartbeat's debit to 2x this, so drifting the two
// apart either under-counts real usage or lets a heartbeat get clipped.
const HEARTBEAT_INTERVAL_MS = 15_000;

/** Thrown by fetchSessionToken on 429 — the daily quota is used up. Handled
 *  distinctly from a generic connection error: it is not "something broke",
 *  it is an expected, user-facing state with its own UI (see AnamAvatar.tsx). */
class AnamQuotaExhaustedError extends Error {}

interface SessionTokenResponse {
    sessionToken: string;
    remainingSeconds: number;
    maxSessionLengthSeconds: number;
}

// ─── Token helpers ────────────────────────────────────────────────────────────
//
// NOTE: session tokens are intentionally NOT cached client-side. Each token
// bakes in a `maxSessionLengthSeconds` clamped to the caller's remaining daily
// Anam quota (see /anam/session-token) — a stale cached token would hand out a
// stale (too-generous) session length once quota has been partially spent.
// Anam's own backend also treats these as per-session, not reusable
// (app/api/avatar.py deliberately does not cache them for the same reason).

async function fetchSessionToken(supabaseJwt: string, language?: string): Promise<SessionTokenResponse> {
    const query = language ? `?language=${encodeURIComponent(language)}` : "";
    const res = await fetch(`${BACKEND_URL}/anam/session-token${query}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${supabaseJwt}`,
            "Content-Type": "application/json",
        },
    });

    if (res.status === 429) {
        throw new AnamQuotaExhaustedError("Daily avatar video limit reached.");
    }
    if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Anam session-token fetch failed (${res.status}): ${detail}`);
    }

    const data = (await res.json()) as SessionTokenResponse;
    return data;
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
    /** Backend session id, forwarded to /anam/crisis-check so screening shares
     *  the same Redis session (and therefore the same urgency history) as chat. */
    sessionId?: string | null;
    /**
     * Fired when /anam/crisis-check returns tier 3. The avatar has already been
     * interrupted and is speaking `content`; the parent should surface the same
     * text in the chat UI. `content` is a clinician-reviewed template — render
     * it verbatim, never summarise or rewrite it.
     */
    onCrisis?: (content: string, crisisNumbers: string[]) => void;
    /**
     * BCP-47 tag (e.g. `hi-IN`) seeding what Anam expects to *hear*. Fixed for
     * the life of the session — changing it re-mints the token and restarts the
     * stream. Mid-conversation switching is the persona's job via the
     * change_language system tool.
     */
    language?: string;
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
    /**
     * Seconds left in today's (IST) daily Anam video quota, as of the last
     * mint or heartbeat. `null` until the first session-token response lands.
     */
    remainingSeconds: number | null;
    /** True once the daily quota hit zero — either at mint (no session was
     *  opened) or mid-session (a heartbeat reported zero and the stream was
     *  stopped). Distinct from `error`: this is an expected, user-facing
     *  state, not a failure. */
    quotaExhausted: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAnamAvatar({
    supabaseJwt,
    videoElementId,
    onMessagePlayed,
    onAnamTurn,
    sessionId,
    onCrisis,
    language,
}: UseAnamAvatarOptions): UseAnamAvatarReturn {
    const [isReady,    setIsReady]    = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [error,      setError]      = useState<string | null>(null);
    const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
    const [quotaExhausted,   setQuotaExhausted]   = useState(false);

    const clientRef       = useRef<AnamClient | null>(null);
    const audioStreamRef  = useRef<AgentAudioInputStream | null>(null);
    const mountedRef      = useRef(true);
    const speakAbortRef   = useRef<AbortController | null>(null);
    const synthesizerRef  = useRef<any>(null);
    const onAnamTurnRef   = useRef(onAnamTurn);
    const onCrisisRef     = useRef(onCrisis);
    const sessionIdRef    = useRef(sessionId);
    const jwtRef          = useRef(supabaseJwt);
    const lastHistoryRef  = useRef<AnamMessage[]>([]);
    const screenedIdsRef  = useRef<Set<string>>(new Set());
    const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const quotaExhaustedRef = useRef(false);

    // Keep refs fresh so the Anam event listener always calls latest version
    useEffect(() => { onAnamTurnRef.current = onAnamTurn; }, [onAnamTurn]);
    useEffect(() => { onCrisisRef.current   = onCrisis;   }, [onCrisis]);
    useEffect(() => { sessionIdRef.current  = sessionId;  }, [sessionId]);
    useEffect(() => { jwtRef.current        = supabaseJwt; }, [supabaseJwt]);
    useEffect(() => { quotaExhaustedRef.current = quotaExhausted; }, [quotaExhausted]);

    const stopHeartbeat = useCallback(() => {
        if (heartbeatTimerRef.current) {
            clearInterval(heartbeatTimerRef.current);
            heartbeatTimerRef.current = null;
        }
    }, []);

    // ── Heartbeat: debit real elapsed video time against the daily quota ─────
    // Carries no duration — the backend computes elapsed time itself from a
    // server-side timestamp anchored at mint, so this call cannot be used to
    // inflate the remaining balance. See app/services/anam_quota.py.
    const sendHeartbeat = useCallback(async () => {
        const jwt = jwtRef.current;
        if (!jwt) return;
        try {
            const res = await fetch(`${BACKEND_URL}/anam/heartbeat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${jwt}`,
                },
                body: JSON.stringify({ session_id: sessionIdRef.current ?? null }),
            });
            if (!res.ok) {
                console.warn(`[AnamAvatar] heartbeat ${res.status} — continuing`);
                return;
            }
            const data = (await res.json()) as { remaining_seconds: number; exhausted: boolean };
            if (!mountedRef.current) return;
            setRemainingSeconds(data.remaining_seconds);
            if (data.exhausted) {
                console.warn("[AnamAvatar] ⏱️ daily video quota exhausted — stopping session");
                stopHeartbeat();
                quotaExhaustedRef.current = true; // set synchronously — CONNECTION_CLOSED can fire before the state update above flushes
                setQuotaExhausted(true);
                setIsReady(false);
                clientRef.current?.stopStreaming().catch(() => { /* ignore */ });
            }
        } catch (err) {
            console.warn("[AnamAvatar] heartbeat failed — continuing:", err);
        }
    }, [stopHeartbeat]);

    const sendHeartbeatRef = useRef(sendHeartbeat);
    useEffect(() => { sendHeartbeatRef.current = sendHeartbeat; }, [sendHeartbeat]);

    const startHeartbeat = useCallback(() => {
        stopHeartbeat();
        heartbeatTimerRef.current = setInterval(() => { void sendHeartbeatRef.current(); }, HEARTBEAT_INTERVAL_MS);
    }, [stopHeartbeat]);

    // ── Crisis screening (turnkey mode) ───────────────────────────────────────
    // Runs against MindMitra's own crisis_bypass. Deliberately fail-open: a
    // network blip must not fire the helpline script at a student who is fine.
    // The backend applies the same policy.
    const screenForCrisis = useCallback(async (message: AnamMessage) => {
        const text = (message.content ?? "").trim();
        const jwt = jwtRef.current;
        if (!text || !jwt) return;

        try {
            const res = await fetch(`${BACKEND_URL}/anam/crisis-check`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${jwt}`,
                },
                body: JSON.stringify({
                    user_message: text,
                    session_id: sessionIdRef.current ?? null,
                }),
            });
            if (!res.ok) {
                console.warn(`[AnamAvatar] crisis-check ${res.status} — continuing`);
                return;
            }

            const data = (await res.json()) as {
                crisis: boolean;
                content?: string | null;
                crisis_numbers?: string[];
            };
            if (!data.crisis || !data.content) return;
            if (!mountedRef.current) return;

            const client = clientRef.current;
            if (!client) return;

            // Cut the persona off wherever it is, then say the template. The
            // template text is never paraphrased and never passes through an LLM.
            console.warn("[AnamAvatar] 🚨 crisis detected — interrupting persona");
            try { client.interruptPersona(); } catch { /* already silent */ }
            void client.talk(data.content).catch((err) =>
                console.error("[AnamAvatar] crisis talk() failed:", err),
            );
            onCrisisRef.current?.(data.content, data.crisis_numbers ?? []);
        } catch (err) {
            console.warn("[AnamAvatar] crisis-check failed (fail-open):", err);
        }
    }, []);

    const screenForCrisisRef = useRef(screenForCrisis);
    useEffect(() => { screenForCrisisRef.current = screenForCrisis; }, [screenForCrisis]);

    // ── Cleanup on unmount ────────────────────────────────────────────────────
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            stopHeartbeat();
            speakAbortRef.current?.abort();
            try { synthesizerRef.current?.close(); } catch { /* ignore */ }
            if (clientRef.current) {
                clientRef.current.stopStreaming().catch(() => { /* ignore */ });
                clientRef.current = null;
            }
        };
    }, [stopHeartbeat]);

    // ── Initialise Anam client ────────────────────────────────────────────────
    useEffect(() => {
        if (!supabaseJwt) return;

        let cancelled = false;

        const init = async () => {
            try {
                setError(null);
                quotaExhaustedRef.current = false;
                setQuotaExhausted(false);
                const tokenResponse = await fetchSessionToken(supabaseJwt, language);
                if (cancelled || !mountedRef.current) return;
                setRemainingSeconds(tokenResponse.remainingSeconds);

                if (clientRef.current) {
                    await clientRef.current.stopStreaming().catch(() => {});
                    clientRef.current = null;
                }
                stopHeartbeat();

                const client = createClient(tokenResponse.sessionToken);
                clientRef.current = client;

                // New client means a new message history; stale diff state would
                // silently skip screening the first utterances of the session.
                lastHistoryRef.current = [];
                screenedIdsRef.current = new Set();

                // ── Connection lifecycle ──────────────────────────────────────
                // Without this, a server-side close (maxSessionLengthSeconds
                // reached, mic permission revoked, WebRTC failure) leaves the
                // <video> frozen on its last frame with isReady still true and
                // no signal that anything happened. `cancelled` guards against
                // handling a close event fired by a client we are already
                // replacing (language change) or unmounting.
                client.addListener(
                    AnamEvent.CONNECTION_CLOSED,
                    (code: ConnectionClosedCode, details?: string) => {
                        if (cancelled || !mountedRef.current) return;
                        console.warn(
                            `[AnamAvatar] 🔌 connection closed: ${code}${details ? ` — ${details}` : ""}`,
                        );
                        stopHeartbeat();
                        setIsReady(false);
                        // A quota cap-out already shows its own UI via
                        // quotaExhausted (set by the heartbeat, or by the 429 on
                        // the next mint) — don't also stomp it with the generic
                        // "connection lost" error overlay.
                        if (quotaExhaustedRef.current) return;
                        if (code === ConnectionClosedCode.NORMAL) {
                            setError("Your avatar session has ended. Reopen the avatar to start a new one.");
                        } else if (code === ConnectionClosedCode.MICROPHONE_PERMISSION_DENIED) {
                            setError("Microphone access is blocked. Allow microphone access and reload to continue.");
                        } else {
                            setError("Avatar connection lost. Please try again.");
                        }
                    },
                );

                // Heartbeat starts once video is actually rendering, not at
                // connect — accounting should track playback, not setup time.
                client.addListener(AnamEvent.VIDEO_PLAY_STARTED, () => {
                    if (cancelled || !mountedRef.current) return;
                    startHeartbeat();
                });

                if (ANAM_PIPELINE_MODE) {
                    // ── Anam pipeline: listen for completed turns ────────────
                    // MESSAGE_HISTORY_UPDATED fires each time a participant
                    // finishes speaking, with the full conversation as Message[].
                    // We diff against the previous snapshot.
                    client.addListener(
                        AnamEvent.MESSAGE_HISTORY_UPDATED,
                        (messages: AnamMessage[]) => {
                            if (!mountedRef.current) return;
                            const prev = lastHistoryRef.current;
                            const newMsgs = messages.slice(prev.length);
                            lastHistoryRef.current = messages;

                            // 1) Crisis screening — fires on the user-only update,
                            //    i.e. before the persona has answered. Deduped by
                            //    message id because history updates are cumulative
                            //    and a slice can re-present a message we have seen.
                            for (const m of newMsgs) {
                                if (m.role !== "user") continue;
                                if (screenedIdsRef.current.has(m.id)) continue;
                                screenedIdsRef.current.add(m.id);
                                void screenForCrisisRef.current(m);
                            }

                            // 2) Completed user→persona pairs for the chat UI.
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
                if (err instanceof AnamQuotaExhaustedError) {
                    console.warn("[AnamAvatar] ⏱️ daily video quota already exhausted — not opening a session");
                    if (mountedRef.current) {
                        quotaExhaustedRef.current = true;
                        setQuotaExhausted(true);
                        setRemainingSeconds(0);
                        setIsReady(false);
                    }
                    return;
                }
                const msg = err instanceof Error ? err.message : String(err);
                console.error("[AnamAvatar] ❌ Init failed:", msg);
                if (mountedRef.current) {
                    setError(msg);
                    setIsReady(false);
                }
            }
        };

        void init();
        return () => { cancelled = true; stopHeartbeat(); };
    // `language` is a dependency because languageCode is baked into the session
    // token: changing it has to re-mint and reconnect, it cannot be patched live.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [supabaseJwt, language]);

    // ── speakWithAnam: Azure TTS (PCM) → AgentAudioInputStream → lipsync ─────
    // MindMitra pipeline mode only. In Anam pipeline mode Anam speaks itself —
    // this is a deliberate no-op that just unblocks the queue.
    //
    // NOTE: with VITE_ANAM_PIPELINE_MODE=true this whole Azure TTS path is dead
    // at runtime. It is kept, not deleted, because it is the fallback if the
    // turnkey decision is revisited — MindMitra-owned text with Anam reduced to
    // lipsync is the only configuration where safety_gate stays inline.
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
        remainingSeconds,
        quotaExhausted,
    };
}
