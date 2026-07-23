// The director: turns a BuddyResponse into a *performance* on the rig, and runs
// the idle layer (fidgets, idle thoughts, eye-follow-cursor, bored drift, tickle).
//
// It owns the ordering contract that keeps Buddy from looking robotic:
//   the beat (preDelay) → face leads → micro + gesture (anticipation) → speak +
//   bubble → cues fire on the word → settle. A generation counter makes a new
//   reaction cleanly supersede an in-flight one (priority interrupt), and all
//   timers are tracked so nothing leaks on unmount.

import type { BuddyHandle } from "@/components/BuddyStage";
import {
  parseCues,
  resolveFace,
  createBuddyBrain,
  type BuddyResponse,
  type BuddyContext,
  type MoodMachine,
} from "./buddyBrain";
import { createRecentTracker } from "./personality";
import { voice as voiceBlips, sfx, unlockAudio } from "./audio";
import { prefersReducedMotion } from "@/lib/mindgym/motion";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// The single emotion "tap" every performance broadcasts. UI layers (speech
// bubble tint, comedy props, mood-reactive background) subscribe to this instead
// of reaching into the rig — one seam, many consumers.
export interface EmotionEvent {
  emotion: BuddyResponse["emotion"];
  animationState: BuddyResponse["animationState"];
  intensity: number;
}

// ---- Reaction sequencer ----------------------------------------------------
export interface Director {
  /** Perform a response. Supersedes any in-flight performance. */
  play: (resp: BuddyResponse) => Promise<void>;
  /** Show a line with no gesture (used for reduced-motion idle text). */
  sayOnly: (resp: BuddyResponse) => void;
  /** Cancel the current performance + pending cues. */
  cancel: () => void;
}

export function createDirector(
  buddy: BuddyHandle,
  opts: { reducedMotion?: boolean; onEmotion?: (e: EmotionEvent) => void } = {},
): Director {
  const reduced = opts.reducedMotion ?? prefersReducedMotion();
  const emit = (resp: BuddyResponse) =>
    opts.onEmotion?.({
      emotion: resp.emotion,
      animationState: resp.animationState,
      intensity: resp.intensity,
    });
  let gen = 0;
  const timers = new Set<number>();

  function clearTimers() {
    for (const t of timers) clearTimeout(t);
    timers.clear();
  }
  function later(fn: () => void, ms: number) {
    const id = window.setTimeout(
      () => {
        timers.delete(id);
        fn();
      },
      Math.max(0, ms),
    );
    timers.add(id);
  }

  function sayOnly(resp: BuddyResponse) {
    emit(resp);
    const { clean } = parseCues(resp.reply);
    if (clean) buddy.say(clean, resp.timing.holdMs);
  }

  async function play(resp: BuddyResponse): Promise<void> {
    const myGen = ++gen;
    clearTimers();
    emit(resp);
    const alive = () => myGen === gen;
    const t = resp.timing;
    const { clean, cues } = parseCues(resp.reply);

    // Reduced motion: text + face only, no gestures / micros / lip-flap drama.
    if (reduced) {
      buddy.setExpression(resolveFace(resp));
      if (clean) buddy.say(clean, t.holdMs);
      return;
    }

    // 1 — the beat. Never react instantly; the pause IS the personality.
    await wait(t.preDelayMs);
    if (!alive()) return;

    // 2 — the face leads the line (anticipation). Await so the micro rides a
    //     settled base instead of fighting the in-flight preset tween.
    await buddy.setExpression(resolveFace(resp));
    if (!alive()) return;

    // 3 — micro accent + body gesture, slightly ahead of the words.
    if (resp.microExpression !== "none") {
      buddy.playMicro(resp.microExpression, { intensity: resp.intensity });
    }
    if (resp.gesture !== "none") {
      buddy.playProc(resp.gesture, { timeScale: t.gestureTimeScale });
    }

    // 4 — speak (visual lip-flap) + the bubble.
    let durationMs = 0;
    if (clean) {
      const ctrl = buddy.speakVisemes(clean);
      durationMs = ctrl.durationMs;
      voiceBlips(clean, durationMs, { emotion: resp.emotion }); // gibberish over the lip-flap
      buddy.setBlinkRange(2, 2); // blink a touch more while talking
      buddy.say(clean, t.holdMs);
    }

    // 5 — inline cues fire against the lip-flap clock; [beat] pushes later cues.
    let beatOffset = 0;
    for (const cue of cues) {
      const baseTime = clean.length ? (cue.at / clean.length) * durationMs : 0;
      if (cue.type === "beat") {
        beatOffset += 300;
        continue;
      }
      const value = cue.value;
      const isMicro = cue.type === "micro";
      later(() => {
        if (!alive()) return;
        if (isMicro) buddy.playMicro(value, { intensity: resp.intensity });
        else buddy.playProc(value, { timeScale: t.gestureTimeScale });
      }, baseTime + beatOffset);
    }

    // 6 — settle: hand blink cadence back to resting (don't snap the face).
    later(
      () => {
        if (alive()) buddy.setBlinkRange(2.5, 3.5);
      },
      Math.max(durationMs, t.holdMs),
    );
  }

  return {
    play,
    sayOnly,
    cancel() {
      gen++;
      clearTimers();
    },
  };
}

