import type { MoodLogEntry } from "@/hooks/useMoodLog";

export type AmbiencePalette =
  | "dusk-cool"
  | "dawn-soft"
  | "noon-bright"
  | "evening-amber"
  | "night-deep";

export type ValenceBucket = "low" | "neutral" | "lift";
export type TimeBucket =
  | "late-night"
  | "morning"
  | "afternoon"
  | "evening"
  | "night";

export interface AmbienceState {
  /** -1 (heavy) .. +1 (bright). 0 == neutral / unknown. */
  valence: number;
  /** 0 (still) .. 1 (activated). Reserved for Phase 2 / EMA arousal. */
  arousal: number;
  /** Phase 2 sets this true when recent_crisis_flag or longitudinal_risk_flag fires. */
  crisisQuiet: boolean;
  palette: AmbiencePalette;
  /** 0..1 multiplier applied to PaperGrain opacity / warmth tint. */
  paperWarmth: number;
  /** CSS color for the MitraOrb halo + small accent dots. */
  orbHalo: string;
  /** CSS color used for hero accent / dots / scene flourish. */
  sceneAccent: string;
  /** Coarse bucket for whisper / copy filtering. */
  valenceBucket: ValenceBucket;
  timeBucket: TimeBucket;
}

const MOOD_VALENCE: Record<string, number> = {
  heavy: -0.85,
  low: -0.4,
  okay: 0,
  lifting: 0.5,
  bright: 0.85,
};

