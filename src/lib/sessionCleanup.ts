/**
 * Centralised "wipe everything user-scoped from this device" helper.
 *
 * Why this exists: MindMitra writes a lot of user-specific state to
 * `localStorage` — chat session ids, kept moments, MindGym progress,
 * CBT thought-records, journal drafts, MindGym recommendations, etc.
 * If a user signs out on a shared device (a sibling's laptop, a
 * library kiosk, a friend's phone), the next person must NOT see any
 * of that. This is both a privacy expectation and, for a mental-health
 * product, an outright safety expectation.
 *
 * Strategy: explicit allow-list of keys and prefixes. We intentionally
 * do *not* `localStorage.clear()` because the page may store
 * non-personal items (theme preference, accept-cookies banner) that
 * the next user can keep. Add new user-scoped keys here as the product
 * grows; missing a key is a privacy regression.
 */

import { CHAT_STORAGE_KEYS } from "@/components/chat/chatConstants";

/** Exact keys that are user-scoped and must be cleared on sign-out. */
const EXACT_KEYS_TO_CLEAR: string[] = [
    // Chat
    CHAT_STORAGE_KEYS.activeSessionId,
    CHAT_STORAGE_KEYS.activeSessionFlag,
    CHAT_STORAGE_KEYS.keptMomentIds,
    // MindGym
    "mindmitra_mindgym_progress_v1",
    "mindmitra_mindgym_reco_v1",
    // CBT (StressControl)
    "mm_cbt_streak",
    "mm_cbt_streak_date",
    "mm_cbt_records",
    // Memory mini-game best score
    "memoryChallengeBestScore",
];

/**
 * Prefixes that may host multiple keys (per-tool, per-day, per-session).
 * Anything starting with one of these strings will be removed.
 */
const PREFIXES_TO_CLEAR: string[] = [
    "mm-", // chat / safety / kept-moments family
    "mm_", // CBT / habit family
    "mindmitra_", // MindGym
    "mindgym_", // any future direct keys
    "journal_", // Journal draft entries
    "tb_", // Therapist Bridge intake
    "therapist_bridge_", // verbose form of the above
];

/**
 * Sweep all user-scoped persistent state from this device.
 *
 * Safe to call multiple times. No-throws: if `localStorage` is
 * unavailable (Safari private mode, iframe sandbox), we silently
 * return — the user is signing out anyway and a thrown error here
 * would block the redirect.
 */
export function clearUserSessionData(): void {
    if (typeof window === "undefined" || !("localStorage" in window)) return;
    try {
        for (const key of EXACT_KEYS_TO_CLEAR) {
            window.localStorage.removeItem(key);
        }

        // Snapshot keys before iterating because removeItem mutates the
        // collection underneath us.
        const allKeys: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i);
            if (k) allKeys.push(k);
        }
        for (const k of allKeys) {
            if (PREFIXES_TO_CLEAR.some((p) => k.startsWith(p))) {
                window.localStorage.removeItem(k);
            }
        }
    } catch (err) {
        console.warn("[sessionCleanup] localStorage sweep failed:", err);
    }

    // sessionStorage is per-tab and tied to lifetime, but we still wipe
    // it explicitly so a sign-out doesn't leave the freshly-loaded next
    // user with anything inherited from the previous tab.
    try {
        if ("sessionStorage" in window) {
            window.sessionStorage.clear();
        }
    } catch (err) {
        console.warn("[sessionCleanup] sessionStorage clear failed:", err);
    }
}
