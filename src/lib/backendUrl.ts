/**
 * Single source of truth for the chatbotAgent HTTP base.
 *
 * `VITE_BACKEND_URL` is entered by hand in the Vercel dashboard, and a
 * trailing slash there is easy to miss: `${base}/anam/session-token` then
 * requests `//anam/session-token`, which Starlette treats as a different
 * path and 404s. That silently killed the whole Anam surface in production
 * (avatar start, heartbeat quota, and the out-of-band crisis interceptor)
 * while `/chat` — which happened to strip the slash inline — kept working.
 *
 * Normalise once here so no call site has to remember.
 */

/** The backend origin with any trailing slash removed. `""` when unset. */
export const BACKEND_BASE: string = (
  (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim() ?? ""
).replace(/\/+$/, "");

/**
 * Absolute URL for a backend path.
 *
 * @param path leading-slash path, e.g. `/anam/session-token`
 * @param fallbackToOrigin when true, fall back to `window.location.origin`
 *   instead of throwing if `VITE_BACKEND_URL` is unset (dev / same-origin).
 */
export function backendUrl(path: string, fallbackToOrigin = true): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  if (BACKEND_BASE) return `${BACKEND_BASE}${suffix}`;
  if (import.meta.env.PROD && !fallbackToOrigin) {
    throw new Error(`Missing VITE_BACKEND_URL for production request to ${suffix}`);
  }
  if (typeof window === "undefined") return suffix;
  return `${window.location.origin.replace(/\/+$/, "")}${suffix}`;
}
