// Buddy's "brain": the structured response contract + a local stub generator.
//
// The contract (BuddyResponse) is the seam between *deciding what Buddy does*
// and *performing it* (director.ts). Today `generateResponse` fills it from the
// static line banks in personality.ts; tomorrow a server route can call an LLM
// and return the exact same JSON — the director never changes. The zod schema
// guards both paths so a malformed/hallucinated payload can never crash a frame.

import { z } from "zod";
import {
  LINE_POOLS,
  pickLine,
  chooseGreeting,
  type LinePoolName,
  type Mood,
  type RecentTracker,
} from "./personality";
import type { MoveAnalysis } from "../tictactoe";

// ---- Vocabularies ----------------------------------------------------------
// These string literals MUST match the runtime engines:
//   FACE_PRESETS  → keys of PRESETS (presets.js)
//   GESTURES      → PROC_ANIMATIONS clip names (procAnim.js / BuddyStage.tsx)
//   MICROS        → microExpr.js MICRO library keys
export const FACE_PRESETS = [
  "Neutral",
  "Happy",
  "Sad",
  "Angry",
  "Surprised",
  "Disgust",
  "Fear",
  "Confused",
] as const;
export const GESTURES = [
  "Wave",
  "Nod yes",
  "Shake no",
  "Look around",
  "Shrug",
  "Bounce",
  "Dance",
  "Idle variation",
  "Hero entrance",
  "Double clap",
  "Punch combo",
  "Jump twist",
  "Sneaky walk",
  "Bhangra dance",
  "Thinking pose",
] as const;
export const MICROS = [
  "none",
  "browFlash",
  "smirk",
  "wink",
  "browRaiseSingle",
  "squintDoubt",
  "eyeRoll",
  "noseScrunch",
  "lookAway",
] as const;
export const EMOTIONS = [
  "neutral",
  "happy",
  "elated",
  "smug",
  "mischief",
  "curious",
  "surprised",
  "confused",
  "sad",
  "supportive",
  "bored",
  "sleepy",
  "embarrassed",
  "focused",
] as const;
export const ANIMATION_STATES = [
  "idle",
  "leaning-in",
  "celebrating",
  "sulking",
  "sneaky",
  "drowsy",
] as const;

export type FacePreset = (typeof FACE_PRESETS)[number];
export type Gesture = (typeof GESTURES)[number];
export type MicroExpression = (typeof MICROS)[number];
export type BuddyEmotion = (typeof EMOTIONS)[number];
export type AnimationState = (typeof ANIMATION_STATES)[number];
export type HumorLevel = 0 | 1 | 2 | 3;

// ---- The contract ----------------------------------------------------------
export const BuddyResponseSchema = z.object({
  /** What Buddy says. May embed cue tags like "[wink]" / "[beat]" (see parseCues). */
  reply: z.string().max(160),
  /** Felt state — drives face, idle bias, and the humor ceiling. */
  emotion: z.enum(EMOTIONS),
  /** Base face preset, or "auto" to derive it from `emotion` via EMOTION_MAP. */
  facialExpression: z.union([z.enum(FACE_PRESETS), z.literal("auto")]).default("auto"),
  /** Transient face accent layered over the base expression. */
  microExpression: z.enum(MICROS).default("none"),
  /** Looping baseline posture/idle bias. */
  animationState: z.enum(ANIMATION_STATES).default("idle"),
  /** One-shot full-body clip, or "none". */
  gesture: z.union([z.enum(GESTURES), z.literal("none")]).default("none"),
  /** 0 sincere · 1 light · 2 cheeky · 3 full mischief. */
  humorLevel: z.number().int().min(0).max(3).default(1),
  /** 0..1 base-expression strength. */
  intensity: z.number().min(0).max(1).default(0.85),
  timing: z
    .object({
      preDelayMs: z.number().min(0).max(4000).default(350),
      holdMs: z.number().min(400).max(12000).default(2600),
      gestureTimeScale: z.number().min(0.25).max(3).default(1),
    })
    .default({}),
});
export type BuddyResponse = z.infer<typeof BuddyResponseSchema>;

