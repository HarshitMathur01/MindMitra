import { supabase } from "@/integrations/supabase/client";

/**
 * One shared read of a user's `user_settings` row.
 *
 * `useSettings` and `usePersonality` both read this table and both are plain
 * useState + useEffect hooks, so every component calling one issued its own
 * request. The authenticated `/` mounts four of them — SanctuaryHome and
 * MitraOrb call usePersonality, MitraOrb and Practice call useSettings — which
 * was four round-trips for one row on a surface opened over mobile data.
 *
 * This is deliberately not React Query. Both hooks own local edit state and
 * their own save paths; moving them onto queries means reworking those, and
 * the duplication is a *read* problem. Callers keep their existing shape and
 * share the request.
 *
 * Writers must call `invalidateUserSettingsRow` after a successful save, or
 * the next reader inside the TTL will see the pre-save row.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SettingsRow = any;

interface Entry {
  promise: Promise<SettingsRow | null>;
  at: number;
}

/**
 * Long enough to collapse the mount storm of a single page load, short enough
 * that a genuine re-read (returning to a screen minutes later) still hits the
 * network. Matches the 60s staleTime the React Query client uses elsewhere.
 */
const TTL_MS = 60_000;

const cache = new Map<string, Entry>();

/** Drop the cached row. Call after any write to `user_settings`. */
export function invalidateUserSettingsRow(userId?: string | null): void {
  if (userId) cache.delete(userId);
  else cache.clear();
}

/**
 * Read the row, sharing an in-flight or recent request with other callers.
 *
 * Rejections are not cached: a failed load must not pin every later caller to
 * the same error for the rest of the TTL.
 */
export function loadUserSettingsRow(
  userId: string,
  select = "*",
): Promise<SettingsRow | null> {
  const key = `${userId}:${select}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;

  const promise = (async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("user_settings")
      .select(select)
      .eq("user_id", userId)
      .maybeSingle();
    // PGRST116 is "no rows", which is a legitimate first-visit answer, not a
    // failure. Anything else is surfaced so callers keep their own fallbacks.
    if (error && error.code !== "PGRST116") throw error;
    return data ?? null;
  })();

  promise.catch(() => cache.delete(key));
  cache.set(key, { promise, at: Date.now() });
  return promise;
}
