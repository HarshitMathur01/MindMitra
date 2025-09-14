import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

type BalloonType = "positive" | "negative";

type Balloon = {
  id: string;
  word: string;
  kind: BalloonType;
  xPct: number;
  size: number;
  speed: number;
  hue: number;
};

const NEGATIVE_WORDS = [
  "doubt","fear","worry","stress","anger","guilt","shame","envy","failure",
  "can't","not enough","insecure","anxious","lonely","tired","overwhelm",
  "procrastinate","criticism","imposter","frustrate","sad","stuck","blame",
  "hate","jealous","weak","negative"
];

const POSITIVE_WORDS = [
  "calm","hope","joy","peace","growth","clarity","love","brave","capable",
  "worthy","present","balanced","resilient","patient","kind","creative",
  "focused","grateful","strong","happy","relaxed","optimistic","mindful",
  "courageous","serene","confident"
];

const AFFIRMATIONS = [
  "You are enough just as you are.",
  "Inhale confidence, exhale doubt.",
  "Small steps create big change.",
  "You handle this with calm and grace.",
  "Your potential is limitless.",
  "You choose peace over pressure.",
  "You learn and grow every day.",
  "You are safe, loved, and capable.",
  "Your kindness matters.",
  "Progress over perfection.",
  "You are stronger than you think.",
  "You bring light to those around you.",
  "You are worthy of good things.",
  "You can overcome any challenge.",
  "Your feelings are valid.",
  "You are in control of your thoughts."
];