/**
 * Parse anything into a safe BuddyResponse. Never throws — on failure returns a
 * neutral fallback so a bad LLM/stub payload degrades instead of breaking render.
 */
export function parseBuddyResponse(raw: unknown): BuddyResponse {
  const out = BuddyResponseSchema.safeParse(raw);
  if (out.success) return out.data;
  return BuddyResponseSchema.parse({
    reply:
      typeof (raw as { reply?: unknown })?.reply === "string"
        ? (raw as { reply: string }).reply
        : "…",
    emotion: "neutral",
  });
}

// ---- Emotion → performance map (single source of truth) --------------------
interface EmotionSpec {
  basePreset: FacePreset;
  micro: MicroExpression[]; // candidate accents (first is the default)
  gestures: (Gesture | "none")[]; // candidate one-shots
  animationState: AnimationState;
  humor: [HumorLevel, HumorLevel]; // [min, max] this emotion is willing to reach
}

export const EMOTION_MAP: Record<BuddyEmotion, EmotionSpec> = {
  neutral: {
    basePreset: "Neutral",
    micro: ["none"],
    gestures: ["none", "Look around"],
    animationState: "idle",
    humor: [0, 1],
  },
  happy: {
    basePreset: "Happy",
    micro: ["browFlash", "none"],
    gestures: ["Nod yes", "Wave"],
    animationState: "idle",
    humor: [1, 2],
  },
  elated: {
    basePreset: "Happy",
    micro: ["browFlash"],
    gestures: ["Bhangra dance", "Jump twist", "Double clap"],
    animationState: "celebrating",
    humor: [2, 3],
  },
  smug: {
    basePreset: "Happy",
    micro: ["smirk"],
    gestures: ["Shrug", "Sneaky walk"],
    animationState: "sneaky",
    humor: [2, 3],
  },
  mischief: {
    basePreset: "Happy",
    micro: ["wink", "smirk"],
    gestures: ["Sneaky walk", "Bounce"],
    animationState: "sneaky",
    humor: [2, 3],
  },
  curious: {
    basePreset: "Neutral",
    micro: ["browRaiseSingle"],
    gestures: ["Thinking pose", "Look around"],
    animationState: "leaning-in",
    humor: [1, 2],
  },
  surprised: {
    basePreset: "Surprised",
    micro: ["none"],
    gestures: ["Hero entrance", "none"],
    animationState: "leaning-in",
    humor: [0, 2],
  },
  confused: {
    basePreset: "Confused",
    micro: ["squintDoubt"],
    gestures: ["Shake no", "Look around"],
    animationState: "idle",
    humor: [0, 2],
  },
  sad: {
    basePreset: "Sad",
    micro: ["lookAway"],
    gestures: ["Shrug"],
    animationState: "sulking",
    humor: [0, 1],
  },
  supportive: {
    basePreset: "Neutral",
    micro: ["none"],
    gestures: ["Nod yes"],
    animationState: "idle",
    humor: [0, 1],
  },
  bored: {
    basePreset: "Neutral",
    micro: ["eyeRoll", "none"],
    gestures: ["Look around", "Idle variation"],
    animationState: "idle",
    humor: [1, 2],
  },
  sleepy: {
    basePreset: "Neutral",
    micro: ["none"],
    gestures: ["Idle variation", "none"],
    animationState: "drowsy",
    humor: [0, 1],
  },
  embarrassed: {
    basePreset: "Happy",
    micro: ["lookAway"],
    gestures: ["Shrug"],
    animationState: "idle",
    humor: [1, 2],
  },
  focused: {
    basePreset: "Angry",
    micro: ["squintDoubt"],
    gestures: ["Punch combo", "Thinking pose"],
    animationState: "leaning-in",
    humor: [0, 1],
  },
};

