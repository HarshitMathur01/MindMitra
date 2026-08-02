import { useEffect, useState } from "react";

const JOURNAL_STORAGE_KEY = "mm_journal_entries";
const CHAT_SESSION_KEY = "currentChatSession";

interface StoredJournalEntry {
  id?: string;
  date?: string | null;
  text?: string | null;
}

export type OpenThread =
  | {
      kind: "journal";
      /** The user's own words. Never paraphrased, never extended. */
      text: string;
      day: string;
      to: string;
    }
  | { kind: "chat"; to: string }
  | null;

function formatDay(iso: string | null | undefined): string {
  if (!iso) return "recently";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "recently";

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);

  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

/**
 * The thread the user left open, if there is one.
 *
 * Prefers the most recent journal entry, because it has words to show. Falls
 * back to "there is a chat session to resume", which is all the previous
 * ResumeCard ever knew. Returns null when there is nothing open — the caller
 * omits the section entirely rather than rendering an empty prompt.
 *
 * Both sources are localStorage-only and read on mount. Journals in particular
 * are deliberately device-local (see Journal.tsx — there is no
 * `journal_entries` table), so nothing here is a network read and nothing here
 * leaves the device.
 */
export function useOpenThread(): OpenThread {
  const [thread, setThread] = useState<OpenThread>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(JOURNAL_STORAGE_KEY);
      const parsed: StoredJournalEntry[] = raw ? JSON.parse(raw) : [];

      if (Array.isArray(parsed)) {
        // Journal.tsx writes newest-first, but sort defensively rather than
        // trusting insertion order across app versions.
        const latest = parsed
          .filter((e) => typeof e?.text === "string" && e.text.trim().length > 0)
          .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime())[0];

        if (latest?.text) {
          setThread({
            kind: "journal",
            text: latest.text.trim(),
            day: formatDay(latest.date),
            to: "/journal",
          });
          return;
        }
      }
    } catch {
      // Corrupt or unavailable storage is not worth surfacing here — fall
      // through to the chat check.
    }

    try {
      if (window.localStorage.getItem(CHAT_SESSION_KEY)) {
        setThread({ kind: "chat", to: "/chat" });
      }
    } catch {
      /* no storage access — leave the section out */
    }
  }, []);

  return thread;
}
