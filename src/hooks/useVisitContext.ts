import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type VisitBucket =
  | "first-visit"
  | "today"
  | "this-week"
  | "returning-after-gap";

export interface VisitContext {
  bucket: VisitBucket;
  /** True while we don't yet know — components should render neutrally. */
  loading: boolean;
}

/**
 * Coarse re-entry context for the landing page. Buckets only — never
 * exposes raw "X days" counts. Identity framing is intentional:
 * "you've been here this week" beats "3-day streak" in this product.
 *
 * Heuristic uses the chat_messages.created_at column for the user. If
 * the table isn't readable (RLS / unmigrated dev DB) we degrade to
 * 'first-visit' so the UI shows the neutral form.
 */
async function fetchVisitBucket(userId: string): Promise<VisitBucket> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data, error } = await (supabase as unknown as {
    from: (t: string) => any;
  })
    .from("chat_messages")
    .select("created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return "first-visit";
  }
  const rows = (data ?? []) as { created_at: string }[];
  if (rows.length === 0) return "first-visit";

  const todayKey = new Date().toISOString().slice(0, 10);
  const recentDayKeys = new Set<string>();
  let mostRecent: Date | null = null;
  for (const r of rows) {
    const d = new Date(r.created_at);
    if (!mostRecent || d > mostRecent) mostRecent = d;
    if (d >= sevenDaysAgo) recentDayKeys.add(r.created_at.slice(0, 10));
  }

  if (recentDayKeys.has(todayKey)) return "today";

  if (mostRecent) {
    const daysSince = (Date.now() - mostRecent.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > 7) return "returning-after-gap";
  }
  if (recentDayKeys.size > 0) return "this-week";
  return "returning-after-gap";
}

export function useVisitContext(): VisitContext {
  const { user } = useAuth();
  const userId = user?.id;
  const { data, isLoading } = useQuery({
    queryKey: ["visit-context", userId],
    queryFn: () => fetchVisitBucket(userId as string),
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
  return {
    bucket: data ?? "first-visit",
    loading: isLoading,
  };
}
