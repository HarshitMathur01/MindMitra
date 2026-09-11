import { MOOD_LABELS, type MoodLabel } from "@/hooks/useMoodLog";
import type { RiverImageName } from "@/assets/river/manifest";

/** Which action row the greeting suggests once a mood is picked. */
export type MoodDoor = "companion" | "reset";

export interface RiverMood {
  /** Index into MOOD_LABELS — this is what `logMood()` persists. */
  index: number;
  label: MoodLabel;
  /** Sentence case, for the dot captions and the recall line. */
  title: string;
  /** oklch accent written to `--nr-mood`; recolours the whole page. */
  accent: string;
  /** Shown once the dot is tapped. Validating, never prescriptive. */
  note: string;
  /** Watercolour revealed with the note. See scripts/optimize-river-images.mjs. */
  art: RiverImageName;
  /** Alt text for that painting. */
  alt: string;
  /** The action row marked "suggested for today". */
  door: MoodDoor;
  /** Why that door — `{companion}` is replaced by the caller. */
  why: string;
}

/**
 * Accent, painting and copy per canonical mood label.
 *
 * The greeting this was ported from used its own vocabulary and persisted
 * nothing. We keep MindMitra's canonical `MOOD_LABELS` instead, because those
 * indices are what writes to `mood_logs` and what ambience, the constellation
 * and the weekly trend all read back. Everything else — the five colours, the
 * paintings, the notes and the door suggestion — comes from the new design.
 *
 * The accents are deliberately lower-chroma than the ones they replaced. They
 * are not only the dots: `--nr-mood` carries the chosen accent down the whole
 * page, so these five values are also the breathing ring in Practice, the
 * trail in the constellation and the edge of the open-thread card.
 */
const MOOD_STYLE: Record<
  MoodLabel,
  Omit<RiverMood, "index" | "label">
> = {
  heavy: {
    title: "Heavy",
    accent: "oklch(0.637 0.026 1.8)",
    note: "Heavy is allowed. Set it down here for a while.",
    art: "mood-heavy",
    alt: "Watercolour of a low grey sky over still, dark water",
    door: "companion",
    why: "When things feel heavy, saying them out loud lightens the load.",
  },
  low: {
    title: "Low",
    accent: "oklch(0.635 0.025 271.9)",
    note: "Low days pass like fog. You don't have to push.",
    art: "mood-low",
    alt: "Watercolour of pale blue fog settling between distant hills",
    door: "companion",
    why: "A low fog lifts faster when someone walks through it with you.",
  },
  okay: {
    title: "Okay",
    accent: "oklch(0.681 0.018 156.7)",
    note: "Okay is a fine place to be. Stay as long as you like.",
    art: "mood-okay",
    alt: "Watercolour of a quiet green field under an even, open sky",
    door: "reset",
    why: "Okay is a good moment for two slow minutes of breathing.",
  },
  lifting: {
    title: "Lifting",
    accent: "oklch(0.667 0.035 138.2)",
    note: "Something's lifting. Let it rise on its own time.",
    art: "mood-lifting",
    alt: "Watercolour of morning light breaking over a soft green rise",
    door: "reset",
    why: "Ride the lift — two minutes of breath will carry it further.",
  },
  bright: {
    title: "Bright",
    accent: "oklch(0.674 0.06 36.4)",
    note: "Bright suits you. Carry a little of it into the day.",
    art: "mood-bright",
    alt: "Watercolour of warm clay-coloured light across an open landscape",
    door: "companion",
    why: "Bright days are worth telling someone about. {companion} is listening.",
  },
};

/** The five mood dots. Order matches MOOD_LABELS — index IS the mood index. */
export const RIVER_MOODS: readonly RiverMood[] = MOOD_LABELS.map((label, index) => ({
  index,
  label,
  ...MOOD_STYLE[label],
}));

/**
 * The resting accent, before any mood is known.
 *
 * The design's own quiet-voice colour: it is the sage the handwritten lines
 * are set in, so an un-checked-in page tints toward the same green the
 * greeting is already speaking in rather than toward a sixth colour.
 */
export const NEUTRAL_MOOD_ACCENT = "oklch(0.667 0.035 138.2)";

export function moodAccentFor(index: number | null | undefined): string {
  if (index == null) return NEUTRAL_MOOD_ACCENT;
  return RIVER_MOODS[index]?.accent ?? NEUTRAL_MOOD_ACCENT;
}

export function moodFor(index: number | null | undefined): RiverMood | null {
  if (index == null) return null;
  return RIVER_MOODS[index] ?? null;
}

/**
 * Greeting for the hour, in the register of this surface: observational rather
 * than cheerful. Kept at five buckets rather than the design's three, because
 * a student arriving at 04:00 — the hour this product exists for — should not
 * be told "Evening".
 */
export function greetingForHour(hour: number): string {
  if (hour < 5) return "Quiet night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Slow afternoon";
  if (hour < 21) return "Soft evening";
  return "Quiet night";
}

/**
 * One line of context under the headline. Same four buckets as the greeting,
 * so the two never disagree about what time it is.
 */
export function contextForHour(hour: number): string {
  if (hour < 5)
    return "The rest of the world is asleep. This page keeps the same hours you do.";
  if (hour < 12) return "A quiet hour. Nothing has started yet — just you and the page.";
  if (hour < 17)
    return "The middle of the day. A moment to stop, before the evening takes over.";
  return "The day is done. Set it down for a while — it can wait until tomorrow.";
}
