/**
 * localStore — tiny factory for the per-tool localStorage pattern used across
 * MindGym (worry vault, mood weather, thought journal, …).
 *
 * Semantics are deliberately identical to the hand-rolled pairs it replaces:
 * - read(): missing/empty key → fallback(); JSON.parse failure → fallback();
 *   NO schema validation — tools trust previously-written data, and validating
 *   here would silently drop in-flight user entries.
 * - write(): plain setItem(JSON.stringify(...)), un-caught. A quota error
 *   propagates to the caller exactly like the old save functions did.
 * - Keys are passed verbatim; renaming a key orphans real user data.
 */

export interface LocalStore<T> {
  key: string;
  read(): T;
  write(value: T): void;
  remove(): void;
}

export function createLocalStore<T>(
  key: string,
  fallback: () => T,
  opts?: {
    /** Legacy-data shaping applied after a successful parse (e.g. GratitudeGarden's entry normalization). */
    normalize?: (parsed: unknown) => T;
  },
): LocalStore<T> {
  return {
    key,
    read(): T {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback();
        const parsed = JSON.parse(raw) as unknown;
        return opts?.normalize ? opts.normalize(parsed) : (parsed as T);
      } catch {
        return fallback();
      }
    },
    write(value: T): void {
      localStorage.setItem(key, JSON.stringify(value));
    },
    remove(): void {
      localStorage.removeItem(key);
    },
  };
}
