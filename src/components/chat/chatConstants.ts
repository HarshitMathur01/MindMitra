/**
 * Static motion / mood data tables and LLM-bound prompt strings for the
 * Chat surface.
 *
 * User-facing labels live in i18n (see `src/i18n/locales/*.json` and the
 * hooks in `chatI18n.ts`). Prompts that get sent TO the model as a user
 * message stay here in English so backend signal extraction stays
 * predictable across locales.
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
 * Calm, contextual entry points for the empty state. Labels are i18n'd;
 * the `prompt` strings stay English because they're sent to the LLM,
 * which is system-prompted for grounding intent.
 */
export const EMPTY_STATE_STARTER_KEYS = ["catchUp", "sitWithMe", "nameFeeling"] as const;
export type EmptyStateStarterKey = typeof EMPTY_STATE_STARTER_KEYS[number];
export const EMPTY_STATE_STARTER_PROMPTS: Record<EmptyStateStarterKey, string> = {
    catchUp: "Catch me up on today — what should I tell you about?",
    sitWithMe: "I just want to sit for a minute. Can you keep me company?",
    nameFeeling: "Help me name what I'm feeling right now. I'll start.",
};

/**
 * Somatic body-cue chips. Tap sends as a one-line message; the model is
 * briefed (system prompt) to respond with a body-aware grounding
 * suggestion. Labels are i18n'd; prompts stay English (LLM-bound).
 */
export const BODY_CUE_KEYS = [
    "tenseShoulders",
    "tightChest",
    "heavyFoggy",
    "wiredRestless",
    "numb",
] as const;
export type BodyCueKey = typeof BODY_CUE_KEYS[number];
export const BODY_CUE_PROMPTS: Record<BodyCueKey, string> = {
    tenseShoulders: "I notice my shoulders are really tense right now.",
    tightChest: "My chest feels tight. Can we slow down for a second?",
    heavyFoggy: "Everything feels heavy and a bit foggy today.",
    wiredRestless: "I feel wired and restless. I can't settle.",
    numb: "I feel kind of numb. Not great, not bad — just not much.",
};

export const quickCategories = [
    { label: "Mental Health", icon: "🧠", color: "bg-primary/10 text-primary" },
    { label: "Personality", icon: "🎭", color: "bg-primary/10 text-primary" },
    { label: "Stress Relief", icon: "🌿", color: "bg-primary/10 text-primary" },
    { label: "Relationships", icon: "💖", color: "bg-primary/10 text-primary" },
    { label: "Self-Care", icon: "✨", color: "bg-primary/10 text-primary" },
    { label: "Therapy", icon: "💬", color: "bg-primary/10 text-primary" },
];

/**
 * Translation keys for the rotating loading-phase phrases shown while
 * the AI is composing a reply. Resolved via `useLoadingPhases()`.
 */
export const LOADING_PHASE_KEYS = ["reading", "thinking", "writing"] as const;
export type LoadingPhaseKey = typeof LOADING_PHASE_KEYS[number];

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

/**
 * Translation-key suffixes for the 5-point mood scale. Used by
 * `useMoodOptions()` to overlay translated labels onto the
 * seed-deterministic emoji picker in `buildMoodOptionsForSession`.
 */
export const MOOD_LABEL_KEYS: Record<number, "struggling" | "low" | "okay" | "good" | "great"> = {
    1: "struggling",
    2: "low",
    3: "okay",
    4: "good",
    5: "great",
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
 * Stays English on purpose — these are LLM-bound, not UI copy.
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
