/**
 * /me/memory — Memory Mirror.
 *
 * The transparency surface for everything Mitra has learned about a user.
 * Five stacked sections, organised top→bottom by emotional weight:
 *
 *    1. Header + identity card  — "this is who you are to me"
 *    2. Memory pause toggle     — incognito mode (DPDP control)
 *    3. Affect trend            — recent emotional pattern
 *    4. Procedural preferences  — how the user wants to be talked to
 *    5. Recent memories list    — view, edit, archive, hard-delete
 *
 * Design intent (Memory Mirror principle): if Mitra knows it, the user can see
 * it; if the user can see it, the user can change or remove it.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Undo2,
  Archive,
  ChevronRight,
} from "lucide-react";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchMemorySnapshot,
  patchMemory,
  deleteMemory,
  pauseMemoryWrites,
  resumeMemoryWrites,
  updatePreferences,
  type MemoryItem,
  type MemoryMirrorSnapshot,
  type UserPreferences,
} from "@/lib/memoryMirror";

const eyebrow = "text-[11px] font-medium uppercase tracking-[0.2em] text-ink-5";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function MemoryMirror() {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<MemoryMirrorSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await fetchMemorySnapshot({
        limit: 50,
        includeArchived,
      });
      setSnapshot(snap);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not load memory mirror.",
      );
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  const incognito = snapshot?.incognito;

  const togglePause = useCallback(async () => {
    try {
      if (incognito?.active) {
        await resumeMemoryWrites();
        toast.success("Memory writes resumed.");
      } else {
        await pauseMemoryWrites(24);
        toast.success("Memory paused for 24 hours.");
      }
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not toggle pause.");
    }
  }, [incognito?.active, refresh]);

  const onArchive = useCallback(
    async (m: MemoryItem) => {
      try {
        await patchMemory(m.id, { archived: !m.archived });
        toast.success(m.archived ? "Memory restored." : "Memory archived.");
        await refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Archive failed.");
      }
    },
    [refresh],
  );

  const onDelete = useCallback(
    async (m: MemoryItem) => {
      if (
        !window.confirm(
          "Permanently delete this memory? This also removes it from semantic " +
            "search and cannot be undone.",
        )
      ) {
        return;
      }
      try {
        await deleteMemory(m.id, { hard: true });
        toast.success("Memory permanently deleted.");
        await refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed.");
      }
    },
    [refresh],
  );

  const onSaveEdit = useCallback(
    async (m: MemoryItem) => {
      const next = draft.trim();
      if (!next) {
        toast.error("Summary cannot be empty.");
        return;
      }
      try {
        await patchMemory(m.id, { summary: next });
        toast.success("Memory updated.");
        setEditingId(null);
        await refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Update failed.");
      }
    },
    [draft, refresh],
  );

  const onPrefsChange = useCallback(
    async (patch: Partial<UserPreferences>) => {
      try {
        await updatePreferences(patch);
        await refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Preferences failed.");
      }
    },
    [refresh],
  );

  const visibleMemories = useMemo(
    () => snapshot?.recent_memories ?? [],
    [snapshot],
  );

  return (
    <>
      <Header />
      <PageShell>
        <motion.div
          className="mx-auto flex w-full max-w-3xl flex-col gap-8 py-8"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32 }}
        >
          {/* Header */}
          <header className="flex flex-col gap-2">
            <span className={eyebrow}>Memory mirror</span>
            <h1 className="text-2xl font-semibold leading-tight text-ink-1">
              What MindMitra remembers about you
            </h1>
            <p className="text-sm text-ink-4">
              Everything below is yours to view, edit, or remove at any time.
              Memory only serves you — never the other way around.
            </p>
          </header>

          {/* Pause writes / incognito */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {incognito?.active ? (
                  <EyeOff className="h-5 w-5 text-amber-500" />
                ) : (
                  <Eye className="h-5 w-5 text-emerald-500" />
                )}
                <CardTitle className="text-base">
                  {incognito?.active
                    ? "Memory paused"
                    : "Memory recording"}
                </CardTitle>
              </div>
              <Switch
                checked={!incognito?.active}
                onCheckedChange={togglePause}
                aria-label="Toggle memory writes"
              />
            </CardHeader>
            <CardContent className="text-sm text-ink-4">
              {incognito?.active ? (
                <>
                  Paused until{" "}
                  <span className="font-medium text-ink-2">
                    {formatDate(incognito.until)}
                  </span>
                  . Mitra will still talk with you, but won't form new memories
                  during this window.
                </>
              ) : (
                <>
                  Mitra is forming new memories from your sessions. You can pause
                  this anytime — it takes effect immediately.
                </>
              )}
            </CardContent>
          </Card>

          {/* Identity + affect summary */}
          {snapshot?.identity_card && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Identity card</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs text-ink-3">
                  {JSON.stringify(snapshot.identity_card, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {snapshot?.affect_trend?.label && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent emotional pattern</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-ink-3">
                <p>
                  Trend:{" "}
                  <span className="font-medium text-ink-1">
                    {snapshot.affect_trend.label}
                  </span>{" "}
                  · confidence{" "}
                  {(snapshot.affect_trend.confidence * 100).toFixed(0)}% over{" "}
                  {snapshot.affect_trend.sample_size} signals.
                </p>
                {snapshot.affect_trend.detail && (
                  <p className="mt-1 text-ink-4">{snapshot.affect_trend.detail}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Preferences */}
          {snapshot?.preferences && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">How you'd like to be heard</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-row items-center justify-between gap-4">
                  <Label htmlFor="prefers-listening" className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-ink-2">
                      Just listen — don't try to fix
                    </span>
                    <span className="text-xs text-ink-5">
                      Biases responses toward validation and reflection.
                    </span>
                  </Label>
                  <Switch
                    id="prefers-listening"
                    checked={snapshot.preferences.prefers_listening}
                    onCheckedChange={(v) => onPrefsChange({ prefers_listening: v })}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium text-ink-2">
                    Reference past sessions ({Math.round(snapshot.preferences.callback_comfort * 100)}%)
                  </Label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={snapshot.preferences.callback_comfort}
                    onChange={(e) =>
                      onPrefsChange({ callback_comfort: Number(e.target.value) })
                    }
                  />
                  <span className="text-xs text-ink-5">
                    Lower = fewer "I remember you said…" callbacks.
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Memory list */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent memories</CardTitle>
              <button
                onClick={() => setIncludeArchived((s) => !s)}
                className="text-xs text-ink-5 underline-offset-2 hover:underline"
              >
                {includeArchived ? "Hide archived" : "Show archived"}
              </button>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {loading && (
                <p className="text-sm text-ink-5">Loading memories…</p>
              )}
              {!loading && visibleMemories.length === 0 && (
                <p className="text-sm text-ink-5">
                  No memories yet — they'll appear here as you chat.
                </p>
              )}
              {visibleMemories.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col gap-2 rounded-lg border border-border/60 p-3 ${
                    m.archived ? "opacity-60" : ""
                  }`}
                >
                  {editingId === m.id ? (
                    <Textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      autoFocus
                      rows={3}
                      className="text-sm"
                    />
                  ) : (
                    <p className="text-sm leading-snug text-ink-2">{m.summary}</p>
                  )}

                  <div className="flex flex-row items-center justify-between text-xs text-ink-5">
                    <span>
                      {formatDate(m.created_at)}
                      {m.affect_label && ` · ${m.affect_label}`}
                      {m.archived && ` · archived`}
                    </span>
                    <div className="flex items-center gap-1">
                      {editingId === m.id ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                          <Button size="sm" onClick={() => onSaveEdit(m)}>
                            Save
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(m.id);
                              setDraft(m.summary);
                            }}
                            aria-label="Edit memory"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onArchive(m)}
                            aria-label={m.archived ? "Restore" : "Archive"}
                          >
                            {m.archived ? (
                              <Undo2 className="h-4 w-4" />
                            ) : (
                              <Archive className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDelete(m)}
                            aria-label="Delete forever"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </PageShell>
      <Footer />
    </>
  );
}
