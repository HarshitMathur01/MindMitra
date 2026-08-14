import type { CSSProperties } from "react";
import { riverImageSources } from "@/assets/river/urls";
import type { RiverImageName } from "@/assets/river/manifest";

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
  /**
   * Drop every srcset rung wider than this. For decorative art that is blurred
   * or washed out before it reaches the user, where no viewport or DPR
   * justifies the larger file. Leave unset for anything meant to be looked at.
   */
  maxWidth?: number;
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
export function RiverImage({
  name,
  alt,
  sizes,
  className,
  priority = false,
  maxWidth,
}: RiverImageProps) {
  const { avif, webp, fallback, width, height, lqip } = riverImageSources(name, maxWidth);

  // The ~20px placeholder, painted as the image's own background so it needs no
  // wrapper element and can't disagree with `object-fit: cover` above it. The
  // real image is opaque, so it covers this the instant it decodes — there is
  // nothing to fade out and no state to track. The blur is the upscale itself:
  // 20px stretched over the box is smooth by construction, which also means no
  // `filter` and so no compositing cost on a page with eighteen of these.
  const placeholder: CSSProperties = {
    backgroundImage: `url("${lqip}")`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  return (
    // `display: contents` so the <img> lays out as if it were a direct child of
    // whatever renders this. Without it the inline <picture> becomes the sizing
    // parent and `size-full` / `absolute inset-0` on the image resolve against
    // a zero-height box.
    <picture style={{ display: "contents" }}>
      <source type="image/avif" srcSet={avif} sizes={sizes} />
      <source type="image/webp" srcSet={webp} sizes={sizes} />
      <img
        src={fallback}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        // `async` even when priority: paired with fetchpriority=high the fetch
        // is already first in line, and `sync` only buys the right to block the
        // main thread on a 1264px AVIF decode — which delays the very paint it
        // was meant to bring forward.
        decoding="async"
        {...(priority ? PRIORITY_HINT : {})}
        className={className}
        style={placeholder}
      />
    </picture>
  );
}
