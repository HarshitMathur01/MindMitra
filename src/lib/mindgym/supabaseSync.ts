import { supabase } from "@/integrations/supabase/client";
import type { GameHistoryEntry } from "./types";
import { loadProgress } from "./storage";

const SYNCED_KEYS_STORAGE = "mindmitra_mindgym_supabase_synced_keys_v1";

function getSyncedKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(SYNCED_KEYS_STORAGE);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function rememberSyncedKey(key: string): void {
  const s = getSyncedKeys();
  s.add(key);
  const arr = [...s].slice(-500);
  localStorage.setItem(SYNCED_KEYS_STORAGE, JSON.stringify(arr));
}

async function insertMindGymActivity(userId: string, entry: GameHistoryEntry): Promise<void> {
  const dedupeKey = `${entry.gameId}:${entry.completedAt}`;
  const { error } = await supabase.from("user_activities").insert({
    user_id: userId,
    session_id: null,
    activity_type: `mindgym_${entry.gameId}`,
    activity_data: {
      mindgym: true,
      mood_before: entry.moodBefore,
      mood_after: entry.moodAfter,
      xp_earned: entry.xpEarned,
      sync_key: dedupeKey,
    },
    score: entry.moodAfter ?? null,
    insights_generated: { source: "mindgym", sync_key: dedupeKey },
    completed_at: entry.completedAt,
  });
  if (error) {
    console.warn("[MindGym] Supabase sync failed:", error.message);
  } else {
    rememberSyncedKey(dedupeKey);
  }
}

/**
 * When `privacy_therapist_share` is enabled, mirror MindGym completions into `user_activities`
 * so the Therapist Bridge builder can use mood_before/after and tool usage signals.
 */
export async function syncMindGymHistoryToSupabase(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: rawSettings } = await supabase
    .from("user_settings")
    .select("privacy_therapist_share")
    .eq("user_id", user.id)
    .maybeSingle();

  const settings = rawSettings as { privacy_therapist_share?: boolean } | null;
  if (!settings?.privacy_therapist_share) return;

  const synced = getSyncedKeys();
  const progress = loadProgress();

  for (const entry of progress.gameHistory) {
    const key = `${entry.gameId}:${entry.completedAt}`;
    if (synced.has(key)) continue;
    await insertMindGymActivity(user.id, entry);
  }
}
