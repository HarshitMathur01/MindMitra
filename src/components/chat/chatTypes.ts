/**
 * Shared types for the Chat surface.
 * Extracted from ChatGPTInterface.tsx so child components
 * can be authored without circular imports.
 */

export interface Message {
    id: string;
    content: string;
    sender: "user" | "ai";
    timestamp: Date;
}

export interface ChatSession {
    id: string;
    title: string;
    lastMessage: string;
    timestamp: Date;
}

export type RecentChatPreview = {
    id: string;
    title: string;
    created_at: string;
    messageCount: number;
};

/** Parsed `data: {...}` lines from the chat SSE stream */
export type ChatSsePayload = {
    chunk?: string;
    message?: string;
    error?: string;
};

export type MoodOption = {
    emoji: string;
    label: string;
    value: number;
};
