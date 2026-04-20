/**
 * Memory Mirror — typed client for the /me/memory backend surface.
 *
 * One-stop bridge between the React UI and the FastAPI Memory Mirror routes.
 * Each function takes the Supabase access token (from useAuth) and resolves
 * to a typed payload. All calls raise on non-2xx so the UI can show toasts.
 */
import { supabase } from "@/integrations/supabase/client";

const BASE = import.meta.env.VITE_BACKEND_URL || "";

async function authHeader(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }
  return { Authorization: `Bearer ${session.access_token}` };
}

export interface MemoryItem {
  id: string;
  summary: string;
  themes: string[];
  affect_label: string | null;
  importance: number;
  strength: number;
  created_at: string | null;
  archived: boolean;
}

export interface UserPreferences {
  user_id: string;
  tone: "warm" | "playful" | "matter_of_fact" | "calm_coach";
  prefers_listening: boolean;
  callback_comfort: number;
  language_register: "en" | "hi" | "hinglish" | "auto";
  response_length: "short" | "medium" | "long" | "auto";
  notes: string;
  incognito_until: string | null;
  updated_at: string | null;
}

export interface MemoryMirrorSnapshot {
  user_id: string;
  identity_card: Record<string, unknown> | null;
  recent_memories: MemoryItem[];
  affect_trend: {
    label: string | null;
    confidence: number;
    supporting_channels: string[];
    detail: string | null;
    sample_size: number;
  } | null;
  preferences: UserPreferences | null;
  incognito: { active: boolean; until: string | null };
  warnings: string[];
}

async function asJson<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    const text = await resp.text().catch(() => resp.statusText);
    throw new Error(`Memory Mirror call failed (${resp.status}): ${text}`);
  }
  return (await resp.json()) as T;
}

export async function fetchMemorySnapshot(
  opts: { limit?: number; includeArchived?: boolean } = {},
): Promise<MemoryMirrorSnapshot> {
  const headers = await authHeader();
  const q = new URLSearchParams();
  if (opts.limit) q.set("limit", String(opts.limit));
  if (opts.includeArchived) q.set("include_archived", "true");
  const resp = await fetch(`${BASE}/me/memory?${q.toString()}`, { headers });
  return asJson<MemoryMirrorSnapshot>(resp);
}

export async function patchMemory(
  memId: string,
  patch: { summary?: string; archived?: boolean },
): Promise<MemoryItem> {
  const headers = { ...(await authHeader()), "Content-Type": "application/json" };
  const resp = await fetch(`${BASE}/me/memory/episodes/${memId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(patch),
  });
  const body = await asJson<{ memory: MemoryItem }>(resp);
  return body.memory;
}

export async function deleteMemory(
  memId: string,
  opts: { hard?: boolean } = {},
): Promise<void> {
  const headers = await authHeader();
  const q = opts.hard ? "?hard=1" : "";
  const resp = await fetch(`${BASE}/me/memory/episodes/${memId}${q}`, {
    method: "DELETE",
    headers,
  });
  await asJson<{ ok: boolean }>(resp);
}

export async function pauseMemoryWrites(hours = 24): Promise<UserPreferences> {
  const headers = { ...(await authHeader()), "Content-Type": "application/json" };
  const resp = await fetch(`${BASE}/me/memory/pause`, {
    method: "POST",
    headers,
    body: JSON.stringify({ hours }),
  });
  const body = await asJson<{ preferences: UserPreferences }>(resp);
  return body.preferences;
}

export async function resumeMemoryWrites(): Promise<UserPreferences> {
  const headers = await authHeader();
  const resp = await fetch(`${BASE}/me/memory/resume`, {
    method: "POST",
    headers,
  });
  const body = await asJson<{ preferences: UserPreferences }>(resp);
  return body.preferences;
}

export async function updatePreferences(
  patch: Partial<UserPreferences>,
): Promise<UserPreferences> {
  const headers = { ...(await authHeader()), "Content-Type": "application/json" };
  const resp = await fetch(`${BASE}/me/memory/preferences`, {
    method: "PUT",
    headers,
    body: JSON.stringify(patch),
  });
  const body = await asJson<{ preferences: UserPreferences }>(resp);
  return body.preferences;
}
