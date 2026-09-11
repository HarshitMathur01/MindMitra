/**
 * devLog — console diagnostics that never ship.
 *
 * The chat/avatar path used to log message previews to the production console
 * on every assistant turn. That is a low-grade PII leak on a shared device and
 * it buries real signal in Sentry, so anything that touches message text logs
 * through here instead of `console.log` directly.
 */
export const devLog = (...args: unknown[]): void => {
  if (import.meta.env.DEV) console.log(...args);
};
