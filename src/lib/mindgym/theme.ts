// Shared MindGym design tokens.
// Currently duplicated inside ToolShell.tsx and TherapeuticGameShell.tsx;
// extracted here so Phase 2 can delete the in-shell copies.

export type ThemeAccent =
  | "teal"
  | "purple"
  | "indigo"
  | "rose"
  | "amber"
  | "sky"
  | "emerald"
  | "clay";

export type SurfaceTone = "warm" | "dark";

export interface AccentSwatch {
  text: string;
  bg: string;
  hex: string;
}

// Warm "Quiet Companion" palette — sage / peach / honey / blush.
// Designed for cream/paper surfaces; readable on light backgrounds.
export const WARM_ACCENTS: Record<ThemeAccent, AccentSwatch> = {
  teal: { text: "text-[#3F6B47]", bg: "bg-[#9CAF88]", hex: "#9CAF88" },
  emerald: { text: "text-[#4f6b3f]", bg: "bg-[#8FB07A]", hex: "#8FB07A" },
  amber: { text: "text-[#a06b1f]", bg: "bg-[#E8C97A]", hex: "#E8C97A" },
  rose: { text: "text-[#a04a52]", bg: "bg-[#E8938A]", hex: "#E8938A" },
  purple: { text: "text-[#5b4a82]", bg: "bg-[#B8A6D9]", hex: "#B8A6D9" },
  indigo: { text: "text-[#3a4a6b]", bg: "bg-[#8FA0C2]", hex: "#8FA0C2" },
  sky: { text: "text-[#7a5a3a]", bg: "bg-[#E8D5B8]", hex: "#E8D5B8" },
  clay: { text: "text-[#b2613a]", bg: "bg-[#E8B98A]", hex: "#E8B98A" },
};

// Vivid neon Tailwind 400-shades, used on the dark game surface.
export const DARK_ACCENTS: Record<ThemeAccent, AccentSwatch> = {
  teal: { text: "text-teal-400", bg: "bg-teal-400", hex: "#2dd4bf" },
  emerald: { text: "text-emerald-400", bg: "bg-emerald-400", hex: "#34d399" },
  amber: { text: "text-amber-400", bg: "bg-amber-400", hex: "#fbbf24" },
  rose: { text: "text-rose-400", bg: "bg-rose-400", hex: "#fb7185" },
  purple: { text: "text-purple-400", bg: "bg-purple-400", hex: "#c084fc" },
  indigo: { text: "text-indigo-400", bg: "bg-indigo-400", hex: "#818cf8" },
  sky: { text: "text-sky-400", bg: "bg-sky-400", hex: "#38bdf8" },
  clay: { text: "text-orange-400", bg: "bg-orange-400", hex: "#fb923c" },
};

export const MINDGYM_ACCENTS: Record<SurfaceTone, Record<ThemeAccent, AccentSwatch>> = {
  warm: WARM_ACCENTS,
  dark: DARK_ACCENTS,
};

export function getAccent(tone: SurfaceTone, accent: ThemeAccent): AccentSwatch {
  return MINDGYM_ACCENTS[tone][accent];
}

// Default surface gradients per tone (used by both shells as the base background).
export const MINDGYM_SURFACE_GRADIENTS: Record<SurfaceTone, string> = {
  warm: "from-[#FAF6EC] via-[#F5EDE0] to-[#F3E7D2]",
  dark: "from-slate-900 via-[#111822] to-slate-900",
};

// Themed phase gradients for the dark game surface.
export type GamePhase = "idle" | "focus" | "success" | "alert";

export const GAME_PHASE_GRADIENTS: Record<GamePhase, string> = {
  idle: "from-[#0b1120] via-[#0e1829] to-[#0a1322]",
  focus: "from-[#091e2d] via-[#0c2838] to-[#071c2e]",
  success: "from-[#0e1833] via-[#111d3a] to-[#0c162e]",
  alert: "from-[#2a1315] via-[#1a0e10] to-[#120a0b]",
};

// Warm-tone class strings that were repeated verbatim across tool pages.
// Tokens exist only for byte-identical ≥2-file duplicates — per-element
// variations stay inline where they are.
export const WARM_CLASSES = {
  // Card/panel wrapper (BreathSphere, ThoughtTrap).
  panel:
    "rounded-[2rem] border border-border bg-white/88 shadow-[0_20px_50px_-30px_rgba(62,84,60,0.24)] backdrop-blur-sm",
  // Serif display heading (EmotionCompass, InnerCritic).
  headingLg:
    "font-serif-display italic text-[1.85rem] font-light text-[#2a1c14] mb-2 leading-tight",
  // Small sage action link (EmotionCompass, MoodWeather).
  actionLink: "text-xs text-[#3F6B47] hover:text-[#2c5235] transition-colors",
} as const;

// Tool-specific palettes. Centralised here so tool pages don't carry inline hex.

// Gratitude Garden: stem + bloom + glow trios for each flower variant.
// Bloom hexes intentionally align with WARM_ACCENTS rose / teal / amber.
export const GRATITUDE_BLOOM_TONES = [
  { stem: "#5e7a4a", bloom: "#E8938A", glow: "rgba(232, 147, 138, 0.42)" },
  { stem: "#4f6b3f", bloom: "#9CAF88", glow: "rgba(156, 175, 136, 0.42)" },
  { stem: "#7c6a3a", bloom: "#E8C97A", glow: "rgba(232, 201, 122, 0.42)" },
] as const;

// Memory Challenge: tile hues sweep within the cyan → teal → emerald family,
// matched to the C-major pentatonic frequency table in the tool.
export const MEMORY_TILE_HUES = [188, 178, 168, 195, 173, 158, 192, 165, 152] as const;
