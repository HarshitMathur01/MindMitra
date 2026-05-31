// Procedural audio for Buddy — a tiny WebAudio synth. No sample assets (so no
// licensing), which also matches the project's procedural ethos: every sound is
// an oscillator + envelope generated at call time.
//
// Two jobs:
//   1. SFX  — mark clicks, win/lose/draw stingers, tickle, UI pops.
//   2. Voice — "Animalese"-style blips scheduled across a line's lip-flap clock.
//
// Browser autoplay policy: nothing is audible until unlock() runs inside a user
// gesture. A persisted mute flag gates the master gain. All access is guarded so
// the module is import-safe during SSR.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let mutePrefLoaded = false;
const MUTE_KEY = "buddy:muted";
const MASTER_LEVEL = 0.5;

function loadMutePref() {
  if (mutePrefLoaded || typeof window === "undefined") return;
  mutePrefLoaded = true;
  try {
    muted = window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    /* storage may be unavailable */
  }
}

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  loadMutePref();
  if (!ctx) {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_LEVEL;
    master.connect(ctx.destination);
  }
  return ctx;
}

/** Resume the context from inside a user gesture (autoplay unlock). */
export function unlockAudio() {
  const ac = ensure();
  if (ac && ac.state === "suspended") void ac.resume();
}

export function isMuted(): boolean {
  loadMutePref();
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  mutePrefLoaded = true;
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    /* noop */
  }
  if (master && ctx) master.gain.setTargetAtTime(value ? 0 : MASTER_LEVEL, ctx.currentTime, 0.015);
}

export function toggleMuted(): boolean {
  setMuted(!isMuted());
  return muted;
}

// ---- Synth core ------------------------------------------------------------
type OscType = "sine" | "square" | "triangle" | "sawtooth";
interface Note {
  freq: number;
  /** seconds from "now" to start the note */
  at?: number;
  dur: number;
  type?: OscType;
  gain?: number;
  /** glide the pitch to this frequency over the note duration */
  slideTo?: number;
}

function scheduleNote(ac: AudioContext, bus: GainNode, n: Note) {
  const t0 = ac.currentTime + (n.at ?? 0);
  const dur = Math.max(0.02, n.dur);
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = n.type ?? "square";
  osc.frequency.setValueAtTime(n.freq, t0);
  if (n.slideTo && n.slideTo > 0) {
    osc.frequency.exponentialRampToValueAtTime(n.slideTo, t0 + dur);
  }
  const peak = n.gain ?? 0.28;
  // exponential ramps can't target 0 — use a floor.
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.012, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(bus);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function play(notes: Note[]) {
  const ac = ensure();
  if (!ac || muted || !master) return;
  if (ac.state === "suspended") void ac.resume();
  for (const n of notes) scheduleNote(ac, master, n);
}

// ---- SFX -------------------------------------------------------------------
export const sfx = {
  /** Player drops an X — bright, short. */
  markPlace() {
    play([{ freq: 660, slideTo: 880, dur: 0.08, type: "triangle", gain: 0.22 }]);
  },
  /** Buddy drops an O — lower, rounder. */
  buddyMove() {
    play([{ freq: 320, slideTo: 230, dur: 0.1, type: "square", gain: 0.2 }]);
  },
  /** Buddy wins — rising major arpeggio. */
  win() {
    const seq = [523.25, 659.25, 783.99, 1046.5];
    play(seq.map((f, i) => ({ freq: f, at: i * 0.09, dur: 0.16, type: "triangle", gain: 0.24 })));
  },
  /** Player wins (buddy loses) — descending, deflated. */
  lose() {
    play([
      { freq: 392, at: 0, dur: 0.16, type: "sawtooth", gain: 0.16, slideTo: 360 },
      { freq: 294, at: 0.14, dur: 0.18, type: "sawtooth", gain: 0.16, slideTo: 262 },
      { freq: 196, at: 0.3, dur: 0.34, type: "sawtooth", gain: 0.16, slideTo: 150 },
    ]);
  },
  /** Draw — flat, neutral two-note shrug. */
  draw() {
    play([
      { freq: 440, at: 0, dur: 0.16, type: "triangle", gain: 0.18 },
      { freq: 440, at: 0.2, dur: 0.2, type: "triangle", gain: 0.18 },
    ]);
  },
  /** Tickle — quick rising giggle. */
  tickle() {
    play([
      { freq: 700, at: 0, dur: 0.05, type: "square", gain: 0.16, slideTo: 900 },
      { freq: 820, at: 0.06, dur: 0.05, type: "square", gain: 0.16, slideTo: 1040 },
      { freq: 960, at: 0.12, dur: 0.06, type: "square", gain: 0.16, slideTo: 1200 },
    ]);
  },
  /** UI button / toggle. */
  uiPop() {
    play([{ freq: 480, slideTo: 700, dur: 0.06, type: "sine", gain: 0.18 }]);
  },
  /** A soft yawn-ish fall, for the sleepy idle. */
  yawn() {
    play([{ freq: 300, slideTo: 180, dur: 0.5, type: "sine", gain: 0.14 }]);
  },
};

// ---- Voice ("Animalese") ---------------------------------------------------
/** Emotion → voice pitch multiplier (keeps blips in character). */
const PITCH_BY_EMOTION: Record<string, number> = {
  elated: 1.18,
  happy: 1.12,
  surprised: 1.22,
  mischief: 1.08,
  smug: 1.05,
  curious: 1.02,
  neutral: 1,
  confused: 0.98,
  focused: 0.96,
  supportive: 1,
  embarrassed: 1.04,
  bored: 0.82,
  sad: 0.85,
  sleepy: 0.68,
};

/**
 * Schedule a flurry of short blips across `durationMs` so the buddy "talks"
 * over its lip-flap. ~1 blip per 2.5 chars, capped, pitch jittered per emotion.
 */
export function voice(text: string, durationMs: number, opts: { emotion?: string } = {}) {
  const ac = ensure();
  if (!ac || muted || !master) return;
  if (ac.state === "suspended") void ac.resume();
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return;
  const base = PITCH_BY_EMOTION[opts.emotion ?? "neutral"] ?? 1;
  const count = Math.max(1, Math.min(26, Math.round(clean.length / 2.5)));
  const span = Math.max(0.2, durationMs / 1000) * 0.95;
  for (let i = 0; i < count; i++) {
    // Occasional gap so it reads as syllables, not a buzz.
    if (Math.random() < 0.12) continue;
    const f = (190 + Math.random() * 200) * base;
    scheduleNote(ac, master, {
      freq: f,
      at: (i / count) * span,
      dur: 0.045 + Math.random() * 0.03,
      type: Math.random() < 0.5 ? "square" : "triangle",
      gain: 0.1,
      slideTo: f * (0.9 + Math.random() * 0.25),
    });
  }
}
