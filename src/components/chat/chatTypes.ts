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

export type MoodOption = {
    emoji: string;
    label: string;
    value: number;
};
