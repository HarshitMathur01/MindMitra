import {
  RIVER_MANIFEST,
  type RiverImageEntry,
  type RiverImageName,
} from "@/assets/river/manifest";

/**
 * Resolves the generated (content-hashed) filenames to real bundled URLs.
 *
 * The manifest only knows filenames — it is written by a Node script that has
 * no idea what Vite will do with them. This glob is what actually pulls the
 * files into the bundle graph and yields their final URLs. Eager because the
 * map has to be readable synchronously during render, and it is only ~72 URL
 * strings, not the image bytes.
 */
const ASSET_URLS = import.meta.glob<string>("@/assets/river/*.{avif,webp}", {
  eager: true,
  query: "?url",
  import: "default",
});

/** `.../door-diya-640.0c66eb7e.avif` → `door-diya-640.0c66eb7e.avif` */
const BY_FILENAME = new Map(
  Object.entries(ASSET_URLS).map(([path, url]) => [path.split("/").pop() as string, url]),
);

function srcSet(variants: Readonly<Record<number, string>>): string {
  return Object.entries(variants)
    .map(([width, filename]) => {
      const url = BY_FILENAME.get(filename);
      return url ? `${url} ${width}w` : null;
    })
    .filter(Boolean)
    .join(", ");
}

/**
 * react-dom 18 doesn't know the camelCase `fetchPriority` prop — React 19 added
 * it — so it warns and sets the attribute verbatim anyway. Pass the lowercase
 * HTML attribute name instead; that spelling goes through silently. Only `high`
 * is worth emitting, `auto` is the browser default. Drop this indirection and
 * go back to `fetchPriority` if we move to React 19.
 */
const PRIORITY_HINT = { fetchpriority: "high" } as React.ImgHTMLAttributes<HTMLImageElement>;

interface RiverImageProps {
  name: RiverImageName;
  alt: string;
  /** `sizes` attribute — how wide this paints at each breakpoint. */
  sizes: string;
  className?: string;
  /**
   * Above the fold. Skips lazy-loading and raises fetch priority. Exactly one
   * image per page should set this — on this page it is the hero backdrop for
   * the current time of day.
   */
  priority?: boolean;
}

/**
 * A `<picture>` over the Night River art, AVIF first with a WebP fallback.
 *
 * The source art is ~1.8 MB per file at near-lossless quality; the variants
 * behind this component are ~30–65 KB. See scripts/optimize-river-images.mjs.
 *
 * `width`/`height` are always set so the browser reserves the box and the page
 * doesn't reflow as scenes load — this page is one long scroll and a late
 * layout shift is very visible.
 */
export function RiverImage({ name, alt, sizes, className, priority = false }: RiverImageProps) {
  const entry: RiverImageEntry = RIVER_MANIFEST[name];
  // Largest WebP is the <img src> fallback, for anything that understands
  // neither <source> nor AVIF.
  const widest = Object.entries(entry.webp).sort(
    ([a], [b]) => Number(b) - Number(a),
  )[0]?.[1];
  const fallback = widest ? BY_FILENAME.get(widest) : undefined;

  return (
    // `display: contents` so the <img> lays out as if it were a direct child of
    // whatever renders this. Without it the inline <picture> becomes the sizing
    // parent and `size-full` / `absolute inset-0` on the image resolve against
    // a zero-height box.
    <picture style={{ display: "contents" }}>
      <source type="image/avif" srcSet={srcSet(entry.avif)} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet(entry.webp)} sizes={sizes} />
      <img
        src={fallback}
        alt={alt}
        width={entry.width}
        height={entry.height}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        {...(priority ? PRIORITY_HINT : {})}
        className={className}
      />
    </picture>
  );
}
