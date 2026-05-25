/**
 * Chat → Activity bridge.
 *
 * Type mirror of the backend `ActivitySuggestion` model (see
 * `chatbotAgent/app/models/signals.py`) plus a few helpers that:
 *   - look up the MindGym tool definition by id (for icon + gradient + minutes),
 *   - resolve an `activity_id` to its target route,
 *   - manage the sessionStorage handoff blob that lets a tool know it was
 *     opened from chat (and lets chat know the user came back).
 *
 * The "living thread" framing: the chat doesn't end when the user clicks
 * into an activity — it pauses. The handoff blob is the wire between the
 * two surfaces.
 */
import { MINDGYM_TOOLS } from "@/lib/mindgym/catalog";
import type { MindGymTool, ToolId } from "@/lib/mindgym/types";

export type ActivityType = "mindgym_tool" | "route";

export interface ActivitySuggestion {
  activity_id: string;
  activity_type: ActivityType;
  title: string;
  reason_code: string;
  confidence: number;
  voice_hint: string;
  crisis_safe: boolean;
  minutes?: number | null;
  section?: string | null;
}

export type ActivityFeedbackAction = "accepted" | "dismissed" | "completed";

export interface ChatActivityHandoff {
  trace_id?: string;
  session_id?: string;
  activity_id: string;
  reason_code?: string;
  arrived_from: "chat";
  arrived_at: string;
  completed?: boolean;
  completed_at?: string;
}

export const HANDOFF_STORAGE_KEY = "mindmitra.chat.activity_handoff";
export const HANDOFF_TTL_MS = 30 * 60 * 1000; // 30 minutes — stale blobs go quietly

const TOOL_INDEX: Record<string, MindGymTool> = Object.fromEntries(
  MINDGYM_TOOLS.map((tool) => [tool.id, tool]),
);

/** Look up a MindGym tool by id. Returns null for routes or unknown ids. */
export function getMindGymTool(activityId: string): MindGymTool | null {
  return TOOL_INDEX[activityId] ?? null;
}

/**
 * Resolve an `activity_id` to a route path the router can navigate to.
 * MindGym tool ids become `/mindgym/:toolId`; absolute paths pass through.
 */
export function activityToRoute(suggestion: Pick<ActivitySuggestion, "activity_id" | "activity_type">): string {
  if (suggestion.activity_type === "route" || suggestion.activity_id.startsWith("/")) {
    return suggestion.activity_id;
  }
  return `/mindgym/${suggestion.activity_id}`;
}

/** Parse the `suggested_activity` blob from `MhaChatHttpResponse.meta` — defensive. */
export function parseSuggestionFromMeta(meta: Record<string, unknown> | undefined): ActivitySuggestion | null {
  if (!meta) return null;
  const raw = (meta as { suggested_activity?: unknown }).suggested_activity;
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<ActivitySuggestion>;
  if (typeof candidate.activity_id !== "string" || candidate.activity_id.length === 0) return null;
  if (candidate.activity_type !== "mindgym_tool" && candidate.activity_type !== "route") return null;
  if (typeof candidate.title !== "string" || typeof candidate.voice_hint !== "string") return null;
  return {
    activity_id: candidate.activity_id,
    activity_type: candidate.activity_type,
    title: candidate.title,
    reason_code: typeof candidate.reason_code === "string" ? candidate.reason_code : "unknown",
    confidence: typeof candidate.confidence === "number" ? candidate.confidence : 0.5,
    voice_hint: candidate.voice_hint,
    crisis_safe: typeof candidate.crisis_safe === "boolean" ? candidate.crisis_safe : true,
    minutes: typeof candidate.minutes === "number" ? candidate.minutes : null,
    section: typeof candidate.section === "string" ? candidate.section : null,
  };
}

/* ── sessionStorage handoff (chat ↔ tool) ─────────────────────────────── */

function safeStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function writeChatHandoff(blob: Omit<ChatActivityHandoff, "arrived_from" | "arrived_at">): void {
  const storage = safeStorage();
  if (!storage) return;
  const payload: ChatActivityHandoff = {
    ...blob,
    arrived_from: "chat",
    arrived_at: new Date().toISOString(),
  };
  try {
    storage.setItem(HANDOFF_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / disabled storage — degrade silently */
  }
}

export function readChatHandoff(): ChatActivityHandoff | null {
  const storage = safeStorage();
  if (!storage) return null;
  const raw = storage.getItem(HANDOFF_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ChatActivityHandoff;
    if (parsed.arrived_from !== "chat" || !parsed.activity_id) return null;
    const ts = Date.parse(parsed.arrived_at);
    if (Number.isFinite(ts) && Date.now() - ts > HANDOFF_TTL_MS) {
      storage.removeItem(HANDOFF_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    storage.removeItem(HANDOFF_STORAGE_KEY);
    return null;
  }
}

export function markHandoffCompleted(): ChatActivityHandoff | null {
  const handoff = readChatHandoff();
  if (!handoff) return null;
  const storage = safeStorage();
  if (!storage) return handoff;
  const updated: ChatActivityHandoff = {
    ...handoff,
    completed: true,
    completed_at: new Date().toISOString(),
  };
  try {
    storage.setItem(HANDOFF_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    /* ignore */
  }
  return updated;
}

export function clearChatHandoff(): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(HANDOFF_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/* ── network: feedback endpoint ───────────────────────────────────────── */

const CHAT_BASE = (() => {
  const backendUrl = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim();
  if (backendUrl) return backendUrl.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin.replace(/\/$/, "");
  return "";
})();

export async function postActivityFeedback(
  token: string,
  payload: {
    activity_id: string;
    action: ActivityFeedbackAction;
    trace_id?: string;
    session_id?: string;
    reason_code?: string;
  },
): Promise<void> {
  if (!CHAT_BASE) return;
  try {
    await fetch(`${CHAT_BASE}/chat/activity-feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch (err) {
    // Best-effort: the backend write is already best-effort. A failed POST
    // here should never block UI flow.
    if (import.meta.env.DEV) {
      console.warn("[activity-feedback] post failed", err);
    }
  }
}

/* ── narrow helpers ──────────────────────────────────────────────────── */

export function isMindGymToolId(activityId: string): activityId is ToolId {
  return activityId in TOOL_INDEX;
}
