import { useCallback, useState } from "react";

/**
 * One-time "first run" flag backed by localStorage.
 *
 * Returns `[shouldShow, markSeen]`:
 *  - `shouldShow` is true until `markSeen()` has been called once for `key`
 *    (persisted across sessions).
 *  - `markSeen()` flips it off and records it.
 *
 * Mirrors the defensive try/catch localStorage idiom in
 * src/lib/mindgym/storage.ts so private-mode / disabled storage never throws.
 */
export function useFirstRun(key: string): [boolean, () => void] {
  const [shouldShow, setShouldShow] = useState<boolean>(() => {
    try {
      return localStorage.getItem(key) !== "1";
    } catch {
      return false;
    }
  });

  const markSeen = useCallback(() => {
    setShouldShow(false);
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* storage unavailable — modal simply won't be remembered this session */
    }
  }, [key]);

  return [shouldShow, markSeen];
}
