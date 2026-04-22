import { useCallback, useEffect, useState } from "react";

export function usePersistedSet(key: string): {
  has: (id: string) => boolean;
  toggle: (id: string) => boolean; // returns new "added" state
  values: string[];
} {
  const [values, setValues] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setValues(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
  }, [key]);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(values));
    } catch {
      /* ignore */
    }
  }, [key, values]);

  const has = useCallback((id: string) => values.includes(id), [values]);
  const toggle = useCallback((id: string) => {
    let added = false;
    setValues((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      added = true;
      return [...prev, id];
    });
    return added;
  }, []);

  return { has, toggle, values };
}