/**
 * Static copy + motion / mood data tables for the Chat surface.
 *
 * Kept intentionally token-first (no bespoke per-topic colors) so the
 * surface inherits Sanctuary v4 calm by default.
 */

export const suggestedPrompts: string[] = [
    "Help me understand my personality type",
    "I'm feeling anxious, what can I do?",
    "Can you analyze my mood patterns?",
    "What are some stress management techniques?",
    "Tell me about different types of therapy",
    "How can I improve my mental wellness?",
];

/**
 * Calm, contextual entry points for the empty state. Intentionally
 * non-clinical phrasing — no "anxiety", "depression", "stress" up front.
 * Those clinical terms live deeper in the sidebar / resources.
 */
export const emptyStateStarters: { label: string; prompt: string }[] = [
    { label: "Catch me up on today", prompt: "Catch me up on today — what should I tell you about?" },
    { label: "Sit with me for a minute", prompt: "I just want to sit for a minute. Can you keep me company?" },
    { label: "Help me name what I'm feeling", prompt: "Help me name what I'm feeling right now. I'll start." },
];

/**
 * Somatic body-cue chips. Far richer clinical signal than 1–5 mood:
 * shifting attention to the body is itself a grounding micro-intervention.
 * Tap sends as a one-line message; the model is briefed (system prompt)
 * to respond with a body-aware grounding suggestion.
 */
export const bodyCueChips: { label: string; prompt: string }[] = [
    { label: "Tense shoulders", prompt: "I notice my shoulders are really tense right now." },
    { label: "Tight chest", prompt: "My chest feels tight. Can we slow down for a second?" },
    { label: "Heavy / foggy", prompt: "Everything feels heavy and a bit foggy today." },
    { label: "Wired & restless", prompt: "I feel wired and restless. I can't settle." },
    { label: "Numb", prompt: "I feel kind of numb. Not great, not bad — just not much." },
];

export const quickCategories = [
    { label: "Mental Health", icon: "🧠", color: "bg-primary/10 text-primary" },
    { label: "Personality", icon: "🎭", color: "bg-primary/10 text-primary" },
    { label: "Stress Relief", icon: "🌿", color: "bg-primary/10 text-primary" },
    { label: "Relationships", icon: "💖", color: "bg-primary/10 text-primary" },
    { label: "Self-Care", icon: "✨", color: "bg-primary/10 text-primary" },
    { label: "Therapy", icon: "💬", color: "bg-primary/10 text-primary" },
];

export const loadingPhases = [
    "Reading this with care",
    "Thinking of what to say",
    "Putting it into words",
];

/** Fast, precise spring for message bubbles */
export const CHAT_MESSAGE_SPRING = {
    type: "spring" as const,
    stiffness: 400,
    damping: 32,
    mass: 0.8,
};

export const CHAT_SOFT_SPRING = {
    type: "spring" as const,
    stiffness: 350,
    damping: 30,
    mass: 1,
};

export const moodLabelsByValue: Record<number, string> = {
    1: "Struggling",
    2: "Low",
    3: "Okay",
    4: "Good",
    5: "Great",
};

export const moodEmojiPools: Record<number, string[]> = {
    1: ["😔", "😣", "😞", "😢", "🥺"],
    2: ["😕", "🙁", "😟", "🫤", "😶"],
    3: ["😐", "🙂", "😌", "🫡", "😶‍🌫️"],
    4: ["😊", "😃", "😄", "😎", "🌤️"],
    5: ["🤩", "😁", "✨", "🥳", "🌟"],
};

/**
 * Sentence-style mood replies sent to the model when a user taps a
 * mood emoji. Phrased so the model sees a self-statement, not metadata.
 */
export const moodReplyMap: Record<number, string> = {
    1: "I'm really struggling right now",
    2: "I'm feeling a bit low",
    3: "I'm feeling okay",
    4: "I'm feeling pretty good",
    5: "I'm feeling great!",
};

/**
 * localStorage keys owned by the chat surface. Centralized so we can
 * sweep them later (e.g., on sign-out) and so multiple components can
 * agree without typo drift.
 */
export const CHAT_STORAGE_KEYS = {
    activeSessionId: "currentChatSession",
    activeSessionFlag: "mm-active-chat-session",
    /**
     * Set of message ids the user has explicitly "kept". Stored as a
     * JSON array. Surfaced in /me as the "Saved moments" notebook.
     */
    keptMomentIds: "mm-kept-moments",
} as const;
