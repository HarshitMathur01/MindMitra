import { MOOD_LABELS, type MoodLabel } from "@/hooks/useMoodLog";

export interface RiverMood {
  /** Index into MOOD_LABELS — this is what `logMood()` persists. */
  index: number;
  label: MoodLabel;
  /** oklch accent written to `--nr-mood`; recolours the whole page. */
  accent: string;
  /** Shown once the dot is tapped. Validating, never prescriptive. */
  note: string;
}

/**
 * Accent + copy per canonical mood label.
 *
 * The design this was ported from used its own vocabulary (heavy / restless /
 * flat / steady / warm) and persisted nothing. We keep MindMitra's canonical
 * `MOOD_LABELS` instead, because those indices are what writes to `mood_logs`
 * and what ambience, the constellation and the weekly trend all read back.
 * Only the accent and the copy come from the new design.
 */
const MOOD_STYLE: Record<MoodLabel, { accent: string; note: string }> = {
  heavy: {
    accent: "oklch(0.62 0.045 305)",
    note: "heavy is allowed here. nothing needs solving tonight.",
  },
  low: {
    accent: "oklch(0.63 0.048 235)",
    note: "low is just energy with nowhere to sit yet.",
  },
  okay: {
    accent: "oklch(0.6 0.02 120)",
    note: "okay days count too. you still showed up.",
  },
  lifting: {
    accent: "oklch(0.6 0.06 135)",
    note: "lifting. we'll keep it that way, slowly.",
  },
  bright: {
    accent: "oklch(0.66 0.1 55)",
    note: "bright. hold onto this one a little longer.",
  },
};

/** The five mood dots. Order matches MOOD_LABELS — index IS the mood index. */
export const RIVER_MOODS: readonly RiverMood[] = MOOD_LABELS.map((label, index) => ({
  index,
  label,
  ...MOOD_STYLE[label],
}));

/** River blue — the resting accent before any mood is known. */
export const NEUTRAL_MOOD_ACCENT = "oklch(0.626 0.045 235)";

export function moodAccentFor(index: number | null | undefined): string {
  if (index == null) return NEUTRAL_MOOD_ACCENT;
  return RIVER_MOODS[index]?.accent ?? NEUTRAL_MOOD_ACCENT;
}

/**
 * Greeting for the hour, in the register of this surface: observational rather
 * than cheerful. Separate from the scene picker because someone arriving at
 * 04:00 should read "Quiet night" while the art stays on the night scene.
 */
export function greetingForHour(hour: number): string {
  if (hour < 5) return "Quiet night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Slow afternoon";
  if (hour < 21) return "Soft evening";
  return "Quiet night";
}

// The scene picker moved to ./scene.ts so the build and the eager entry can
// import it without pulling React in. Re-exported here because this is where
// the rest of the surface has always looked for it.
export { sceneForHour, type TimeScene } from "./scene";
