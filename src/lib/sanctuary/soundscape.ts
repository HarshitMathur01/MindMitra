// Ambient soundscape for SanctuaryHome — one shared, module-level
// HTMLAudioElement. A single looped track needs no WebAudio graph; the
// element streams (preload="none" means zero network cost until first tap)
// and JS volume ramps give the fades.
//
// The loops in /public/sounds/ambient/ are synthesized (ffmpeg noise/sine
// sources — see the PR notes), so there is nothing to license; swap them for
// recorded loops any time without touching this module.
//
// Autoplay policy: play() is only ever called from the SoundscapeBar click
// handler, so playback is gesture-gated by construction. If a file is
// missing or the browser blocks playback, the catch path resets state and
// notifies subscribers — the bar's button simply un-presses.

export type SoundscapeTrack = "rain" | "cafe" | "tanpura";

const TARGET_VOLUME = 0.35;
const FADE_IN_MS = 1200;
const FADE_SWITCH_MS = 500;
const FADE_OUT_MS = 800;

let el: HTMLAudioElement | null = null;
let current: SoundscapeTrack | null = null;
let fadeFrame: number | null = null;
const listeners = new Set<(track: SoundscapeTrack | null) => void>();

function notify() {
  for (const cb of listeners) cb(current);
}

function ensureElement(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!el) {
    el = new Audio();
    el.loop = true;
    el.preload = "none";
  }
  return el;
}

function cancelFade() {
  if (fadeFrame !== null) {
    cancelAnimationFrame(fadeFrame);
    fadeFrame = null;
  }
}

function fadeTo(target: number, ms: number, onDone?: () => void) {
  const audio = el;
  if (!audio) return;
  cancelFade();
  const start = audio.volume;
  const t0 = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / ms);
    audio.volume = start + (target - start) * p;
    if (p < 1) {
      fadeFrame = requestAnimationFrame(step);
    } else {
      fadeFrame = null;
      onDone?.();
    }
  };
  fadeFrame = requestAnimationFrame(step);
}

/** Start (or switch to) a track. Call only from a user gesture. */
export function playSoundscape(track: SoundscapeTrack) {
  const audio = ensureElement();
  if (!audio) return;

  const start = () => {
    audio.src = `/sounds/ambient/${track}.mp3`;
    audio.volume = 0;
    current = track;
    notify();
    audio
      .play()
      .then(() => fadeTo(TARGET_VOLUME, FADE_IN_MS))
      .catch(() => {
        // Missing file / decode error / blocked — degrade silently.
        if (current === track) {
          current = null;
          notify();
        }
      });
  };

  if (current && current !== track && !audio.paused) {
    fadeTo(0, FADE_SWITCH_MS, start);
  } else {
    start();
  }
}

/** Fade out and pause. Safe to call when nothing is playing. */
export function stopSoundscape() {
  const audio = el;
  if (!audio || current === null) return;
  current = null;
  notify();
  if (audio.paused) return;
  fadeTo(0, FADE_OUT_MS, () => audio.pause());
}

export function currentSoundscape(): SoundscapeTrack | null {
  return current;
}

/** Subscribe to track changes; returns the unsubscribe function. */
export function subscribeSoundscape(
  cb: (track: SoundscapeTrack | null) => void,
): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
