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

// Gate the remote round-trip until the mood_logs migration is live in the
// target Supabase project. Off by default keeps the dev console clean while
// running against an un-migrated backend. Flip to "true" in env once the
// migration is applied.
const REMOTE_ENABLED =
  import.meta.env.VITE_SANCTUARY_MOOD_LOGS_REMOTE === "true";

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

  const { data: weekLogs = [], isLoading } = useQuery({
    queryKey: MOOD_LOG_QK(userId),
    queryFn: () => fetchWeekLogs(userId as string),
    enabled: !!userId && REMOTE_ENABLED,
    staleTime: 60_000,
  });

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayLog =
    weekLogs.find((e) => e.logged_at.slice(0, 10) === todayKey) ?? null;

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
      if (!REMOTE_ENABLED) return;
      logMutation.mutate(index);
    },
    [logMutation, userId],
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
