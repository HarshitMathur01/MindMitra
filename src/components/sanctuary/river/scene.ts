import type { RiverImageName } from "@/assets/river/manifest";

/**
 * Which hillside belongs to which hour — and nothing else.
 *
 * Split out of `moods.ts` because three very different consumers need it and
 * only one of them can afford React:
 *
 *   1. `useTimeScene()` → the page, at render time.
 *   2. `lib/preloadHeroScene.ts` → the eager entry, before React mounts.
 *   3. `vite.config.ts` → the build, to bake an hour→scene table into the
 *      `<head>` script that starts the hero fetch before any JS chunk lands.
 *
 * (3) is the binding constraint: Vite loads its config through esbuild, so this
 * module must stay free of value imports that drag in React or the `@/` alias.
 * Keep the manifest import type-only.
 *
 * `moods.ts` re-exports both symbols, so existing call sites are unaffected.
 */
export type TimeScene = "morning" | "afternoon" | "evening" | "night";

export function sceneForHour(hour: number): TimeScene {
  if (hour < 5) return "night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

/**
 * The hero backdrop per scene. Lives here rather than in Hero.tsx so the
 * `<head>` preload and the element it is meant to satisfy cannot name
 * different images — a mismatch there is silently twice the bytes.
 */
export const HERO_SCENE_IMAGE: Record<TimeScene, { name: RiverImageName; alt: string }> = {
  morning: {
    name: "hero-landscape-morning",
    alt: "Watercolour hillside in soft rose dawn light",
  },
  afternoon: {
    name: "hero-landscape-afternoon",
    alt: "Watercolour hillside under a pale blue afternoon sky",
  },
  evening: {
    name: "hero-landscape-evening",
    alt: "Watercolour hillside at amber sunset",
  },
  night: {
    name: "hero-landscape-night",
    alt: "Watercolour hillside under a starlit night sky",
  },
};

/** `sizes` for the hero backdrop. Shared with the preload's `imagesizes`. */
export const HERO_SIZES = "100vw";
