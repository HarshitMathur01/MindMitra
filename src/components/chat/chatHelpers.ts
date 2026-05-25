/**
 * Helpers for the Chat surface — no React components, no DOM.
 *
 * Pure utilities live here so they can be unit-tested without rendering.
 * `formatDateSeparator` takes a `t` function from i18next so it stays
 * caller-locale-aware without becoming a React hook.
 */

import type { TFunction } from "i18next";

import i18n from "@/i18n";
import {
    moodEmojiPools,
    CHAT_STORAGE_KEYS,
} from "./chatConstants";
import type { MoodOption, RecentChatPreview } from "./chatTypes";

export function messageLengthBand(len: number): string {
    if (len <= 0) return "0";
    if (len <= 80) return "1_80";
    if (len <= 240) return "81_240";
    if (len <= 600) return "241_600";
    return "601_plus";
}

export const hashSessionSeed = (sessionId: string): number => {
    let hash = 0;
    for (let i = 0; i < sessionId.length; i++) {
        hash = (hash * 31 + sessionId.charCodeAt(i)) % 1000003;
    }
    return hash;
};

/**
 * Returns the 5-point mood scale with seed-deterministic emoji per
 * session, plus a stable English label key (e.g. "okay"). Translated
 * labels are overlaid by `useMoodOptions()` in `chatI18n.ts`.
 */
export const buildMoodOptionsForSession = (sessionId: string | null): MoodOption[] => {
    const values = [1, 2, 3, 4, 5];
    const seed = sessionId ? hashSessionSeed(sessionId) : Math.floor(Math.random() * 1_000_000);

    return values.map((value, index) => {
        const pool = moodEmojiPools[value] ?? ["🙂"];
        const emoji = pool[(seed + index * 7) % pool.length] ?? pool[0];
        return {
            value,
            label: "",
            emoji,
        };
    });
};

/**
 * Stabilizes the session list across polled refreshes — preserves
 * existing object identity when nothing meaningful changed so React
 * skips re-rendering the recents pane on every 10s tick.
 */
export const mergeRecentChats = (
    previousChats: RecentChatPreview[],
    nextChats: RecentChatPreview[],
) => {
    const previousChatsById = new Map(previousChats.map((chat) => [chat.id, chat]));

    const mergedChats = nextChats.map((chat) => {
        const previousChat = previousChatsById.get(chat.id);
        if (!previousChat) return chat;

        const stableTitle = previousChat.title || chat.title;

        if (
            previousChat.title === stableTitle &&
            previousChat.created_at === chat.created_at &&
            previousChat.messageCount === chat.messageCount
        ) {
            return previousChat;
        }

        return {
            ...previousChat,
            title: stableTitle,
            created_at: chat.created_at,
            messageCount: chat.messageCount,
        };
    });

    const isSameList =
        previousChats.length === mergedChats.length &&
        previousChats.every((chat, index) => chat === mergedChats[index]);
    return isSameList ? previousChats : mergedChats;
};

/**
 * Static, keyword-based reply suggestions under the latest AI message.
 * Returns an empty list on non-English locales — the keyword scan is
 * English-only and would silently mismatch any non-EN AI reply.
 */
export const getQuickReplies = (content: string, lang: string = "en"): string[] => {
    if (lang !== "en") return [];
    const lower = content.toLowerCase();
    if (lower.includes("breath") || lower.includes("exhale") || lower.includes("inhale"))
        return ["Guide me through it", "How long should I do this?", "What else can help?"];
    if (lower.includes("stress") || lower.includes("overwhelm") || lower.includes("pressure"))
        return ["Tell me more techniques", "Why do I feel this way?", "Help me calm down now"];
    if (lower.includes("anxiet") || lower.includes("worry") || lower.includes("panic"))
        return ["What causes anxiety?", "Try a grounding exercise", "When should I seek help?"];
    if (lower.includes("sleep") || lower.includes("insomnia") || lower.includes("tired"))
        return ["Give me sleep tips", "Why can't I sleep?", "Try a relaxation technique"];
    if (lower.includes("sad") || lower.includes("depress") || lower.includes("hopeless"))
        return ["I want to talk more", "What can I do right now?", "Help me find a therapist"];
    if (lower.includes("motivat") || lower.includes("goal") || lower.includes("productiv"))
        return ["How do I stay consistent?", "Set a small goal with me", "Why do I procrastinate?"];
    if (lower.includes("relationship") || lower.includes("friend") || lower.includes("family"))
        return ["Tell me more", "How do I communicate better?", "Set healthy boundaries"];
    return ["Tell me more", "How can I apply this?", "What should I do next?"];
};

export const formatDateSeparator = (date: Date, t: TFunction): string => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86_400_000).toDateString();
    const d = date.toDateString();
    if (d === today) return t("chat.dateSeparator.today");
    if (d === yesterday) return t("chat.dateSeparator.yesterday");
    return date.toLocaleDateString(i18n.language, { month: "short", day: "numeric" });
};

// ─── "Keep this moment" persistence ────────────────────────────────────────
// localStorage-backed for now (no extra Supabase round-trip on first ship).
// /me reads the same set; we'll migrate to a `kept_moments` table later
// if/when sync across devices becomes necessary.

export type KeptMoment = {
    id: string;
    sessionId: string;
    content: string;
    /** ISO string */
    keptAt: string;
};

const KEPT_KEY = CHAT_STORAGE_KEYS.keptMomentIds;

const safeParse = <T,>(raw: string | null, fallback: T): T => {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
};

export const loadKeptMoments = (): KeptMoment[] => {
    if (typeof window === "undefined") return [];
    return safeParse<KeptMoment[]>(localStorage.getItem(KEPT_KEY), []);
};

export const isMomentKept = (messageId: string): boolean =>
    loadKeptMoments().some((m) => m.id === messageId);

export const toggleKeptMoment = (moment: KeptMoment): boolean => {
    const current = loadKeptMoments();
    const exists = current.some((m) => m.id === moment.id);
    const next = exists ? current.filter((m) => m.id !== moment.id) : [...current, moment];
    localStorage.setItem(KEPT_KEY, JSON.stringify(next));
    // Returns the new "kept" state.
    return !exists;
};
