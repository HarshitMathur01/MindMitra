import { useCallback, useEffect, useRef, useState } from "react";
import ToolShell from "@/components/mindgym/ToolShell";
import { BuddyCompanion, type BuddyCompanionHandle } from "@/components/companion/BuddyCompanion";
import type { BuddyEmotion } from "@/lib/companion/buddyBrain";
import * as audio from "@/lib/companion/audio";

// ---------------------------------------------------------------------------
// Read My Mood — the buddy silently *acts out* a feeling with its face + body,
// and you name it. Affect-recognition practice wrapped in a light charades game,
// and the one game that only the 3D buddy can do (it has a real face).
// ---------------------------------------------------------------------------

interface Mood {
  emotion: BuddyEmotion;
  label: string;
  emoji: string;
}

// Curated to the visually-distinct face presets — the ones a player can tell
// apart from the rig alone.
const MOODS: readonly Mood[] = [
  { emotion: "happy", label: "Happy", emoji: "😄" },
  { emotion: "sad", label: "Sad", emoji: "😔" },
  { emotion: "surprised", label: "Surprised", emoji: "😮" },
  { emotion: "confused", label: "Confused", emoji: "😕" },
  { emotion: "focused", label: "Focused", emoji: "🤨" },
  { emotion: "sleepy", label: "Sleepy", emoji: "😴" },
  { emotion: "bored", label: "Bored", emoji: "😐" },
  { emotion: "smug", label: "Smug", emoji: "😏" },
] as const;

const ROUNDS = 5;
const OPTIONS_PER_ROUND = 4;
const REVEAL_MS = 1900;
const POSE_DELAY_MS = 400;

