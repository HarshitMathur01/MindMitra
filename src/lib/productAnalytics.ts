import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
type MixpanelClient = typeof import('mixpanel-browser').default;

const DNT_VALUES = new Set(['1', 'yes', 'true']);

function respectsDoNotTrack(): boolean {
  if (typeof navigator === 'undefined') return false;
  const dnt = navigator.doNotTrack ?? (navigator as unknown as { msDoNotTrack?: string }).msDoNotTrack;
  if (dnt == null) return false;
  return DNT_VALUES.has(String(dnt).toLowerCase());
}

function analyticsExplicitlyEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_PRODUCT_ANALYTICS === '1';
}

function mixpanelToken(): string | undefined {
  const t = import.meta.env.VITE_MIXPANEL_TOKEN;
  return t && t.trim().length > 0 ? t.trim() : undefined;
}

function mixpanelApiHost(): string {
  const h = import.meta.env.VITE_MIXPANEL_API_HOST?.trim();
  return h && h.length > 0 ? h : 'https://api.mixpanel.com';
}

/** Blocked property keys (substring match, lowercase). No clinical or auth payloads. */
const BLOCKED_KEY_FRAGMENTS = [
  'email',
  'password',
  'token',
  'secret',
  'content',
  'message',
  'body',
  'text',
  'transcript',
  'prompt',
  'chat',
  'note',
  'diagnos',
  'symptom',
  'therapy',
  'phone',
  'address',
  'ssn',
];

const MAX_EVENT_NAME_LEN = 64;
const MAX_PROP_KEYS = 24;
const MAX_STRING_LEN = 120;

let initialized = false;
let optedOut = false;
let mixpanelClient: MixpanelClient | null = null;
let mixpanelPromise: Promise<MixpanelClient> | null = null;

function shouldRun(): boolean {
  if (typeof window === 'undefined') return false;
  if (!analyticsExplicitlyEnabled()) return false;
  if (!mixpanelToken()) return false;
  if (respectsDoNotTrack()) return false;
  return true;
}

async function loadMixpanel(): Promise<MixpanelClient | null> {
  if (!shouldRun() || optedOut) return null;
  if (mixpanelClient) return mixpanelClient;
  if (!mixpanelPromise) {
    mixpanelPromise = import('mixpanel-browser').then((mod) => mod.default);
  }
  try {
    mixpanelClient = await mixpanelPromise;
    return mixpanelClient;
  } catch {
    mixpanelPromise = null;
    return null;
  }
}

async function ensureMixpanelInit(): Promise<MixpanelClient | null> {
  if (!shouldRun() || optedOut) return null;
  const mixpanel = await loadMixpanel();
  if (!mixpanel) return null;
  if (initialized) return mixpanel;
  const token = mixpanelToken();
  if (!token) return null;

  mixpanel.init(token, {
    autocapture: false,
    track_pageview: false,
    persistence: 'localStorage',
    ip: false,
    ignore_dnt: false,
    secure_cookie: true,
    stop_utm_persistence: true,
    save_referrer: false,
    store_google: false,
    api_host: mixpanelApiHost(),
    batch_requests: true,
    batch_flush_interval_ms: 3000,
  });
  initialized = true;
  return mixpanel;
}

function isBlockedKey(key: string): boolean {
  const k = key.toLowerCase();
  return BLOCKED_KEY_FRAGMENTS.some((frag) => k.includes(frag));
}

function sanitizeEventName(name: string): string | null {
  const n = name.trim().toLowerCase().replace(/\s+/g, '_');
  if (!/^[a-z][a-z0-9_]*$/.test(n)) return null;
  if (n.length > MAX_EVENT_NAME_LEN) return null;
  return n;
}

function sanitizeProperties(raw: Record<string, unknown> | undefined): Record<string, Json> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, Json> = {};
  let count = 0;
  for (const [key, val] of Object.entries(raw)) {
    if (count >= MAX_PROP_KEYS) break;
    if (typeof key !== 'string' || key.length === 0 || key.length > 64) continue;
    if (isBlockedKey(key)) continue;

    if (typeof val === 'number' && Number.isFinite(val)) {
      out[key] = val;
      count++;
    } else if (typeof val === 'boolean') {
      out[key] = val;
      count++;
    } else if (typeof val === 'string') {
      const s = val.length > MAX_STRING_LEN ? val.slice(0, MAX_STRING_LEN) : val;
      if (s.length === 0) continue;
      out[key] = s;
      count++;
    }
  }
  return out;
}

async function persistProductEventToSupabase(
  userId: string,
  eventName: string,
  properties: Record<string, Json>
): Promise<void> {
  const { error } = await supabase.from('product_events').insert({
    user_id: userId,
    event_name: eventName,
    properties,
  });
  if (error && import.meta.env.DEV) {
    // Missing migration or RLS: do not break UX.
    console.warn('[productAnalytics] product_events insert skipped:', error.message);
  }
}

/**
 * Call when the authenticated user id is known (after sign-in or session restore).
 * Uses Supabase user UUID only — never email or display name.
 */
export function identifyProductAnalyticsUser(userId: string | null | undefined): void {
  if (!shouldRun() || optedOut) return;
  void (async () => {
    const mixpanel = await ensureMixpanelInit();
    if (mixpanel && userId && typeof userId === 'string') {
      mixpanel.identify(userId);
    }
  })();
}

/** Call on sign-out to clear Mixpanel identity and device id. */
export function resetProductAnalyticsIdentity(): void {
  if (!initialized || !mixpanelClient) return;
  try {
    mixpanelClient.reset();
  } catch {
    /* noop */
  }
}

/**
 * Track a product funnel event. Safe defaults:
 * - No-op unless VITE_ENABLE_PRODUCT_ANALYTICS=1 and VITE_MIXPANEL_TOKEN are set.
 * - Respects DNT; disables autocapture and automatic pageviews in Mixpanel.
 * - Property keys and string lengths are restricted; clinical/auth-like keys stripped.
 * - First-party copy: inserts into public.product_events when a session exists (RLS).
 *
 * Never pass chat text, assessments, or PII in `properties`.
 */
export function trackProductEvent(
  name: string,
  properties?: Record<string, unknown>
): void {
  if (!shouldRun() || optedOut) return;
  const eventName = sanitizeEventName(name);
  if (!eventName) return;

  const props = sanitizeProperties(properties);

  void (async () => {
    const mixpanel = await ensureMixpanelInit();
    if (!mixpanel) return;
    try {
      mixpanel.track(eventName, props);
    } catch {
      /* noop */
    }

    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    if (uid) await persistProductEventToSupabase(uid, eventName, props);
  })();
}

/** Optional: respect future in-app privacy toggle (calls Mixpanel opt-out). */
export function setProductAnalyticsOptOut(optOut: boolean): void {
  optedOut = optOut;
  if (optOut) {
    if (initialized && mixpanelClient) mixpanelClient.opt_out_tracking();
    return;
  }

  void (async () => {
    const mixpanel = await ensureMixpanelInit();
    if (mixpanel) mixpanel.opt_in_tracking();
  })();
}
