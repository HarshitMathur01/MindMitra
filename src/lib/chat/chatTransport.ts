/**
 * chatTransport — pure HTTP layer for the MHA v3 chat path.
 *
 * Owns the `POST /chat` request/response contract and nothing else: no React
 * state, no session bookkeeping, no avatar/voice concerns. The orchestrator
 * (ChatGPTInterface) stays in charge of when to call and what to do with the
 * result; this module guarantees the wire format matches the v3 backend.
 */

import type { SupportedLanguage } from "@/lib/locale";

export type MhaChatHttpResponse = {
    text: string;
    session_id: string;
    is_new_session: boolean;
    mode: string;
    urgency: number;
    source: string;
    meta?: Record<string, unknown>;
    timings_ms?: Record<string, number>;
    trace_id?: string;
};

export const getChatEndpoint = (): string => {
    const backendUrl = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim();
    if (backendUrl) return `${backendUrl.replace(/\/$/, "")}/chat`;
    if (import.meta.env.PROD) {
        throw new Error("Missing VITE_BACKEND_URL for production chat deployment");
    }
    return `${window.location.origin.replace(/\/$/, "")}/chat`;
};

export const postResponseLog = (event: string, fields: Record<string, unknown>) => {
    if (!import.meta.env.DEV) return;
    const details = Object.entries(fields)
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(" ");
    console.info(`[post-response] ${event}${details ? ` ${details}` : ""}`);
};

export async function postChatTurn(input: {
    accessToken: string;
    content: string;
    /** Existing session UUID, or "new" to let the backend mint one. */
    sessionId: string;
    deviceLocale: string;
    language: SupportedLanguage;
    signal?: AbortSignal;
}): Promise<MhaChatHttpResponse> {
    const response = await fetch(getChatEndpoint(), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${input.accessToken}`,
        },
        body: JSON.stringify({
            content: input.content,
            session_id: input.sessionId,
            device_locale: input.deviceLocale,
            language: input.language,
        }),
        signal: input.signal,
    });
    if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(detail || `Chat request failed (${response.status})`);
    }
    return (await response.json()) as MhaChatHttpResponse;
}