type Phase = "intro" | "guessing" | "reveal" | "done";

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickTarget(prev?: BuddyEmotion): Mood {
  const pool = prev ? MOODS.filter((m) => m.emotion !== prev) : MOODS.slice();
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildOptions(target: Mood): Mood[] {
  const others = shuffle(MOODS.filter((m) => m.emotion !== target.emotion)).slice(
    0,
    OPTIONS_PER_ROUND - 1,
  );
  return shuffle([target, ...others]);
}

export default function ReadMyMood() {
  const buddyRef = useRef<BuddyCompanionHandle>(null);
  const poseTimer = useRef<number | null>(null);
  const revealTimer = useRef<number | null>(null);

  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("intro");
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [target, setTarget] = useState<Mood>(() => MOODS[0]);
  const [options, setOptions] = useState<Mood[]>([]);
  const [picked, setPicked] = useState<BuddyEmotion | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(
    () => () => {
      if (poseTimer.current) window.clearTimeout(poseTimer.current);
      if (revealTimer.current) window.clearTimeout(revealTimer.current);
    },
    [],
  );

  // Set up a round: choose a target, render options, and (after a beat) have the
  // buddy hold that expression silently.
  const startRound = useCallback((prev?: BuddyEmotion) => {
    const t = pickTarget(prev);
    setTarget(t);
    setOptions(buildOptions(t));
    setPicked(null);
    setPhase("guessing");
    if (poseTimer.current) window.clearTimeout(poseTimer.current);
    poseTimer.current = window.setTimeout(() => {
      buddyRef.current?.pose(t.emotion);
    }, POSE_DELAY_MS);
  }, []);

  const begin = useCallback(() => {
    audio.unlockAudio();
    setRound(1);
    setScore(0);
    setCompleted(false);
    startRound();
  }, [startRound]);

  const guess = useCallback(
    (m: Mood) => {
      if (phase !== "guessing") return;
      const isCorrect = m.emotion === target.emotion;
      setPicked(m.emotion);
      setPhase("reveal");
      if (isCorrect) {
        setScore((s) => s + 1);
        buddyRef.current?.react({ kind: "correct" });
      } else {
        buddyRef.current?.react({ kind: "wrong" });
      }

      if (revealTimer.current) window.clearTimeout(revealTimer.current);
      revealTimer.current = window.setTimeout(() => {
        if (round >= ROUNDS) {
          buddyRef.current?.react({ kind: "gameOver" });
          buddyRef.current?.flash(1.1);
          setPhase("done");
          setCompleted(true);
        } else {
          setRound((r) => r + 1);
          startRound(target.emotion);
        }
      }, REVEAL_MS);
    },
    [phase, target, round, startRound],
  );

  const resetAll = useCallback(() => {
    setPhase("intro");
    setRound(1);
    setScore(0);
    setPicked(null);
    setCompleted(false);
  }, []);

  return (
    <ToolShell
      toolId="read-my-mood"
      title="Read My Mood"
      clinicalBasis="Reading emotion from a face is affect recognition — naming what someone else feels strengthens the same emotional-granularity skill that supports your own self-regulation. A light, playful frame keeps it low-pressure."
      xp={30}
      completed={completed}
      onReset={resetAll}
      themeAccent="purple"
      surfaceTone="warm"
      showParticles={false}
      contentPlacement="top"
    >
      <div className="w-full max-w-5xl mx-auto px-4 md:px-6 pt-24 sm:pt-28 pb-8">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold leading-none">Read My Mood</h1>
            <p className="mt-1.5 text-sm opacity-70 max-w-sm">
              Buddy acts out a feeling. Watch his face, then name what he's feeling.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-widest bg-primary/10 text-primary">
              Round {Math.min(round, ROUNDS)} / {ROUNDS}
            </span>
            <span className="px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-widest bg-primary/10 text-primary">
              Score {score}
            </span>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:gap-6 lg:items-stretch">
          {/* Buddy stage — the puzzle. Props + face-disc are hidden so nothing
              spells out the answer; only his expression is the clue. */}
          <div className="rounded-2xl border border-black/5 bg-white/60 p-3 shadow-sm order-1">
            <BuddyCompanion
              ref={buddyRef}
              variant="full"
              showProps={false}
              collapsibleOnMobile={false}
              greetOnReady
              onReady={() => setReady(true)}
            />
            <p className="mt-2 px-1 text-[11px] uppercase tracking-widest font-mono opacity-50 text-center">
              drag to rotate · watch his face
            </p>
          </div>

          {/* Controls */}
          <div className="rounded-2xl border border-black/5 bg-white/60 p-5 shadow-sm order-2 flex flex-col justify-center">
            {phase === "intro" && (
              <div className="text-center space-y-4">
                <p className="text-base opacity-80">
                  Five quick rounds. Buddy will pull a face — your job is to read it.
                </p>
                <button
                  onClick={begin}
                  disabled={!ready}
                  className="w-full py-3 rounded-xl font-medium tracking-wide bg-primary text-primary-foreground transition-opacity disabled:opacity-50"
                >
                  {ready ? "Start" : "Waking up your buddy…"}
                </button>
              </div>
            )}

            {(phase === "guessing" || phase === "reveal") && (
              <div className="space-y-4">
                <p className="text-center text-sm font-medium uppercase tracking-widest opacity-60">
                  {phase === "guessing" ? "What's Buddy feeling?" : picked === target.emotion ? "Spot on!" : `It was ${target.label}`}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {options.map((m) => {
                    const isTarget = m.emotion === target.emotion;
                    const isPicked = m.emotion === picked;
                    const revealing = phase === "reveal";
                    const ring = revealing
                      ? isTarget
                        ? "ring-2 ring-emerald-500 bg-emerald-50"
                        : isPicked
                          ? "ring-2 ring-rose-400 bg-rose-50"
                          : "opacity-50"
                      : "hover:-translate-y-0.5 hover:shadow-md";
                    return (
                      <button
                        key={m.emotion}
                        onClick={() => guess(m)}
                        disabled={revealing}
                        className={[
                          "flex items-center gap-2.5 rounded-xl border border-black/10 bg-white px-4 py-3 text-left transition-all",
                          ring,
                        ].join(" ")}
                      >
                        <span className="text-2xl" aria-hidden>{m.emoji}</span>
                        <span className="font-medium">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {phase === "done" && (
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold">
                  You read {score} of {ROUNDS} right.
                </p>
                <p className="text-sm opacity-70">
                  {score >= 4
                    ? "You read faces well — that's real emotional attunement."
                    : score >= 2
                      ? "Nicely done. Faces get easier to read with practice."
                      : "Tricky! Emotions hide in small cues — you'll catch more next time."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolShell>
  );
}