const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const choice = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const useAudio = () => {
  const ctxRef = useRef<AudioContext | null>(null);
  const ensureCtx = () => {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return ctxRef.current!;
  };
  const ding = () => {
    const ctx = ensureCtx();
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(660, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.06, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(now + 0.24);
  };
  const thud = () => {
    const ctx = ensureCtx();
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(220, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.04, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(now + 0.3);
  };
  return { ding, thud };
};

export default function BalloonPositivityGame() {
  const [running, setRunning] = useState(false);
  const [balloons, setBalloons] = useState<Balloon[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [streak, setStreak] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [lastAffirmation, setLastAffirmation] = useState<string | null>(null);
  const [finalAffirmation, setFinalAffirmation] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(15);
  const containerRef = useRef<HTMLDivElement>(null);
  const spawnTimer = useRef<number | null>(null);
  const { ding, thud } = useAudio();
  const navigate = useNavigate();

  const maxBalloons = useMemo(() => Math.min(8, 4 + Math.floor(level * 0.8)), [level]);
  const playTimeUpSound = () => {
    const audio = new Audio("/sounds/timesup.mp3");
    audio.volume = 0.6; // adjust volume
    audio.play();
  };

  useEffect(() => {
    if (!running) return;
    const spawn = () => {
      setBalloons((curr) => {
        if (curr.length >= 15) return curr;
        const isNegative = Math.random() < 0.55;
        const word = isNegative ? choice(NEGATIVE_WORDS) : choice(POSITIVE_WORDS);
        const b: Balloon = {
          id: Math.random().toString(36).slice(2),
          word,
          kind: isNegative ? "negative" : "positive",
          xPct: rand(6, 94),
          size: rand(0.9, 1.25),
          speed: Math.max(3, rand(8.5, 13.5)),
          hue: Math.floor(rand(0, 360)),
        };
        return [...curr, b];
      });
    };
    spawn();
    spawnTimer.current = window.setInterval(spawn, rand(1000, 1500));
    return () => {
      if (spawnTimer.current) window.clearInterval(spawnTimer.current);
      spawnTimer.current = null;
    };
  }, [running, maxBalloons]);

  useEffect(() => {
    const newLevel = Math.max(1, Math.floor(score / 7) + 1);
    setLevel(newLevel);
  }, [score]);

  useEffect(() => {
    if (!running || lives <= 0) return;

    if (timeLeft <= 0) {
      playTimeUpSound();
      setRunning(false);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((t) => t - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [running, timeLeft, lives]);

  useEffect(() => {
    if (!running && (lives <= 0 || timeLeft <= 0)) {
      setFinalAffirmation(choice(AFFIRMATIONS));
    }
  }, [running, lives, timeLeft]);

  const reset = () => {
    setRunning(false);
    setBalloons([]);
    setScore(0);
    setLives(3);
    setLevel(1);
    setStreak(0);
    setMessage(null);
    setLastAffirmation(null);
    setFinalAffirmation(null);
    setTimeLeft(15);
  };

  const endGame = () => {
    reset();
  };

  const handlePop = (b: Balloon) => {
    setBalloons((curr) => curr.filter((x) => x.id !== b.id));
    if (b.kind === "negative") {
      setScore((s) => s + 1);
      setStreak((s) => s + 1);
      const affirmation = choice(AFFIRMATIONS);
      setLastAffirmation(affirmation);
      setMessage(affirmation);
      ding();
    } else {
      setScore((s) => Math.max(0, s - 1));
      setLives((l) => Math.max(0, l - 1));
      setStreak(0);
      setMessage("Oops! Only pop the negative ones");
      thud();
    }
  };

  const handleExitTop = (b: Balloon) => {
    setBalloons((curr) => curr.filter((x) => x.id !== b.id));
    if (b.kind === "negative") {
      setLives((l) => Math.max(0, l - 1));
      setStreak(0);
    }
  };

  useEffect(() => {
    if (lives <= 0) setRunning(false);
  }, [lives]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden font-sans text-slate-900">
      {/* Joyful Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-100 via-pink-100 to-sky-100" />

      <header className="relative z-10 flex items-center justify-between px-4 pt-4 md:px-8">
        {/* Left: Back button */}
        <div>
          <button
            onClick={() => navigate("/games")}
            className="flex items-center gap-2 rounded-xl bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-700 shadow hover:bg-yellow-400 hover:text-white transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Games
          </button>
        </div>

        {/* Center: Title */}
        <h1 className="absolute left-1/2 transform -translate-x-1/2 text-xl md:text-3xl font-bold tracking-tight text-center text-pink-600 drop-shadow-sm">
          MoodBloom
        </h1>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          {!running ? (
            <button
              onClick={() => setRunning(true)}
              className="rounded-2xl bg-gradient-to-r from-green-400 to-emerald-500 px-4 py-2 text-white shadow-md hover:from-green-500 hover:to-emerald-600"
            >
              Start
            </button>
          ) : (
            <>
              <button
                onClick={() => setRunning(false)}
                className="rounded-2xl bg-gradient-to-r from-indigo-400 to-blue-500 px-4 py-2 text-white shadow-md hover:from-indigo-500 hover:to-blue-600"
              >
                Pause
              </button>
              <button
                onClick={endGame}
                className="rounded-2xl bg-gradient-to-r from-rose-400 to-pink-500 px-4 py-2 text-white shadow-md hover:from-rose-500 hover:to-pink-600"
              >
                End
              </button>
            </>
          )}
          <button
            onClick={reset}
            className="rounded-2xl bg-gradient-to-r from-orange-400 to-red-500 px-4 py-2 text-white shadow-md hover:from-orange-500 hover:to-red-600"
          >
            Reset
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="relative z-10 mx-auto mt-4 grid max-w-5xl grid-cols-2 gap-2 rounded-2xl bg-white/70 p-3 text-sm backdrop-blur md:grid-cols-5 md:gap-4 md:p-4 shadow-lg">
        <Stat label="Score" value={score} />
        <Stat label="Level" value={level} />
        <Stat label="Streak" value={streak} />
        <Stat label="Lives" value={"❤️".repeat(lives) || "—"} />
        <Stat label="Time" value={`${timeLeft}s`} />
      </div>

      {/* Instructions */}
      <div className="relative z-10 mx-auto mt-2 w-full max-w-5xl px-4 text-center text-slate-700">
        <p>
          Remove the {" "}
          <span className="font-semibold text-rose-600">gloom</span>, and welcome the bloom
        </p>
      </div>

      {/* Balloon Container */}
      <div
        ref={containerRef}
        className="relative z-0 mx-auto mt-4 h-[70vh] w-[min(1100px,94vw)] overflow-hidden rounded-3xl 
               bg-white/30 shadow-2xl backdrop-blur border-4 border-transparent"
        style={{
          borderImage: 'linear-gradient(to right, #ffd6e0, #fff1a8, #b5f2d8, #c5dbff) 1',
          borderImageSlice: 1,
        }}
      >
        <AnimatePresence>
          {balloons.map((b) => (
            <BalloonItem key={b.id} b={b} onPop={() => handlePop(b)} onExitTop={() => handleExitTop(b)} />
          ))}
        </AnimatePresence>

        {/* End Modal */}
        {(!running && (lives <= 0 || timeLeft <= 0)) && (
          <div className="absolute inset-0 grid place-items-center bg-white/70 backdrop-blur-sm">
            <div className="rounded-3xl bg-gradient-to-br from-pink-100 to-yellow-100 p-6 text-center shadow-lg max-w-md">
              {lives <= 0 ? (
                <h2 className="mb-2 text-2xl font-semibold text-rose-600">Game Over</h2>
              ) : (
                <h2 className="mb-2 text-2xl font-semibold text-indigo-600">Time’s Up!!</h2>
              )}
              <p className="mb-2 text-slate-700">
                Final Score: <span className="font-bold">{score}</span>
              </p>
              <p className="mb-4 italic text-emerald-600">{finalAffirmation}</p>
              <button
                onClick={reset}
                className="rounded-2xl bg-gradient-to-r from-pink-400 to-rose-500 px-4 py-2 text-white shadow-md hover:from-pink-500 hover:to-rose-600"
              >
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Message */}
      <AnimatePresence>
  {message && (
    <motion.div
      key={message}
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.7 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="absolute left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 
                 rounded-xl bg-white/90 px-4 py-2 text-base font-semibold 
                 text-indigo-600 shadow-lg backdrop-blur-md"
      onAnimationComplete={() => {
        window.setTimeout(() => setMessage(null), 1500);
      }}
    >
      {message}
    </motion.div>
  )}
</AnimatePresence>

      <footer className="relative z-10 mt-6 pb-8 text-center text-xs text-slate-500">
        <p>Designed for joy Click Start, then pop the negative words.</p>
        {lastAffirmation && (
          <p className="mt-1 italic text-slate-600">Last affirmation: {lastAffirmation}</p>
        )}
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/80 p-3 text-center shadow-sm">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-lg font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function BalloonItem({
  b,
  onPop,
  onExitTop,
}: {
  b: Balloon;
  onPop: () => void;
  onExitTop: () => void;
}) {
  const [popped, setPopped] = useState(false);
  const swayDur = useMemo(() => `${(Math.random() * 4 + 5).toFixed(2)}s`, []);

  return (
    <motion.div
      initial={{ y: 520 }}
      animate={{ y: -240 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{
        y: { duration: Math.max(5.5, b.speed), ease: "linear" },
        default: { duration: 0.18 },
      }}
      onAnimationComplete={(def) => {
        if (def === "y" && !popped) onExitTop();
      }}
      style={{
        left: `${b.xPct}%`,
        transform: `translateX(-50%) scale(${b.size})`,
      }}
      className="absolute flex flex-col items-center bg-transparent"
    >
      <button
        onClick={() => {
          setPopped(true);
          onPop();
        }}
        aria-label={`Balloon: ${b.word} (${b.kind})`}
        className="relative flex h-20 w-20 items-center justify-center rounded-full text-sm font-semibold text-white shadow-lg ring-1 ring-white/30 sway bg-transparent border-0 outline-none"
        style={{
          background: `radial-gradient(circle at 30% 30%, hsl(${b.hue} 95% 85%), hsl(${b.hue} 85% 65%))`,
          boxShadow: `0 10px 20px hsl(${b.hue} 80% 70% / 0.35)`,
          // @ts-ignore
          "--sway": swayDur,
        }}
      >
        <span className="drop-shadow-sm">{b.word}</span>
        <span className="pointer-events-none absolute left-3 top-3 h-3 w-6 rounded-full bg-white/50 blur-[1px]" />
      </button>

      <svg
        width="20"
        height="40"
        viewBox="0 0 20 40"
        xmlns="http://www.w3.org/2000/svg"
        className="mt-[-2px] mx-auto"
      >
        <path
          d="M10 0 C 14 10, 6 20, 10 40"
          stroke="rgba(0,0,0,0.35)"
          strokeWidth="1.2"
          fill="transparent"
        />
      </svg>

      <span
        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] shadow-md ${
          b.kind === "negative"
            ? "bg-rose-500 text-white"
            : "bg-emerald-500 text-white"
        }`}
      >
        {b.kind}
      </span>
    </motion.div>
  );
}
