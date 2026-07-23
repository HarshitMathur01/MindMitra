import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const MOOD_LABELS = [
  "heavy",
  "low",
  "okay",
  "lifting",
  "bright",
] as const;

export type MoodLabel = (typeof MOOD_LABELS)[number];

export interface MoodLogEntry {
  id: string;
  user_id: string;
  logged_at: string;
  mood_index: number;
  mood_label: MoodLabel;
  source: string;
}

const WEEK_DAYS = 7;
const MOOD_LOG_QK = (userId: string | undefined) => ["mood-logs", userId] as const;

/**
 * Calendar-day key in the user's local timezone. `toISOString().slice(0,10)`
 * keys by UTC date, which shifts a day for UTC+ timezones (IST — the whole
 * target audience) and made "today's" log invisible to the constellation.
 */
export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

// Gate the remote round-trip until the mood_logs migration is live in the
// target Supabase project. Off by default keeps the dev console clean while
// running against an un-migrated backend. Flip to "true" in env once the
// migration is applied. With the flag off, logs fall back to per-user
// localStorage so the MoodPulse tap still lights up, ambience still tints,
// and the constellation still draws — single-device only, never synced.
const REMOTE_ENABLED =
  import.meta.env.VITE_SANCTUARY_MOOD_LOGS_REMOTE === "true";

const LOCAL_KEY_PREFIX = "mindmitra-sanctuary-mood-local";

function localKey(userId: string) {
  return `${LOCAL_KEY_PREFIX}:${userId}`;
}

function readLocalLogs(userId: string): MoodLogEntry[] {
  try {
    const raw = localStorage.getItem(localKey(userId));
    if (!raw) return [];
    const since = Date.now() - WEEK_DAYS * 24 * 60 * 60 * 1000;
    return (JSON.parse(raw) as MoodLogEntry[]).filter(
      (e) => new Date(e.logged_at).getTime() >= since,
    );
  } catch {
    return [];
  }
}

function writeLocalLogs(userId: string, logs: MoodLogEntry[]) {
  try {
    localStorage.setItem(localKey(userId), JSON.stringify(logs));
  } catch {
    /* storage may be unavailable — the tap still lights up for this visit */
  }
}

/**
 * Fetch the last 7 days of mood logs (most recent first) for the
 * SanctuaryHome constellation + ambience engine. Falls back gracefully to
 * an empty array on missing-table errors so the page never breaks the
 * first time someone runs against an un-migrated dev database.
 */
async function fetchWeekLogs(userId: string): Promise<MoodLogEntry[]> {
  const since = new Date();
  since.setDate(since.getDate() - WEEK_DAYS);

  const { data, error } = await (supabase as unknown as {
    from: (t: string) => any;
  })
    .from("mood_logs")
    .select("id, user_id, logged_at, mood_index, mood_label, source")
    .eq("user_id", userId)
    .gte("logged_at", since.toISOString())
    .order("logged_at", { ascending: false });

  if (error) {
    if (
      error.code === "42P01" ||
      (typeof error.message === "string" && error.message.includes("does not exist"))
    ) {
      return [];
    }
    throw error;
  }
  return (data ?? []) as MoodLogEntry[];
}

export function useMoodLog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  // Local and remote share one query key so every useMoodLog() instance
  // (MoodPulse, ConstellationMap, InnerWeather, AmbienceProvider) sees a
  // logged mood immediately — invalidation fans the update out through the
  // React Query cache in both modes.
  const { data: weekLogs = [], isLoading } = useQuery({
    queryKey: MOOD_LOG_QK(userId),
    queryFn: () =>
      REMOTE_ENABLED
        ? fetchWeekLogs(userId as string)
        : Promise.resolve(readLocalLogs(userId as string)),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const todayKey = localDayKey(new Date());
  const todayLog =
    weekLogs.find((e) => localDayKey(new Date(e.logged_at)) === todayKey) ?? null;

  const lastLog = weekLogs[0] ?? null;

  const logMutation = useMutation({
    mutationFn: async (index: number) => {
      if (!userId) return null;
      const label = MOOD_LABELS[index];
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => any;
      })
        .from("mood_logs")
        .insert({
          user_id: userId,
          mood_index: index,
          mood_label: label,
          source: "mood_pulse",
        })
        .select()
        .single();
      if (error) {
        if (
          error.code === "42P01" ||
          (typeof error.message === "string" && error.message.includes("does not exist"))
        ) {
          return null;
        }
        throw error;
      }
      return data as MoodLogEntry;
    },
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: MOOD_LOG_QK(userId) });
    },
  });

  const logMood = useCallback(
    (index: number) => {
      if (!userId) return;
      if (!REMOTE_ENABLED) {
        // Local fallback mirrors the server shape (newest-first insert) so
        // ConstellationMap / InnerWeather / ambience need no changes.
        const entry: MoodLogEntry = {
          id: `local-${Date.now()}`,
          user_id: userId,
          logged_at: new Date().toISOString(),
          mood_index: index,
          mood_label: MOOD_LABELS[index],
          source: "mood_pulse_local",
        };
        writeLocalLogs(userId, [entry, ...readLocalLogs(userId)]);
        queryClient.invalidateQueries({ queryKey: MOOD_LOG_QK(userId) });
        return;
      }
      logMutation.mutate(index);
    },
    [logMutation, queryClient, userId],
  );

  return {
    weekLogs,
    todayLog,
    lastLog,
    logMood,
    isLoading,
    isSaving: logMutation.isPending,
  };
}
