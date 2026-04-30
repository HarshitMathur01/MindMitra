import { cn } from "@/lib/utils";

/**
 * Scene names map to subjects in the handcrafted_image source PNGs:
 *   hills      — meditation under tree with mountain backdrop (the closer)
 *   presence   — girl with translucent companion by a stream
 *   breath     — figure at lakeside breathing out a stream of leaves
 *   solitude   — person sitting with a deer at peach-sunset
 *   companions — two figures sitting together under a tree
 *   mountain   — meditation on a cliff with deer + birds + mountain
 */
type SceneName =
  | "hills"
  | "presence"
  | "breath"
  | "solitude"
  | "companions"
  | "mountain";

interface WatercolorSceneProps {
  name: SceneName;
  alt?: string;
  className?: string;
  width?: number;
  height?: number;
  /** Largest size the scene will render at, used to pick the best webp width. */
  maxRenderedWidth?: 480 | 960 | 1600;
  loading?: "eager" | "lazy";
}

/**
 * Watercolor illustration. Reads optimized WebP derivatives served
 * statically from /illustrations/. Source PNGs live in
 * src/components/handcrafted_image/ but are not imported directly
 * because they are 5–7 MB each — we only ship the WebP variants.
 *
 * Decorative by default (aria-hidden) — pass `alt` to make the
 * scene meaningful to screen readers.
 */
export function WatercolorScene({
  name,
  alt,
  className,
  width,
  height,
  maxRenderedWidth = 1600,
  loading = "lazy",
}: WatercolorSceneProps) {
  const base = `/illustrations/${name}`;

  const srcSet = [
    `${base}-480.webp 480w`,
    `${base}-960.webp 960w`,
    `${base}-1600.webp 1600w`,
  ].join(", ");

  return (
    <img
      src={`${base}-${maxRenderedWidth}.webp`}
      srcSet={srcSet}
      sizes={`(min-width: 1024px) ${maxRenderedWidth}px, 100vw`}
      alt={alt ?? ""}
      aria-hidden={alt ? undefined : true}
      width={width}
      height={height}
      loading={loading}
      decoding="async"
      className={cn("h-auto w-full select-none", className)}
      draggable={false}
    />
  );
}

export default WatercolorScene;
