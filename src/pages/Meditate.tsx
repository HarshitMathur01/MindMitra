import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Pause, Play, Square } from "lucide-react";
import { useNavigate } from "react-router-dom";
import forestStreamSound from "@/sounds/forest-stream-sounds-gentle-bird-song-relaxing-nature-sounds-collaboration-with_YhaQ8age.mp3";

const SESSION_LENGTHS = [5, 10, 15, 20];

type SoundOption = {
  label: string;
  emoji: string;
  audioSrc?: string;
};

const SOUNDS: SoundOption[] = [
  { label: "Silence", emoji: "🔇" },
  { label: "Rain", emoji: "🌧️" },
  { label: "Forest", emoji: "🌲", audioSrc: forestStreamSound },
  { label: "Ocean", emoji: "🌊" },
];

const SOUND_SCENES = [
  {
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1400&auto=format&fit=crop&q=85",
    alt: "Calm mountain lake",
    caption: "Find your stillness",
    tint: "from-amber-950/70 via-stone-900/50 to-amber-900/30",
  },
  {
    image: "https://images.unsplash.com/photo-1519692933481-e162a57d6721?w=1400&auto=format&fit=crop&q=85",
    alt: "Rain on window",
    caption: "Let the rain slow your thoughts",
    tint: "from-slate-950/75 via-sky-950/55 to-slate-900/30",
  },
  {
    image: "https://images.unsplash.com/photo-1511497584788-876760111969?w=1400&auto=format&fit=crop&q=85",
    alt: "Green forest path",
    caption: "Breathe with the forest",
    tint: "from-emerald-950/70 via-green-950/50 to-emerald-900/25",
  },
  {
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1400&auto=format&fit=crop&q=85",
    alt: "Ocean waves",
    caption: "Ride the rhythm of the waves",
    tint: "from-cyan-950/70 via-blue-950/50 to-cyan-900/25",
  },
];

const AFFIRMATIONS = [
  "Notice your breath without trying to change it.",
  "Every thought is a cloud passing through the sky of your mind.",
  "You are exactly where you need to be.",
  "Let your body soften with each exhale.",
  "You are safe. You are present. You are enough.",
  "There is nothing to fix right now — only this moment.",
  "Feel the weight of your body held by the ground.",
];

