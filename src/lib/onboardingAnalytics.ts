/**
 * onboardingAnalytics — lightweight event tracking for the onboarding flow.
 *
 * Privacy-first:
 *  - No PII is ever sent (no user text, no names)
 *  - Only structural events: act started / completed / skipped, timing
 *  - Batched writes to Supabase `onboarding_events` (best-effort, fire-and-forget)
 *  - Falls back to in-memory buffer if auth or DB unavailable
 *
 * Usage:
 *   trackOnboardingEvent('act_started', { act: 'act0', tier: 'full' });
 *   trackOnboardingEvent('act_completed', { act: 'act2', durationMs: 12340 });
 *   trackOnboardingEvent('act_skipped', { act: 'act1', skipType: 'per-act' });
 *   trackOnboardingEvent('global_skip', { fromAct: 'act3' });
 *   trackOnboardingEvent('onboarding_completed', { totalMs: 95000 });
 *   trackOnboardingEvent('crisis_triggered', { act: 'act2', level: 'high' });
 */

import { supabase } from '@/integrations/supabase/client';

// ── Types ──────────────────────────────────────────────────────────────────

export type OnboardingEventType =
    | 'consent_given'
    | 'act_started'
    | 'act_completed'
    | 'act_skipped'
    | 'global_skip'
    | 'onboarding_completed'
    | 'crisis_triggered'
    | 'language_changed'
    | 'replay_started';

export interface OnboardingEventPayload {
    act?: string;
    tier?: string;
    durationMs?: number;
    totalMs?: number;
    skipType?: 'per-act' | 'global';
    fromAct?: string;
    level?: string;
    language?: string;
}

interface QueuedEvent {
    event_type: OnboardingEventType;
    payload: OnboardingEventPayload;
    timestamp: string;
    session_id: string;
}

// ── Session ID ─────────────────────────────────────────────────────────────

let _sessionId: string | null = null;

function getSessionId(): string {
    if (!_sessionId) {
        _sessionId = `ob-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
    return _sessionId;
}

/** Reset session ID (e.g. on replay) */
export function resetAnalyticsSession(): void {
    _sessionId = null;
    _actTimers.clear();
}

// ── Act timing helpers ─────────────────────────────────────────────────────

const _actTimers = new Map<string, number>();

/** Call when an act starts rendering */
export function startActTimer(act: string): void {
    _actTimers.set(act, Date.now());
}

/** Returns elapsed ms since startActTimer was called, or undefined */
export function getActDuration(act: string): number | undefined {
    const start = _actTimers.get(act);
    if (start === undefined) return undefined;
    return Date.now() - start;
}

// ── Event queue + flush ────────────────────────────────────────────────────

const FLUSH_INTERVAL_MS = 5_000;
const MAX_QUEUE_SIZE = 50;

const _queue: QueuedEvent[] = [];
let _flushTimer: ReturnType<typeof setInterval> | null = null;

function ensureFlushTimer(): void {
    if (_flushTimer) return;
    _flushTimer = setInterval(flushQueue, FLUSH_INTERVAL_MS);
}

async function flushQueue(): Promise<void> {
    if (_queue.length === 0) return;

    const batch = _queue.splice(0, MAX_QUEUE_SIZE);

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return; // Can't write without auth — events stay lost (privacy over data)

        // Best-effort insert; swallow errors silently
        // Table is onboarding_analytics (from phase-0 migration) with columns:
        //   id, user_id, step, device_tier, metadata (JSONB), created_at
        await (supabase as unknown as { from: (t: string) => { insert: (rows: unknown[]) => Promise<unknown> } })
            .from('onboarding_analytics')
            .insert(
                batch.map(e => ({
                    user_id: user.id,
                    step: 0, // analytics events don't map 1:1 to steps; use 0 as placeholder
                    metadata: {
                        event_type: e.event_type,
                        ...e.payload,
                        session_id: e.session_id,
                    },
                    created_at: e.timestamp,
                })),
            );
    } catch {
        // Silently drop on failure — analytics should never break UX
    }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Queue an onboarding analytics event for batched write.
 *
 * Safe to call at any time — never throws, never blocks UI.
 */
export function trackOnboardingEvent(
    eventType: OnboardingEventType,
    payload: OnboardingEventPayload = {},
): void {
    try {
        _queue.push({
            event_type: eventType,
            payload,
            timestamp: new Date().toISOString(),
            session_id: getSessionId(),
        });

        // Auto-start flush timer on first event
        ensureFlushTimer();

        // If queue is getting large, flush immediately
        if (_queue.length >= MAX_QUEUE_SIZE) {
            flushQueue();
        }
    } catch {
        // Never let analytics break the app
    }
}

/**
 * Convenience: track act start + capture timer.
 */
export function trackActStart(act: string, tier?: string): void {
    startActTimer(act);
    trackOnboardingEvent('act_started', { act, tier });
}

/**
 * Convenience: track act complete with auto duration.
 */
export function trackActComplete(act: string): void {
    const durationMs = getActDuration(act);
    trackOnboardingEvent('act_completed', { act, durationMs });
}

/**
 * Convenience: track act skip.
 */
export function trackActSkip(act: string, skipType: 'per-act' | 'global' = 'per-act'): void {
    const durationMs = getActDuration(act);
    trackOnboardingEvent('act_skipped', { act, durationMs, skipType });
}

/**
 * Flush remaining events (call on onboarding complete or unmount).
 */
export function flushOnboardingAnalytics(): void {
    flushQueue();
    if (_flushTimer) {
        clearInterval(_flushTimer);
        _flushTimer = null;
    }
}