// ---- Idle director ---------------------------------------------------------
// Layered on top of idle.js (blink/breathe/sway). Adds the "alive between
// reactions" behaviors and always YIELDS to reactions via notifyInteraction().
export interface IdleDirector {
  start: () => void;
  stop: () => void;
  /** Call on any user action / reaction so idle/bored timers reset. */
  notifyInteraction: () => void;
}

export function createIdleDirector(
  buddy: BuddyHandle,
  brain: MoodMachine,
  director: Director,
  opts: { reducedMotion?: boolean } = {},
): IdleDirector {
  const reduced = opts.reducedMotion ?? prefersReducedMotion();
  let running = false;
  let fidget = 0,
    behavior = 0,
    bored = 0,
    sleepy = 0;
  let asleep = false;
  let lastInteraction = Date.now();
  let down: { x: number; y: number; t: number } | null = null;

  const rand = (min: number, max: number) => min + Math.random() * (max - min);
  const busy = () => Date.now() - lastInteraction < 4000;

  async function perform(ctx: Parameters<MoodMachine["respond"]>[0], textOnly: boolean) {
    const resp = await brain.respond(ctx);
    if (textOnly || reduced) director.sayOnly(resp);
    else director.play(resp);
  }

  function scheduleFidget() {
    fidget = window.setTimeout(
      () => {
        if (!running) return;
        if (!reduced && !busy()) buddy.playProc("Idle variation");
        scheduleFidget();
      },
      rand(6000, 12000),
    );
  }
  function scheduleBehavior() {
    behavior = window.setTimeout(
      () => {
        if (!running) return;
        if (!busy()) perform({ kind: "idleThought" }, false);
        scheduleBehavior();
      },
      rand(18000, 40000),
    );
  }
  function resetBored() {
    if (bored) clearTimeout(bored);
    if (sleepy) clearTimeout(sleepy);
    bored = window.setTimeout(() => {
      if (!running) return;
      brain.drift("bored", 30000);
      perform({ kind: "bored" }, false);
      // Still ignored? Nod off — yawn, slow the blinks, drift to sleepy.
      sleepy = window.setTimeout(() => {
        if (!running) return;
        asleep = true;
        brain.drift("sleepy", 60000);
        buddy.setBlinkRange(1.2, 1.4);
        if (!reduced) sfx.yawn();
        perform({ kind: "sleepy" }, false);
      }, 30000);
    }, 45000);
  }

  function notifyInteraction() {
    lastInteraction = Date.now();
    if (asleep) {
      asleep = false;
      buddy.setBlinkRange(2.5, 3.5); // wake — restore normal blink cadence
      if (!reduced) buddy.playProc("Bounce"); // a little startle
    }
    resetBored();
  }

  // Eye-follow cursor → bias the head toward the pointer when it's near the stage.
  function onPointerMove(e: PointerEvent) {
    if (reduced) return;
    const c = buddy.getCanvas();
    if (!c) return;
    const r = c.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const pad = 250;
    const inRange =
      e.clientX > r.left - pad &&
      e.clientX < r.right + pad &&
      e.clientY > r.top - pad &&
      e.clientY < r.bottom + pad;
    if (!inRange) {
      buddy.setHeadLookAt(null);
      return;
    }
    const nx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2); // -1..1
    const ny = (e.clientY - (r.top + r.height / 2)) / (r.height / 2); // -1..1
    buddy.setHeadLookAt(nx * 0.4, -ny * 0.22);
  }

  // Tickle: a click (not a drag) on the stage → a giggle line.
  function onPointerDown(e: PointerEvent) {
    down = { x: e.clientX, y: e.clientY, t: Date.now() };
  }
  function onPointerUp(e: PointerEvent) {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const dt = Date.now() - down.t;
    down = null;
    if (moved < 6 && dt < 400) {
      unlockAudio(); // a tap on the stage is a user gesture — safe to wake audio
      sfx.tickle();
      notifyInteraction();
      perform({ kind: "tickle" }, false);
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      lastInteraction = Date.now();
      scheduleFidget();
      scheduleBehavior();
      resetBored();
      if (typeof window !== "undefined") {
        window.addEventListener("pointermove", onPointerMove);
        const c = buddy.getCanvas();
        c?.addEventListener("pointerdown", onPointerDown);
        c?.addEventListener("pointerup", onPointerUp);
      }
    },
    stop() {
      running = false;
      clearTimeout(fidget);
      clearTimeout(behavior);
      clearTimeout(bored);
      clearTimeout(sleepy);
      if (typeof window !== "undefined") {
        window.removeEventListener("pointermove", onPointerMove);
        const c = buddy.getCanvas();
        c?.removeEventListener("pointerdown", onPointerDown);
        c?.removeEventListener("pointerup", onPointerUp);
      }
      buddy.setHeadLookAt(null);
    },
    notifyInteraction,
  };
}