/** Resolve `facialExpression: "auto"` to a concrete preset. */
export function resolveFace(resp: BuddyResponse): FacePreset {
  return resp.facialExpression === "auto"
    ? EMOTION_MAP[resp.emotion].basePreset
    : resp.facialExpression;
}

// ---- Cue tags --------------------------------------------------------------
// Lines may embed "[wink] [beat] [shrug]" — the director schedules each against
// the lip-flap clock so the gesture lands on the word, then shows the CLEAN text.
export type CueType = "micro" | "gesture" | "beat";
export interface Cue {
  type: CueType;
  /** micro name, gesture clip name, or "beat". */
  value: string;
  /** Character offset in the CLEAN (tag-stripped) text where the cue fires. */
  at: number;
}

const CUE_MICROS: Record<string, MicroExpression> = {
  wink: "wink",
  smirk: "smirk",
  browraise: "browRaiseSingle",
  browflash: "browFlash",
  scrunch: "noseScrunch",
  eyeroll: "eyeRoll",
  doubt: "squintDoubt",
  lookaway: "lookAway",
};
const CUE_GESTURES: Record<string, Gesture> = {
  shrug: "Shrug",
  nod: "Nod yes",
  clap: "Double clap",
  wave: "Wave",
  bounce: "Bounce",
  dance: "Bhangra dance",
  sneak: "Sneaky walk",
  think: "Thinking pose",
  stomp: "Jump twist",
  look: "Look around",
};

/**
 * Strip "[tag]" cues from a line and return the clean display text plus the
 * cue schedule (offsets into the clean text). Unknown tags are dropped silently.
 */
