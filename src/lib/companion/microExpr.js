// Micro-expression layer: brief, additive, self-restoring face accents that ride
// ON TOP of the base expression preset (presets.js) instead of replacing it.
//
// This is the fix for the "frozen face" problem: a smirk, brow-flash, or wink is
// a flicker (120–400ms), not a pose. Each micro snapshots the base value of the
// morphs it touches, eases a delta on top, then eases back to that base — so a
// smile underneath survives, and a Happy-mouth stays smiling through a wink.
//
// Morph ownership (see plan): micros only touch brows / cheeks / nose / eyeSquint
// / eyeLook / one-sided mouthSmile. They never touch eyeBlink (idle owns it) or
// the jaw/mouth-articulation set (lip-sync owns it while speaking) — so layers
// compose without fighting. `wink` is the one deliberate exception (it borrows
// eyeBlinkRight for a frame or two), which the director may pair with a blink pause.

import { setMorph, getMorph } from "./morphs.js";

// name -> [ [morphName, delta], ... ]  (delta is added on top of the base, clamped 0..1)
export const MICRO = {
  none: { dur: 0, morphs: [] },
  browFlash: {
    dur: 260,
    morphs: [
      ["browInnerUp", 0.5],
      ["browOuterUpLeft", 0.55],
      ["browOuterUpRight", 0.55],
    ],
  },
  smirk: {
    dur: 360,
    morphs: [
      ["mouthSmileLeft", 0.7],
      ["cheekSquintLeft", 0.35],
      ["eyeSquintLeft", 0.28],
    ],
  },
  wink: {
    dur: 300,
    morphs: [
      ["eyeBlinkRight", 1.0],
      ["mouthSmileRight", 0.4],
      ["cheekSquintRight", 0.35],
    ],
  },
  browRaiseSingle: {
    dur: 380,
    morphs: [
      ["browOuterUpRight", 0.65],
      ["browInnerUp", 0.18],
    ],
  },
  squintDoubt: {
    dur: 420,
    morphs: [
      ["eyeSquintLeft", 0.5],
      ["eyeSquintRight", 0.5],
      ["browDownLeft", 0.22],
      ["browDownRight", 0.22],
    ],
  },
  eyeRoll: {
    dur: 460,
    morphs: [
      ["eyeLookUpLeft", 0.85],
      ["eyeLookUpRight", 0.85],
      ["browInnerUp", 0.2],
    ],
  },
  noseScrunch: {
    dur: 320,
    morphs: [
      ["noseSneerLeft", 0.6],
      ["noseSneerRight", 0.6],
      ["mouthUpperUpLeft", 0.25],
      ["mouthUpperUpRight", 0.25],
    ],
  },
  lookAway: {
    dur: 520,
    morphs: [
      ["eyeLookDownLeft", 0.45],
      ["eyeLookDownRight", 0.45],
      ["eyeLookOutRight", 0.4],
    ],
  },
};

export const MICRO_NAMES = Object.keys(MICRO);

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Flicker envelope: fast ease-out attack to ~0.35, brief hold, ease-in release.
// Reads as "a face that moved", not "a face that posed".
function envelope(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 0;
  if (t < 0.32) {
    const k = t / 0.32; // ease-out attack
    return 1 - (1 - k) * (1 - k);
  }
  if (t < 0.5) return 1; // hold
  const k = (t - 0.5) / 0.5; // ease-in release
  return 1 - k * k;
}

/**
 * Play a micro-expression. Additive over the current base; restores on finish or
 * cancel. Returns a cancel() handle. No-ops for unknown names or `none`.
 *
 * @param morphIndex  from morphs.js discoverMorphs()
 * @param name        a MICRO key
 * @param opts.intensity  0..1 scales the delta (default 1)
 * @param opts.durationMs override the micro's natural duration
 */
export function playMicroExpression(morphIndex, name, opts = {}) {
  const def = MICRO[name];
  if (!morphIndex || !def || def.morphs.length === 0) return () => {};
  const intensity = opts.intensity ?? 1;
  const dur = opts.durationMs ?? def.dur;

  // Snapshot the base so we can ride on top and return cleanly.
  const base = def.morphs.map(([m]) => getMorph(morphIndex, m));
  const targetDelta = def.morphs.map(([, d]) => d * intensity);

  let raf = 0;
  let cancelled = false;
  const t0 = performance.now();

  function restore() {
    def.morphs.forEach(([m], i) => setMorph(morphIndex, m, base[i]));
  }

  function step(now) {
    if (cancelled) return;
    const t = (now - t0) / dur;
    if (t >= 1) {
      restore();
      return;
    }
    const e = envelope(t);
    def.morphs.forEach(([m], i) => setMorph(morphIndex, m, clamp01(base[i] + targetDelta[i] * e)));
    raf = requestAnimationFrame(step);
  }
  raf = requestAnimationFrame(step);

  return () => {
    if (cancelled) return;
    cancelled = true;
    if (raf) cancelAnimationFrame(raf);
    restore();
  };
}