// ---- Bundled controller (the easy route wiring) ----------------------------
export interface BuddyController {
  /** React to a game/idle event: pick a response (mood-aware) and perform it. */
  react: (ctx: Omit<BuddyContext, "mood">) => Promise<void>;
  /** Perform an explicit response (test bench / scripted beats). */
  play: (resp: BuddyResponse) => Promise<void>;
  /** Reset idle/bored timers without speaking (e.g. a silent player move). */
  notifyInteraction: () => void;
  startIdle: () => void;
  stopIdle: () => void;
  dispose: () => void;
  brain: MoodMachine;
}

export function createBuddyController(
  buddy: BuddyHandle,
  opts: { reducedMotion?: boolean; onEmotion?: (e: EmotionEvent) => void } = {},
): BuddyController {
  const reduced = opts.reducedMotion ?? prefersReducedMotion();
  const recent = createRecentTracker(8);
  const brain = createBuddyBrain(recent);
  const director = createDirector(buddy, { reducedMotion: reduced, onEmotion: opts.onEmotion });
  const idle = createIdleDirector(buddy, brain, director, { reducedMotion: reduced });

  return {
    async react(ctx) {
      idle.notifyInteraction();
      const resp = await brain.respond(ctx);
      await director.play(resp);
    },
    play: (resp) => director.play(resp),
    notifyInteraction: idle.notifyInteraction,
    startIdle: idle.start,
    stopIdle: idle.stop,
    dispose() {
      idle.stop();
      director.cancel();
    },
    brain,
  };
}
