import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSnapshot } from "@/hooks/useSnapshot";

export type DoorId =
  | "chat"
  | "mindgym"
  | "journal"
  | "peer"
  | "therapist"
  | "reads";

/**
 * Door scoring window. Only the top three doors reshuffle; the lower row
 * (peer / therapist / reads) is intentionally stable so the page doesn't
 * reorganize itself dramatically week-to-week — quiet personalization,
 * not a moving target.
 */
const WINDOW_DAYS = 28;
const DECAY_DAYS = 14;
const SHUFFLEABLE: DoorId[] = ["chat", "mindgym", "journal"];
const STABLE: DoorId[] = ["peer", "therapist", "reads"];

const DEFAULT_ORDER: DoorId[] = [...SHUFFLEABLE, ...STABLE];

// Journals live in localStorage only (see Journal.tsx); there is no
// `journal_entries` table by design. The key + shape must stay in sync with
// the Journal page.
const JOURNAL_STORAGE_KEY = "mm_journal_entries";

interface StoredJournalEntry {
  date?: string | null;
}

function readJournalDates(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(JOURNAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredJournalEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => entry?.date)
      .filter((d): d is string => typeof d === "string" && d.length > 0);
  } catch {
    return [];
  }
}

/**
 * Phase 2: when /me/snapshot reports a clear dominant_mode for the last
 * 28 days, pin the matching surface to index 0 so the most-used door is
 * the first thing the user sees. `referral_bridge` promotes Therapist
 * Bridge out of the stable lower row — same swap, opposite direction —
 * because that mode means we want the user closer to a real clinician.
 */
const MODE_TO_DOOR: Record<string, DoorId> = {
  chat: "chat",
  companion: "chat",
  active_listener: "chat",
  recovery_check: "chat",
  skill_coach: "mindgym",
  psychoeducation: "mindgym",
  referral_bridge: "therapist",
};

interface DoorScore {
  id: DoorId;
  score: number;
}

interface RawDateRow {
  created_at?: string | null;
  completed_at?: string | null;
}

function decayedScore(dates: (string | null | undefined)[]): number {
  const now = Date.now();
  let score = 0;
  for (const ts of dates) {
    if (!ts) continue;
    const age = (now - new Date(ts).getTime()) / (1000 * 60 * 60 * 24);
    if (age < 0 || age > WINDOW_DAYS) continue;
    score += Math.exp(-age / DECAY_DAYS);
  }
  return score;
}

async function fetchDoorOrder(userId: string): Promise<DoorId[]> {
  const since = new Date();
  since.setDate(since.getDate() - WINDOW_DAYS);
  const sinceIso = since.toISOString();

  const sb = supabase as unknown as { from: (t: string) => any };

  const [chatRes, gymRes] = await Promise.all([
    sb
      .from("chat_messages")
      .select("created_at")
      .eq("user_id", userId)
      .gte("created_at", sinceIso),
    sb
      .from("user_activities")
      .select("completed_at")
      .eq("user_id", userId)
      .gte("completed_at", sinceIso),
  ]);

  const chatRows: RawDateRow[] = !chatRes.error ? chatRes.data ?? [] : [];
  const gymRows: RawDateRow[] = !gymRes.error ? gymRes.data ?? [] : [];
  const journalDates = readJournalDates();

  const scores: DoorScore[] = [
    { id: "chat", score: decayedScore(chatRows.map((r) => r.created_at)) },
    { id: "mindgym", score: decayedScore(gymRows.map((r) => r.completed_at)) },
    { id: "journal", score: decayedScore(journalDates) },
  ];

  // If nothing has any signal, preserve the default order rather than
  // randomly permuting on ties.
  const total = scores.reduce((a, b) => a + b.score, 0);
  if (total === 0) return DEFAULT_ORDER;

  scores.sort((a, b) => b.score - a.score);
  return [...scores.map((s) => s.id), ...STABLE];
}

/**
 * Apply mode-pinning on top of the usage-decay order. The pinned door
 * floats to index 0 wherever it currently sits — for a door that's already
 * in the stable lower row this also pulls it out of that row.
 */
function applyModePin(order: DoorId[], dominantMode: string | null | undefined): DoorId[] {
  if (!dominantMode) return order;
  const target = MODE_TO_DOOR[dominantMode];
  if (!target) return order;
  if (order[0] === target) return order;
  const rest = order.filter((id) => id !== target);
  return [target, ...rest];
}

export function useDoorOrder(): { order: DoorId[]; isLoading: boolean } {
  const { user } = useAuth();
  const { data: snapshot } = useSnapshot();
  const userId = user?.id;
  const { data, isLoading } = useQuery({
    queryKey: ["door-order", userId],
    queryFn: () => fetchDoorOrder(userId as string),
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
  const baseOrder = data ?? DEFAULT_ORDER;
  const order = useMemo(
    () => applyModePin(baseOrder, snapshot?.dominant_mode),
    [baseOrder, snapshot?.dominant_mode],
  );
  return { order, isLoading };
}
