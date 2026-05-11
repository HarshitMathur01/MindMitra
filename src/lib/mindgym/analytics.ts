/**
 * MindGym analytics — privacy-first, best-effort.
 *
 * Requirements:
 * - Must never block gameplay or throw.
 * - Must never send user-entered text (no PII).
 *
 * Current behavior:
 * - Stores anonymized events in localStorage as a small ring buffer.
 * - Optionally tries to write to Supabase if a table exists (best-effort).
 */

import { supabase } from "@/integrations/supabase/client";
import type { ToolId } from "./types";

export type MindGymEventType =
  | "crisis_triggered"
  | "tool_started"
  | "tool_completed"
  | "journey_strip_viewed"
  | "next_tool_clicked";

export interface MindGymEventPayload {
  toolId?: ToolId;
  // For `next_tool_clicked` — the tool the user was finishing.
  fromToolId?: ToolId;
  // For `tool_completed` — XP awarded (no user text, safe to log).
  xp?: number;
}

interface StoredEvent {
  type: MindGymEventType;
  payload: MindGymEventPayload;
  ts: string;
}

const STORAGE_KEY = "mindmitra_mindgym_analytics_v1";
const MAX_EVENTS = 50;

function loadQueue(): StoredEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredEvent[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(events: StoredEvent[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    // ignore storage failure
  }
}

async function bestEffortSupabaseWrite(event: StoredEvent): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return;

    // Best-effort insert. If table doesn't exist, we silently ignore.
    await (supabase as unknown as {
      from: (t: string) => { insert: (rows: unknown[]) => Promise<unknown> };
    })
      .from("mindgym_analytics")
      .insert([
        {
          user_id: user.id,
          event_type: event.type,
          metadata: event.payload,
          created_at: event.ts,
        },
      ]);
  } catch {
    // never break UX for analytics
  }
}

export function trackMindGymEvent(
  type: MindGymEventType,
  payload: MindGymEventPayload,
): void {
  try {
    const ev: StoredEvent = { type, payload, ts: new Date().toISOString() };
    const q = loadQueue();
    q.push(ev);
    saveQueue(q);
    // fire-and-forget
    void bestEffortSupabaseWrite(ev);
  } catch {
    // never throw
  }
}

export interface MindGymCounter {
  key: string;
  count: number;
}

const COUNTERS_KEY = "mindmitra_mindgym_counters_v1";

export function incrementMindGymCounter(key: string, delta = 1): void {
  try {
    const raw = localStorage.getItem(COUNTERS_KEY);
    const counters: Record<string, number> = raw ? JSON.parse(raw) : {};
    counters[key] = (counters[key] || 0) + delta;
    localStorage.setItem(COUNTERS_KEY, JSON.stringify(counters));
  } catch {
    // ignore
  }
}

export function getMindGymCounter(key: string): number {
  try {
    const raw = localStorage.getItem(COUNTERS_KEY);
    const counters: Record<string, number> = raw ? JSON.parse(raw) : {};
    return counters[key] || 0;
  } catch {
    return 0;
  }
}

