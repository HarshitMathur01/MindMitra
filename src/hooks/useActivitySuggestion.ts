/**
 * Manages the chat → activity suggestion lifecycle on the client.
 *
 * Responsibilities:
 *   - hold the *current* suggestion (latest `meta.suggested_activity` from the
 *     chat response),
 *   - hold a short *history* of recent suggestions (rendered as the panel's
 *     "recently shown" rail),
 *   - emit accept / dismiss handlers that POST to `/chat/activity-feedback`
 *     and write the sessionStorage handoff blob,
 *   - suppress entirely when the latest turn was a crisis (`urgency === 3`).
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  activityToRoute,
  clearChatHandoff,
  postActivityFeedback,
  writeChatHandoff,
  type ActivitySuggestion,
} from "@/lib/chat/activitySuggestion";
import { trackProductEvent } from "@/lib/productAnalytics";

const HISTORY_CAP = 2;
const SESSION_STORAGE_KEY = "mindmitra.chat.suggestion_history";

export interface SuggestionHistoryItem {
  suggestion: ActivitySuggestion;
  shown_at: string;
  status: "shown" | "dismissed" | "accepted";
}

interface UseActivitySuggestionResult {
  currentSuggestion: ActivitySuggestion | null;
  history: SuggestionHistoryItem[];
  acceptSuggestion: (s: ActivitySuggestion, ctx?: { trace_id?: string; session_id?: string }) => void;
  dismissSuggestion: (s: ActivitySuggestion, ctx?: { trace_id?: string; session_id?: string }) => void;
  /** Push a new turn's suggestion (called from chat response handler). */
  pushFromTurn: (params: {
    suggestion: ActivitySuggestion | null;
    urgency: number;
    trace_id?: string;
    session_id?: string;
  }) => void;
}

function readHistoryFromStorage(): SuggestionHistoryItem[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, HISTORY_CAP);
  } catch {
    return [];
  }
}

function writeHistoryToStorage(items: SuggestionHistoryItem[]): void {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(items.slice(0, HISTORY_CAP)));
  } catch {
    /* ignore */
  }
}

async function authToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export function useActivitySuggestion(): UseActivitySuggestionResult {
  const navigate = useNavigate();
  const [currentSuggestion, setCurrentSuggestion] = useState<ActivitySuggestion | null>(null);
  const [history, setHistory] = useState<SuggestionHistoryItem[]>(() => readHistoryFromStorage());

  useEffect(() => {
    writeHistoryToStorage(history);
  }, [history]);

  const pushFromTurn = useCallback<UseActivitySuggestionResult["pushFromTurn"]>(
    ({ suggestion, urgency }) => {
      // Crisis kill switch — defense-in-depth even though the backend already
      // refuses suggestions on urgency==3 turns.
      if (urgency === 3) {
        setCurrentSuggestion(null);
        setHistory([]);
        return;
      }
      if (!suggestion) {
        // Keep the previously visible suggestion until a fresh turn fires —
        // the rail shouldn't blink to empty just because this turn was
        // companion-mode banter. The panel will still render the prior card.
        return;
      }
      setCurrentSuggestion(suggestion);
      setHistory((prev) => {
        const next: SuggestionHistoryItem = {
          suggestion,
          shown_at: new Date().toISOString(),
          status: "shown",
        };
        const filtered = prev.filter((item) => item.suggestion.activity_id !== suggestion.activity_id);
        return [next, ...filtered].slice(0, HISTORY_CAP);
      });
      trackProductEvent("activity_suggested", {
        activity_id: suggestion.activity_id,
        activity_type: suggestion.activity_type,
        reason_code: suggestion.reason_code,
        confidence: suggestion.confidence,
      });
    },
    [],
  );

  const acceptSuggestion = useCallback<UseActivitySuggestionResult["acceptSuggestion"]>(
    (s, ctx) => {
      writeChatHandoff({
        trace_id: ctx?.trace_id,
        session_id: ctx?.session_id,
        activity_id: s.activity_id,
        reason_code: s.reason_code,
      });
      trackProductEvent("activity_accepted", {
        activity_id: s.activity_id,
        reason_code: s.reason_code,
      });
      // Fire-and-forget feedback POST — don't await before navigation.
      void authToken().then((token) => {
        if (!token) return;
        void postActivityFeedback(token, {
          activity_id: s.activity_id,
          action: "accepted",
          trace_id: ctx?.trace_id,
          session_id: ctx?.session_id,
          reason_code: s.reason_code,
        });
      });
      // Mark this item as accepted in history before navigation.
      setHistory((prev) =>
        prev.map((item) =>
          item.suggestion.activity_id === s.activity_id ? { ...item, status: "accepted" } : item,
        ),
      );
      navigate(activityToRoute(s));
    },
    [navigate],
  );

  const dismissSuggestion = useCallback<UseActivitySuggestionResult["dismissSuggestion"]>(
    (s, ctx) => {
      trackProductEvent("activity_dismissed", {
        activity_id: s.activity_id,
        reason_code: s.reason_code,
      });
      void authToken().then((token) => {
        if (!token) return;
        void postActivityFeedback(token, {
          activity_id: s.activity_id,
          action: "dismissed",
          trace_id: ctx?.trace_id,
          session_id: ctx?.session_id,
          reason_code: s.reason_code,
        });
      });
      setHistory((prev) =>
        prev.map((item) =>
          item.suggestion.activity_id === s.activity_id ? { ...item, status: "dismissed" } : item,
        ),
      );
      // If the dismissed item is the current primary card, drop it from the
      // foreground (it remains in the rail as a faded "recently shown" chip).
      setCurrentSuggestion((current) =>
        current?.activity_id === s.activity_id ? null : current,
      );
      // The handoff blob is only relevant on accept; clear any stale one.
      clearChatHandoff();
    },
    [],
  );

  return { currentSuggestion, history, acceptSuggestion, dismissSuggestion, pushFromTurn };
}