const COMPLETION_QUOTES = [
  "Stillness is where creativity and solutions to problems are found.",
  "The quieter you become, the more you can hear.",
  "Peace comes from within. Do not seek it without.",
  "Meditation is not evasion; it is a serene encounter with reality.",
];

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function Meditate() {
  const navigate = useNavigate();
  const [sessionMins, setSessionMins] = useState(10);
  const [soundIdx, setSoundIdx] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(sessionMins * 60);
  const [done, setDone] = useState(false);
  const [affirmIdx, setAffirmIdx] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const affirmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remainingRef = useRef(remaining);
  const runningRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const total = sessionMins * 60;
  const progress = total > 0 ? (total - remaining) / total : 0;

  const r = 80;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - progress);

  const stop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (affirmIntervalRef.current) clearInterval(affirmIntervalRef.current);
    intervalRef.current = null;
    affirmIntervalRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    runningRef.current = false;
    setRunning(false);
  };

  const reset = () => {
    stop();
    const secs = sessionMins * 60;
    remainingRef.current = secs;
    setRemaining(secs);
    setDone(false);
    setAffirmIdx(0);
  };

  const begin = () => {
    runningRef.current = true;
    setRunning(true);

    const selectedSound = SOUNDS[soundIdx];
    if (selectedSound?.audioSrc) {
      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.loop = true;
      }

      audioRef.current.src = selectedSound.audioSrc;
      audioRef.current.volume = volume;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((error) => {
        console.debug("Meditation audio playback was blocked:", error);
      });
    }

    intervalRef.current = setInterval(() => {
      remainingRef.current -= 1;
      setRemaining(remainingRef.current);
      if (remainingRef.current <= 0) {
        stop();
        setDone(true);
      }
    }, 1000);
    affirmIntervalRef.current = setInterval(() => {
      setAffirmIdx((i) => (i + 1) % AFFIRMATIONS.length);
    }, 30000);
  };

  // Reset timer when session length changes, but only when not running.
  // Uses runningRef to avoid adding `running` state to deps (would cause reset on pause).
  useEffect(() => {
    if (!runningRef.current) {
      const secs = sessionMins * 60;
      remainingRef.current = secs;
      setRemaining(secs);
      setDone(false);
    }
  }, [sessionMins]);

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (affirmIntervalRef.current) clearInterval(affirmIntervalRef.current);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const handleSelectSound = (index: number) => {
    setSoundIdx(index);
    // Sound chips should only select the track. Audio must start only from the Start button.
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = "";
    }
  };

  const completionQuote = useMemo(
    () => COMPLETION_QUOTES[Math.floor(Math.random() * COMPLETION_QUOTES.length)],
    // Recompute only when done transitions to true so it doesn't flicker on re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [done],
  );
  const activeScene = SOUND_SCENES[soundIdx];

  return (
    <div className="relative isolate flex min-h-[100dvh] flex-col overflow-hidden">

      {/* ── Full-screen background image ── */}
      <div className="absolute inset-0 -z-10">
        <AnimatePresence mode="wait">
          <motion.img
            key={activeScene.image}
            src={activeScene.image}
            alt={activeScene.alt}
            className="h-full w-full object-cover"
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        </AnimatePresence>
        {/* Dark gradient overlay — bottom-heavy so controls are readable */}
        <div className={`absolute inset-0 bg-gradient-to-b ${activeScene.tint}`} />
        {/* Extra bottom darkening for controls area */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 pt-safe pt-5 pb-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/25 backdrop-blur-sm text-white transition-transform hover:scale-105 active:scale-95"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <h1 className="text-[17px] font-semibold text-white drop-shadow">Meditate</h1>
          <p className="text-xs text-white/70">{activeScene.caption}</p>
        </div>
        <div className="h-10 w-10" />
      </div>

      {!done ? (
        <>
          {/* ── Session length picker ── */}
          {!running && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex justify-center gap-2 px-5 pt-2 pb-1"
            >
              {SESSION_LENGTHS.map((mins) => (
                <button
                  key={mins}
                  onClick={() => setSessionMins(mins)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium backdrop-blur-sm transition-all duration-150 ${mins === sessionMins
                      ? "bg-white text-black shadow-md"
                      : "bg-white/20 text-white hover:bg-white/30"
                    }`}
                >
                  {mins} min
                </button>
              ))}
            </motion.div>
          )}

          {/* ── Main content: ring + affirmation ── */}
          <div className="flex flex-1 flex-col items-center justify-center gap-8 px-5">
            {/* Countdown ring */}
            <div className="relative flex items-center justify-center">
              {/* Soft glow behind ring */}
              <div className="absolute h-52 w-52 rounded-full bg-white/5 blur-2xl" />
              <svg width="200" height="200" className="-rotate-90">
                <circle
                  cx="100" cy="100" r={r}
                  fill="none" stroke="white" strokeWidth="5" strokeOpacity="0.15"
                />
                <motion.circle
                  cx="100" cy="100" r={r}
                  fill="none" stroke="white" strokeWidth="5" strokeLinecap="round"
                  style={{ strokeDasharray: circumference }}
                  animate={{ strokeDashoffset: dashOffset }}
                  transition={{ duration: 1, ease: "linear" }}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="font-mono text-5xl font-bold text-white drop-shadow-md">
                  {formatCountdown(remaining)}
                </span>
                <span className="mt-1 text-xs text-white/60">
                  {running ? "remaining" : "duration"}
                </span>
              </div>
            </div>

            {/* Affirmation */}
            <AnimatePresence mode="wait">
              <motion.p
                key={affirmIdx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.6 }}
                className="max-w-[260px] text-center text-sm italic text-white/75 leading-relaxed"
              >
                "{AFFIRMATIONS[affirmIdx]}"
              </motion.p>
            </AnimatePresence>
          </div>

          {/* ── Sound selector + controls ── */}
          <div className="px-5 pb-10 space-y-6">
            {/* Sound chips */}
            {!running && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center gap-3"
              >
                {SOUNDS.map((s, i) => (
                  <button
                    key={s.label}
                    onClick={() => handleSelectSound(i)}
                    className={`flex flex-col items-center gap-1 rounded-2xl px-4 py-2.5 text-xs font-medium backdrop-blur-sm transition-all duration-150 ${i === soundIdx
                        ? "bg-white/90 text-black shadow-md scale-105"
                        : "bg-white/20 text-white hover:bg-white/30"
                      }`}
                  >
                    <span className="text-lg">{s.emoji}</span>
                    <span>{s.label}</span>
                  </button>
                ))}
              </motion.div>
            )}

            {/* Volume */}
            <div className="mx-auto flex w-full max-w-xs items-center gap-3 rounded-2xl bg-white/20 px-4 py-2 backdrop-blur-sm">
              <span className="text-xs font-medium text-white/85">Volume</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
                className="h-1 w-full accent-white"
                aria-label="Meditation volume"
              />
              <span className="w-10 text-right text-xs font-medium text-white/85">{Math.round(volume * 100)}%</span>
            </div>

            {/* Play / Pause / Stop */}
            <div className="flex items-center justify-center gap-5">
              {running && (
                <button
                  onClick={() => { stop(); reset(); }}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm text-white transition-transform hover:scale-105 active:scale-95"
                  aria-label="End session"
                >
                  <Square className="h-5 w-5" />
                </button>
              )}
              <button
                onClick={running ? stop : begin}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-black shadow-[0_8px_32px_rgba(0,0,0,0.35)] transition-transform hover:scale-105 active:scale-95"
                aria-label={running ? "Pause" : "Start"}
              >
                {running
                  ? <Pause className="h-7 w-7" />
                  : <Play className="h-7 w-7 translate-x-0.5" />
                }
              </button>
            </div>
          </div>
        </>
      ) : (
        /* ── Completion screen ── */
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-1 flex-col items-center justify-center gap-6 px-8 pb-12 text-center"
        >
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white/20 backdrop-blur-md text-5xl shadow-lg">
            🧘
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white drop-shadow">Well done</h2>
            <p className="mt-1 text-sm text-white/70">{sessionMins} minutes of mindful presence</p>
          </div>
          <div className="rounded-[22px] bg-black/30 backdrop-blur-md p-5 shadow-sm max-w-[280px]">
            <p className="text-sm italic text-white/80 leading-relaxed">"{completionQuote}"</p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-6 py-2.5 text-sm font-semibold text-white shadow-md">
            🔥 Streak +1
          </div>
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-white/60 underline underline-offset-4"
          >
            Back to home
          </button>
        </motion.div>
      )}
    </div>
  );
}
