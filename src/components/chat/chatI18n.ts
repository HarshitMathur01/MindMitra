/**
 * Translation hooks for the chat surface.
 *
 * Sits between `chatConstants.ts` (LLM-bound prompts + emoji data) and
 * the React components, overlaying translated labels onto the static
 * keys/prompts. Uses `useLocalizedT()` so language stays in sync with
 * `user_settings.language`.
 */

import { useLocalizedT } from "@/hooks/useLocalizedT";
import {
    EMPTY_STATE_STARTER_KEYS,
    EMPTY_STATE_STARTER_PROMPTS,
    BODY_CUE_KEYS,
    BODY_CUE_PROMPTS,
    LOADING_PHASE_KEYS,
    MOOD_LABEL_KEYS,
    type EmptyStateStarterKey,
    type BodyCueKey,
} from "./chatConstants";
import { buildMoodOptionsForSession } from "./chatHelpers";
import type { MoodOption } from "./chatTypes";

export interface ChatStarter {
    key: EmptyStateStarterKey;
    label: string;
    prompt: string;
}

export function useEmptyStateStarters(): ChatStarter[] {
    const { t } = useLocalizedT();
    return EMPTY_STATE_STARTER_KEYS.map((k) => ({
        key: k,
        label: t(`chat.emptyState.starters.${k}`),
        prompt: EMPTY_STATE_STARTER_PROMPTS[k],
    }));
}

export interface BodyCue {
    key: BodyCueKey;
    label: string;
    prompt: string;
}

export function useBodyCueChips(): BodyCue[] {
    const { t } = useLocalizedT();
    return BODY_CUE_KEYS.map((k) => ({
        key: k,
        label: t(`chat.emptyState.bodyCues.${k}`),
        prompt: BODY_CUE_PROMPTS[k],
    }));
}

export function useLoadingPhases(): string[] {
    const { t } = useLocalizedT();
    return LOADING_PHASE_KEYS.map((k) => t(`chat.loadingPhases.${k}`));
}

/**
 * Builds the 5-point mood widget: seed-deterministic emoji from the
 * session id, with translated labels overlaid for the current locale.
 */
export function useMoodOptions(sessionId: string | null): MoodOption[] {
    const { t } = useLocalizedT();
    const seeds = buildMoodOptionsForSession(sessionId);
    return seeds.map((o) => ({
        ...o,
        label: t(`chat.moodWidget.labels.${MOOD_LABEL_KEYS[o.value]}`),
    }));
}
