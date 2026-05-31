// Lip-sync remap: Oculus-style viseme codes -> ARKit morph combos available on this avatar.
// Adapted from the TalkingHead library's viseme timing concept; values are reduced/empirical
// because we have no true Oculus visemes, only ARKit blendshapes to approximate them.

import { setMorph } from "./morphs.js";

// jawOpen amplitudes are pushed high so the jaw visibly drops while talking on
// this stylized avatar (the small ~0.2–0.6 values read as a near-closed mouth).
// PP stays fully shut so the open→close lip-flap keeps a crisp contrast.
export const VISEME_TO_ARKIT = {
  PP: { mouthPucker: 0.4, mouthClose: 0.6, mouthRollLower: 0.3, mouthRollUpper: 0.3 },
  FF: { mouthFunnel: 0.3, mouthLowerDownLeft: 0.3, mouthLowerDownRight: 0.3, jawOpen: 0.2 },
  TH: { tongueOut: 0.3, jawOpen: 0.4 },
  DD: { jawOpen: 0.5, mouthStretchLeft: 0.2, mouthStretchRight: 0.2 },
  KK: { jawOpen: 0.45, mouthStretchLeft: 0.15, mouthStretchRight: 0.15 },
  CH: { mouthFunnel: 0.5, mouthPucker: 0.3, jawOpen: 0.35 },
  SS: { mouthStretchLeft: 0.3, mouthStretchRight: 0.3, jawOpen: 0.22 },
  NN: { jawOpen: 0.42, tongueOut: 0.1 },
  RR: { mouthPucker: 0.5, mouthFunnel: 0.3, jawOpen: 0.45 },
  AA: { jawOpen: 0.95, mouthStretchLeft: 0.3, mouthStretchRight: 0.3 },
  E: { jawOpen: 0.62, mouthStretchLeft: 0.5, mouthStretchRight: 0.5 },
  I: { jawOpen: 0.42, mouthStretchLeft: 0.6, mouthStretchRight: 0.6 },
  O: { jawOpen: 0.8, mouthFunnel: 0.5, mouthPucker: 0.3 },
  U: { jawOpen: 0.55, mouthPucker: 0.7, mouthFunnel: 0.4 },
  sil: {},
};

// Letter -> viseme (rough English mapping borrowed from TalkingHead's lipsync-en intent).
const LETTER_TO_VISEME = {
  a: "AA",
  e: "E",
  i: "I",
  o: "O",
  u: "U",
  b: "PP",
  p: "PP",
  m: "PP",
  f: "FF",
  v: "FF",
  t: "DD",
  d: "DD",
  n: "NN",
  k: "KK",
  g: "KK",
  s: "SS",
  z: "SS",
  r: "RR",
  l: "NN",
  h: "sil",
  y: "I",
  w: "U",
  c: "KK",
  j: "CH",
  q: "KK",
  x: "KK",
};

export function textToVisemes(text) {
  const out = [];
  const clean = String(text).toLowerCase();
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === " " || ch === "." || ch === ",") {
      out.push("sil");
      continue;
    }
    const next2 = clean.slice(i, i + 2);
    if (next2 === "th") {
      out.push("TH");
      i++;
      continue;
    }
    if (next2 === "sh" || next2 === "ch") {
      out.push("CH");
      i++;
      continue;
    }
    const v = LETTER_TO_VISEME[ch];
    if (v) out.push(v);
  }
  return out;
}

const ALL_LIPSYNC_MORPHS = new Set();
for (const v of Object.values(VISEME_TO_ARKIT)) {
  for (const k of Object.keys(v)) ALL_LIPSYNC_MORPHS.add(k);
}

function applyViseme(morphIndex, code, intensity = 1) {
  const target = VISEME_TO_ARKIT[code] ?? {};
  for (const morph of ALL_LIPSYNC_MORPHS) {
    setMorph(morphIndex, morph, (target[morph] ?? 0) * intensity);
  }
}

function clearVisemes(morphIndex) {
  for (const morph of ALL_LIPSYNC_MORPHS) setMorph(morphIndex, morph, 0);
}

// Plays a viseme sequence on a fixed clock — no audio. Useful to verify the remap visually.
export function playVisemeSequence(morphIndex, visemes, msPerViseme = 90) {
  let i = 0;
  let cancelled = false;
  const t0 = performance.now();

  function step(now) {
    if (cancelled) return;
    const idx = Math.floor((now - t0) / msPerViseme);
    if (idx >= visemes.length) {
      clearVisemes(morphIndex);
      return;
    }
    if (idx !== i) {
      i = idx;
      applyViseme(morphIndex, visemes[i]);
    }
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
  return () => {
    cancelled = true;
    clearVisemes(morphIndex);
  };
}

/** Rough spoken duration for a line (ms), used to size the bubble + cue clock. */
export function estimateSpeechMs(text, msPerViseme = 90) {
  const n = textToVisemes(text).length;
  return Math.max(600, n * msPerViseme);
}

/**
 * Visual lip-flap for a line — NO audio. Drives the lip-sync-owned mouth morphs
 * from the text's viseme sequence on a fixed clock, then RESTORES the base mouth
 * (snapshotted at start) instead of zeroing — so a Surprised jaw or a smile that
 * was set by the expression layer survives the handoff. Brows/cheeks/eyes are
 * never touched here, so the face keeps expressing while Buddy talks.
 *
 * Returns { cancel, durationMs }.
 */
export function speakVisemes(morphIndex, text, opts = {}) {
  const msPerViseme = opts.msPerViseme ?? 90;
  const intensity = opts.intensity ?? 1;
  const visemes = textToVisemes(text);
  const durationMs = Math.max(600, visemes.length * msPerViseme);

  if (!morphIndex || visemes.length === 0) {
    return { cancel: () => {}, durationMs };
  }

  // Snapshot the base of every mouth morph the lip-sync owns, to restore on end.
  const base = new Map();
  for (const m of ALL_LIPSYNC_MORPHS) base.set(m, setMorphSafeGet(morphIndex, m));

  let raf = 0;
  let cancelled = false;
  let last = -1;
  const t0 = performance.now();

  function restore() {
    for (const [m, v] of base) setMorph(morphIndex, m, v);
  }

  function step(now) {
    if (cancelled) return;
    const idx = Math.floor((now - t0) / msPerViseme);
    if (idx >= visemes.length) {
      restore();
      return;
    }
    if (idx !== last) {
      last = idx;
      applyViseme(morphIndex, visemes[idx], intensity);
    }
    raf = requestAnimationFrame(step);
  }
  raf = requestAnimationFrame(step);

  return {
    durationMs,
    cancel() {
      if (cancelled) return;
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      restore();
    },
  };
}

// Local getMorph without a second import churn.
function setMorphSafeGet(morphIndex, name) {
  const targets = morphIndex.byName.get(name);
  if (!targets || targets.length === 0) return 0;
  const { mesh, index } = targets[0];
  return mesh.morphTargetInfluences[index] ?? 0;
}

// Placeholder kept for a future TTS hookup — same signatures TalkingHead uses.
export async function speak(_text) {
  /* audio not implemented — see speakVisemes */
}
export async function speakAudio(_payload) {
  /* not implemented */
}