export function parseCues(text: string): { clean: string; cues: Cue[] } {
  const cues: Cue[] = [];
  let clean = "";
  const re = /\[([a-zA-Z]+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    clean += text.slice(last, m.index);
    last = m.index + m[0].length;
    const tag = m[1].toLowerCase();
    const at = clean.length;
    if (tag === "beat") cues.push({ type: "beat", value: "beat", at });
    else if (CUE_MICROS[tag]) cues.push({ type: "micro", value: CUE_MICROS[tag], at });
    else if (CUE_GESTURES[tag]) cues.push({ type: "gesture", value: CUE_GESTURES[tag], at });
    // unknown tag → dropped
  }
  clean += text.slice(last);
  return { clean: clean.replace(/\s{2,}/g, " ").trim(), cues };
}

// ---- Context + stub generator ----------------------------------------------
export type BuddyEventKind =
  | "greeting"
  | "newGame"
  | "playerMove"
  | "thinking"
  | "buddyMove"
  | "buddyWin"
  | "playerWin"
  | "draw"
  | "idleThought"
  | "bored"
  | "sleepy"
  | "tickle"
  // ---- Activity-agnostic events (any buddy-powered tool, not just TTT) ----
  | "correct" // player got something right
  | "wrong" // player missed / mistake
  | "levelUp" // cleared a level / round / streak
  | "gameOver" // run finished
  | "watching" // buddy observes a stimulus (e.g. a pattern flashing)
  | "hint" // gentle nudge
  | "encourage"; // mid-task lift

export interface BuddyContext {
  kind: BuddyEventKind;
  /** Current persistent mood (supplied by the MoodMachine). */
  mood?: Mood;
  lastSeenMs?: number | null;
  /** Optional board / move data for callback humor. */
  movesPlayed?: number;
  /** What the move *meant* tactically — lets the buddy react to the board. */
  analysis?: MoveAnalysis | null;
}

/**
 * Board-aware override: given a move's tactical analysis, swap the generic
 * emotion + line pool for a specific one ("a fork? respect", "blocked. rude").
 * Returns null when nothing notable happened (fall back to the generic pool).
 */
function refineFromBoard(ctx: BuddyContext): { emotion: BuddyEmotion; pool: LinePoolName } | null {
  const a = ctx.analysis;
  if (!a) return null;
  if (ctx.kind === "playerMove") {
    if (a.givesOpponentWin) return { emotion: "smug", pool: "gloat" };
    if (a.createdFork) return { emotion: "surprised", pool: "impressed" };
    if (a.blockedOpponent) return { emotion: "focused", pool: "grumble" };
    if (a.createsThreat) return { emotion: "surprised", pool: "nervous" };
    if (a.tookCenter) return { emotion: "curious", pool: "center" };
  } else if (ctx.kind === "buddyMove") {
    if (a.createdFork || a.createsThreat) return { emotion: "smug", pool: "gloat" };
    if (a.blockedOpponent) return { emotion: "focused", pool: "block" };
  }
  return null;
}

interface StubDeps {
  pick: (pool: readonly string[]) => string;
  rand: () => number;
}
const DEFAULT_DEPS: StubDeps = { pick: pickLine, rand: Math.random };

/** Humor ceiling each mood is willing to reach (cringe guardrail). */
export const HUMOR_CEILING: Record<Mood, HumorLevel> = {
  calm: 1,
  cheerful: 3,
  mischief: 3,
  supportive: 1,
  smug: 3,
  sulky: 1,
  bored: 2,
  sleepy: 0,
};

const KIND_TO_EMOTION: Record<BuddyEventKind, BuddyEmotion> = {
  greeting: "happy",
  newGame: "happy",
  playerMove: "curious",
  thinking: "focused",
  buddyMove: "smug",
  buddyWin: "elated",
  playerWin: "surprised",
  draw: "neutral",
  idleThought: "bored",
  bored: "bored",
  sleepy: "sleepy",
  tickle: "mischief",
  correct: "happy",
  wrong: "supportive",
  levelUp: "elated",
  gameOver: "happy",
  watching: "focused",
  hint: "curious",
  encourage: "supportive",
};
const KIND_TO_POOL: Record<BuddyEventKind, LinePoolName> = {
  greeting: "tttGreet",
  newGame: "tttGreet",
  playerMove: "playerMove",
  thinking: "thinking",
  buddyMove: "buddyMove",
  buddyWin: "buddyWin",
  playerWin: "playerWin",
  draw: "draw",
  idleThought: "idleThought",
  bored: "bored",
  sleepy: "sleepyTTT",
  tickle: "tickle",
  correct: "celebrateSmall",
  wrong: "support",
  levelUp: "celebrateBig",
  gameOver: "celebrateSmall",
  watching: "thinking",
  hint: "support",
  encourage: "support",
};
const KIND_TIMING: Partial<Record<BuddyEventKind, { preDelayMs: number; holdMs: number }>> = {
  thinking: { preDelayMs: 250, holdMs: 1400 },
  buddyMove: { preDelayMs: 700, holdMs: 1800 },
  buddyWin: { preDelayMs: 300, holdMs: 5000 },
  playerWin: { preDelayMs: 350, holdMs: 4500 },
  draw: { preDelayMs: 350, holdMs: 4000 },
  sleepy: { preDelayMs: 600, holdMs: 3200 },
  correct: { preDelayMs: 200, holdMs: 2000 },
  wrong: { preDelayMs: 300, holdMs: 2600 },
  levelUp: { preDelayMs: 250, holdMs: 3500 },
  gameOver: { preDelayMs: 300, holdMs: 4200 },
  watching: { preDelayMs: 200, holdMs: 1400 },
  hint: { preDelayMs: 250, holdMs: 2200 },
};

function choose<T>(arr: readonly T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

/**
 * Stub "LLM": deterministic given `deps.rand`. Maps an event to an emotion via
 * EMOTION_MAP, draws a line, clamps humor to the mood ceiling, and occasionally
 * embeds a matching micro cue so jokes land on a beat. Async on purpose — the
 * signature matches a future `await fetch('/api/buddy')` exactly.
 */
export async function generateResponse(
  ctx: BuddyContext,
  deps: Partial<StubDeps> = {},
): Promise<BuddyResponse> {
  const { pick, rand } = { ...DEFAULT_DEPS, ...deps };
  const mood: Mood = ctx.mood ?? "cheerful";

  // A notable board state overrides the generic event emotion/pool.
  const refined = refineFromBoard(ctx);
  const emotion = refined?.emotion ?? KIND_TO_EMOTION[ctx.kind];
  const spec = EMOTION_MAP[emotion];

  // Greetings are time-aware (reuses the existing chooseGreeting buckets).
  let reply: string;
  if (ctx.kind === "greeting" && ctx.lastSeenMs !== undefined) {
    reply = pick(chooseGreeting(ctx.lastSeenMs ?? null));
  } else {
    reply = pick(LINE_POOLS[refined?.pool ?? KIND_TO_POOL[ctx.kind]]);
  }

  const ceiling = HUMOR_CEILING[mood];
  const humorLevel = Math.min(ceiling, spec.humor[1]) as HumorLevel;

  const micro = choose(spec.micro, rand);
  // Restraint: only ~1 in 3 reactions performs an inline cue, and only when
  // there's headroom for it. Over-cueing reads as cringe.
  if (micro !== "none" && humorLevel >= 2 && rand() < 0.34) {
    const tag = Object.keys(CUE_MICROS).find((k) => CUE_MICROS[k] === micro);
    if (tag && !reply.includes("[")) reply = `${reply} [${tag}]`;
  }

  const timing = KIND_TIMING[ctx.kind] ?? { preDelayMs: 350, holdMs: 2600 };

  return BuddyResponseSchema.parse({
    reply,
    emotion,
    facialExpression: "auto",
    microExpression: micro,
    animationState: spec.animationState,
    gesture: choose(spec.gestures, rand),
    humorLevel,
    intensity: emotion === "elated" ? 1 : 0.85,
    timing: { ...timing, gestureTimeScale: ctx.kind === "buddyWin" ? 1.1 : 1 },
  });
}

// ---- Mood machine ----------------------------------------------------------
// Holds the persistent baseline that decays toward `calm`, applies cooldowns,
// and is what gives Buddy *continuity* (a smug streak after a win, a sulk after
// a loss) instead of resetting to neutral every event.
export interface MoodMachine {
  respond: (ctx: Omit<BuddyContext, "mood">) => Promise<BuddyResponse>;
  mood: () => Mood;
  /** Force a mood (e.g. idle director drifting to bored/sleepy). */
  drift: (m: Mood, ttlMs?: number) => void;
}

const MOOD_AFTER: Partial<Record<BuddyEventKind, { mood: Mood; ttlMs: number }>> = {
  buddyWin: { mood: "smug", ttlMs: 20000 },
  playerWin: { mood: "sulky", ttlMs: 15000 },
  draw: { mood: "cheerful", ttlMs: 8000 },
  tickle: { mood: "mischief", ttlMs: 8000 },
  bored: { mood: "bored", ttlMs: 30000 },
  sleepy: { mood: "sleepy", ttlMs: 60000 },
  levelUp: { mood: "cheerful", ttlMs: 10000 },
  gameOver: { mood: "cheerful", ttlMs: 8000 },
};

export function createBuddyBrain(
  recent: RecentTracker,
  now: () => number = () => Date.now(),
): MoodMachine {
  let mood: Mood = "cheerful";
  let until = 0;

  function current(): Mood {
    if (until && now() > until) {
      mood = mood === "sleepy" ? "sleepy" : "calm";
      until = 0;
    }
    return mood;
  }

  return {
    mood: current,
    drift(m, ttlMs = 30000) {
      mood = m;
      until = now() + ttlMs;
    },
    async respond(ctx) {
      const resp = await generateResponse({ ...ctx, mood: current() }, { pick: recent.pick });
      const next = MOOD_AFTER[ctx.kind];
      if (next) {
        mood = next.mood;
        until = now() + next.ttlMs;
      }
      return resp;
    },
  };
}
