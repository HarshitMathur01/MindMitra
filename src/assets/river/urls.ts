import { RIVER_MANIFEST, type RiverImageEntry, type RiverImageName } from "./manifest";

/**
 * Resolves the generated (content-hashed) filenames to real bundled URLs.
 *
 * The manifest only knows filenames — it is written by a Node script that has
 * no idea what Vite will do with them. This glob is what actually pulls the
 * files into the bundle graph and yields their final URLs. Eager because the
 * map has to be readable synchronously during render, and it is only ~72 URL
 * strings, not the image bytes.
 *
 * Lives here rather than in RiverImage.tsx because two callers need it: the
 * component, and `lib/preloadHeroScene.ts` running before React mounts. If the
 * two built their srcsets from different code the preload would miss and the
 * hero would be fetched twice.
 */
const ASSET_URLS = import.meta.glob<string>("./*.{avif,webp}", {
  eager: true,
  query: "?url",
  import: "default",
});

/** `./door-diya-640.0c66eb7e.avif` → `door-diya-640.0c66eb7e.avif` */
const BY_FILENAME = new Map(
  Object.entries(ASSET_URLS).map(([path, url]) => [path.split("/").pop() as string, url]),
);

/** Manifest filename → bundled URL. `undefined` if the manifest is stale. */
export function riverAssetUrl(filename: string): string | undefined {
  return BY_FILENAME.get(filename);
}

/**
 * A `width → filename` map from the manifest, rendered as a srcset string.
 *
 * `maxWidth` drops the larger rungs entirely rather than relying on `sizes` to
 * discourage them — `sizes` is in CSS pixels and gets multiplied by DPR, so on
 * a 2x phone `sizes="256px"` still asks for the 640 file. For an image that is
 * about to be blurred into a wash, that difference is pure waste and there is
 * no viewport where the big one is wanted.
 */
export function riverSrcSet(
  variants: Readonly<Record<number, string>>,
  maxWidth = Infinity,
): string {
  const widths = Object.keys(variants).map(Number).sort((a, b) => a - b);
  // Never emit an empty srcset: if every rung is above the cap, keep the
  // smallest one rather than rendering an image with no candidates.
  const kept = widths.filter((width) => width <= maxWidth);
  const chosen = kept.length ? kept : widths.slice(0, 1);

  return chosen
    .map((width) => {
      const url = riverAssetUrl(variants[width]);
      return url ? `${url} ${width}w` : null;
    })
    .filter(Boolean)
    .join(", ");
}

export interface RiverImageSources {
  avif: string;
  webp: string;
  /** Largest WebP — the `<img src>` for anything that groks neither. */
  fallback: string | undefined;
  width: number;
  height: number;
  /** Inline ~20px WebP data URI, painted under the image while it loads. */
  lqip: string;
}

/** Everything a `<picture>` needs for one named image. */
export function riverImageSources(name: RiverImageName, maxWidth = Infinity): RiverImageSources {
  const entry: RiverImageEntry = RIVER_MANIFEST[name];
  // Largest WebP at or under the cap — the <img src> fallback, for anything
  // that groks neither <source> nor AVIF. Same "never end up with nothing"
  // rule as riverSrcSet: if the cap excludes every rung, take the smallest.
  const webpWidths = Object.keys(entry.webp).map(Number).sort((a, b) => b - a);
  const widest = entry.webp[webpWidths.find((w) => w <= maxWidth) ?? webpWidths[webpWidths.length - 1]];

  return {
    avif: riverSrcSet(entry.avif, maxWidth),
    webp: riverSrcSet(entry.webp, maxWidth),
    fallback: widest ? riverAssetUrl(widest) : undefined,
    width: entry.width,
    height: entry.height,
    lqip: entry.lqip,
  };
}
