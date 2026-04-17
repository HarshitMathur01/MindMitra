import type { CSSProperties } from "react";

/**
 * Hero photos vary in luminance. We do **not** run vision/LLM per request (slow, costly,
 * brittle). Instead we assign a small **readability tier** per known asset URL fragment.
 * New hero images: add a row here after a quick visual check in light mode.
 */
export type HeroReadTier = "bright" | "balanced" | "deep";

const URL_TIER_HINTS: { needle: string; tier: HeroReadTier }[] = [
  { needle: "photo-1526344966", tier: "bright" },
  { needle: "photo-1581205445756", tier: "bright" },
  { needle: "photo-1700409670474", tier: "bright" },
  { needle: "photo-1532274402911", tier: "deep" },
];

export function getHeroReadTier(imageUrl: string): HeroReadTier {
  for (const { needle, tier } of URL_TIER_HINTS) {
    if (imageUrl.includes(needle)) return tier;
  }
  return "balanced";
}

/** Bottom scrim: stronger in light + “bright” tiers so ink text stays readable without a full black plate. */
export function getHeroScrimStyle(tier: HeroReadTier, isDark: boolean): CSSProperties {
  if (isDark) {
    return {
      pointerEvents: "none",
      position: "absolute",
      insetInline: 0,
      bottom: 0,
      height: "56%",
      background: "linear-gradient(to top, hsl(var(--ink-2)) 0%, hsl(var(--ink-2) / 0.82) 44%, transparent 100%)",
    };
  }
  const light = {
    bright: { height: "74%", midOpacity: 0.96, midStop: "34%" },
    balanced: { height: "62%", midOpacity: 0.9, midStop: "40%" },
    deep: { height: "50%", midOpacity: 0.78, midStop: "46%" },
  }[tier];
  return {
    pointerEvents: "none",
    position: "absolute",
    insetInline: 0,
    bottom: 0,
    height: light.height,
    background: `linear-gradient(to top, hsl(var(--ink-0)) 0%, hsl(var(--ink-0) / ${light.midOpacity}) ${light.midStop}, transparent 100%)`,
  };
}

/** Optional second veil for very high-key photos (snow, yellow fields) — light mode only. */
export function getHeroExtraVeilStyle(tier: HeroReadTier, isDark: boolean): CSSProperties | null {
  if (isDark || tier !== "bright") return null;
  return {
    pointerEvents: "none",
    position: "absolute",
    insetInline: 0,
    bottom: 0,
    height: "42%",
    background: "linear-gradient(to top, hsl(var(--ink-8) / 0.08) 0%, transparent 100%)",
  };
}

/** Subtle halo so display type survives edge cases without a heavy frosted panel. */
export function heroGreetingHaloClass(tier: HeroReadTier, isDark: boolean): string {
  if (isDark) return "";
  if (tier === "bright") {
    return "[text-shadow:0_1px_0_hsl(var(--ink-0)),0_0_32px_hsl(var(--ink-0)/0.88),0_2px_12px_hsl(var(--ink-0)/0.55)]";
  }
  if (tier === "balanced") {
    return "[text-shadow:0_1px_0_hsl(var(--ink-0)),0_0_24px_hsl(var(--ink-0)/0.65)]";
  }
  return "";
}