export function timeBucketFor(hour: number): TimeBucket {
  if (hour < 5) return "late-night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

export function valenceBucketFor(valence: number): ValenceBucket {
  if (valence <= -0.3) return "low";
  if (valence >= 0.3) return "lift";
  return "neutral";
}

/**
 * Pick the room's palette. Time-of-day owns the base palette; valence
 * nudges the choice toward `night-deep` when heavy or `noon-bright` when
 * lifting. The mapping is deliberately small so designers can tune each
 * named palette in tailwind.config without us inventing intermediate
 * colors at runtime.
 */
function pickPalette(timeBucket: TimeBucket, valence: number): AmbiencePalette {
  if (valence <= -0.5) return "night-deep";
  if (valence >= 0.5 && (timeBucket === "morning" || timeBucket === "afternoon"))
    return "noon-bright";
  switch (timeBucket) {
    case "late-night":
      return "night-deep";
    case "morning":
      return "dawn-soft";
    case "afternoon":
      return "noon-bright";
    case "evening":
      return "evening-amber";
    case "night":
      return "dusk-cool";
  }
}

/**
 * Map (palette, valence) to concrete CSS color expressions. We reuse the
 * existing --accent-* tokens (sage / sky / blush / amber) and the --ink /
 * --paper tokens already defined in src/index.css so designers can tweak
 * shades centrally without touching this engine.
 */
function colorsFor(
  palette: AmbiencePalette,
  valence: number,
): { orbHalo: string; sceneAccent: string; paperWarmth: number } {
  switch (palette) {
    case "night-deep":
      return {
        orbHalo:
          "radial-gradient(circle at 35% 30%, color-mix(in oklab, var(--accent-sky) 55%, transparent), transparent 70%)",
        sceneAccent: "var(--accent-sky)",
        paperWarmth: 0.55,
      };
    case "dawn-soft":
      return {
        orbHalo:
          "radial-gradient(circle at 35% 30%, color-mix(in oklab, var(--accent-amber) 70%, transparent), transparent 70%)",
        sceneAccent: "var(--accent-amber)",
        paperWarmth: 0.95,
      };
    case "noon-bright":
      return {
        orbHalo:
          valence >= 0.5
            ? "radial-gradient(circle at 35% 30%, color-mix(in oklab, var(--accent-sage) 80%, transparent), transparent 70%)"
            : "radial-gradient(circle at 35% 30%, color-mix(in oklab, var(--accent-sage) 60%, transparent), transparent 70%)",
        sceneAccent: "var(--accent-sage)",
        paperWarmth: 1,
      };
    case "evening-amber":
      return {
        orbHalo:
          "radial-gradient(circle at 35% 30%, color-mix(in oklab, var(--accent-blush) 65%, transparent), transparent 70%)",
        sceneAccent: "var(--accent-blush)",
        paperWarmth: 0.85,
      };
    case "dusk-cool":
      return {
        orbHalo:
          "radial-gradient(circle at 35% 30%, color-mix(in oklab, var(--accent-sky) 60%, transparent), transparent 70%)",
        sceneAccent: "var(--accent-sky)",
        paperWarmth: 0.65,
      };
  }
}

export interface AmbienceInput {
  todayLog?: MoodLogEntry | null;
  weekLogs?: MoodLogEntry[];
  hour?: number;
  /**
   * Optional Phase 2 affect EMA from /me/snapshot. When present, takes
   * precedence over MoodPulse derivation.
   */
  affectEma?: { valence: number; arousal: number } | null;
  /** Phase 2 crisis flags. */
  recentCrisisFlag?: boolean;
  longitudinalRiskFlag?: boolean;
}

/**
 * Derive the room ambience from the most concrete signal available.
 * Priority:
 *   1. Phase 2 affect EMA (when wired)
 *   2. Today's MoodPulse log
 *   3. Mean of the last week's MoodPulse logs (decayed)
 *   4. Neutral default (valence 0) — first-visit case must still look complete
 */
export function computeAmbience(input: AmbienceInput): AmbienceState {
  const hour = input.hour ?? new Date().getHours();
  const timeBucket = timeBucketFor(hour);
  const crisisQuiet = !!(input.recentCrisisFlag || input.longitudinalRiskFlag);

  let valence = 0;
  let arousal = 0.4;

  if (input.affectEma) {
    valence = clamp(input.affectEma.valence, -1, 1);
    arousal = clamp(input.affectEma.arousal, 0, 1);
  } else if (input.todayLog) {
    valence = MOOD_VALENCE[input.todayLog.mood_label] ?? 0;
  } else if (input.weekLogs && input.weekLogs.length > 0) {
    // Recency-weighted mean — most recent log contributes most.
    let sum = 0;
    let weightSum = 0;
    const now = Date.now();
    for (const entry of input.weekLogs) {
      const ageDays = Math.max(
        0,
        (now - new Date(entry.logged_at).getTime()) / (1000 * 60 * 60 * 24),
      );
      const w = Math.exp(-ageDays / 3);
      sum += (MOOD_VALENCE[entry.mood_label] ?? 0) * w;
      weightSum += w;
    }
    if (weightSum > 0) valence = sum / weightSum;
  }

  // Crisis state quiets the room regardless of computed valence.
  const palette: AmbiencePalette = crisisQuiet
    ? "night-deep"
    : pickPalette(timeBucket, valence);
  const colors = colorsFor(palette, valence);

  return {
    valence,
    arousal,
    crisisQuiet,
    palette,
    paperWarmth: crisisQuiet ? 0.4 : colors.paperWarmth,
    orbHalo: colors.orbHalo,
    sceneAccent: colors.sceneAccent,
    valenceBucket: valenceBucketFor(valence),
    timeBucket,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Compute the slope of the last N mood values (left = older, right = newer).
 * Returns a number on roughly the same scale as the per-day valence delta.
 * Used by ConstellationMap and InnerWeather to pick a derived headline.
 */
export function moodSlope(weekLogs: MoodLogEntry[]): number {
  if (weekLogs.length < 2) return 0;
  // weekLogs is newest-first. Reverse for a chronological series.
  const series = [...weekLogs]
    .reverse()
    .map((e) => MOOD_VALENCE[e.mood_label] ?? 0);
  const n = series.length;
  const xMean = (n - 1) / 2;
  const yMean = series.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (series[i] - yMean);
    den += (i - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}
