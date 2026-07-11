/**
 * Runtime Google Fonts loader for route-scoped typefaces.
 *
 * Fonts used by a single surface (e.g. Campus Chess) don't belong in
 * index.html, where their stylesheet blocks first paint of every page.
 * Inject them when the surface mounts instead; `display=swap` in the
 * query keeps text visible while the files arrive.
 */

const loaded = new Set<string>();

export function ensureGoogleFonts(familiesQuery: string): void {
  if (loaded.has(familiesQuery)) return;
  loaded.add(familiesQuery);

  const href = `https://fonts.googleapis.com/css2?${familiesQuery}&display=swap`;
  if (document.querySelector(`link[href="${href}"]`)) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

/** Shippori Mincho B1 + Work Sans + JetBrains Mono — Campus Chess only. */
export const CAMPUS_CHESS_FONTS =
  "family=Shippori+Mincho+B1:wght@400;700;800&family=Work+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600";
