import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Pause, Play, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Phase = "idle" | "inhale" | "hold-in" | "exhale" | "hold-out";

type Technique = {
  label: string;
  inhale: number;
  holdIn: number;
  exhale: number;
  holdOut: number;
};

const techniques: Technique[] = [
  { label: "Box 4-4-4-4", inhale: 4, holdIn: 4, exhale: 4, holdOut: 4 },
  { label: "4-7-8", inhale: 4, holdIn: 7, exhale: 8, holdOut: 0 },
  { label: "Calm 5-5", inhale: 5, holdIn: 0, exhale: 5, holdOut: 0 },
];

const phaseOrder: Exclude<Phase, "idle">[] = ["inhale", "hold-in", "exhale", "hold-out"];

const phaseLabels: Record<string, string> = {
  inhale: "Inhale",
  "hold-in": "Hold",
  exhale: "Exhale",
  "hold-out": "Hold",
};

const phaseColors: Record<string, string> = {
  inhale: "from-teal-300 to-teal-500",
  "hold-in": "from-sky-300 to-sky-500",
  exhale: "from-violet-300 to-violet-500",
  "hold-out": "from-indigo-300 to-indigo-500",
  idle: "from-teal-200 to-teal-400",
};

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function getPhaseSeconds(tech: Technique, phase: Phase): number {
  if (phase === "inhale") return tech.inhale;
  if (phase === "hold-in") return tech.holdIn;
  if (phase === "exhale") return tech.exhale;
  if (phase === "hold-out") return tech.holdOut;
  return 0;
}

const SESSION_TARGET = 3 * 60; // 3 minutes

export default function Breathe() {
  const navigate = useNavigate();
  const [techIdx, setTechIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [phaseCountdown, setPhaseCountdown] = useState(0);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [done, setDone] = useState(false);

  const tech = techniques[techIdx];
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const countdownRef = useRef(0);
  const sessionRef = useRef(0);

  const getNextPhase = (current: Phase): Phase => {
    const idx = phaseOrder.indexOf(current as Omit<Phase, "idle">);
    let next = phaseOrder[(idx + 1) % phaseOrder.length];
    // skip zero-duration phases
    while (getPhaseSeconds(tech, next as Phase) === 0) {
      const ni = phaseOrder.indexOf(next);
      next = phaseOrder[(ni + 1) % phaseOrder.length];
    }
    return next as Phase;
  };

  const startPhase = (p: Phase) => {
    const secs = getPhaseSeconds(tech, p);
    phaseRef.current = p;
    countdownRef.current = secs;
    setPhase(p);
    setPhaseCountdown(secs);
  };

  const stop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRunning(false);
  };

  const reset = () => {
    stop();
    setPhase("idle");
    setPhaseCountdown(0);
    setSessionElapsed(0);
    sessionRef.current = 0;
    setDone(false);
  };

  const begin = () => {
    if (done) reset();
    const firstPhase = phaseOrder.find((p) => getPhaseSeconds(tech, p as Phase) > 0) as Phase;
    startPhase(firstPhase);
    setRunning(true);
  };

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      // session elapsed
      sessionRef.current += 1;
      setSessionElapsed(sessionRef.current);
      if (sessionRef.current >= SESSION_TARGET) {
        stop();
        setDone(true);
        return;
      }
      // phase countdown
      countdownRef.current -= 1;
      setPhaseCountdown(countdownRef.current);
      if (countdownRef.current <= 0) {
        const next = getNextPhase(phaseRef.current);
        startPhase(next);
      }
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, techIdx]);

  // circle scale based on phase
  const circleScale = phase === "inhale" ? 1.35 : phase === "exhale" ? 0.75 : 1.05;
  const circleDuration = phase === "idle" ? 0 : getPhaseSeconds(tech, phase);

  const gradientClass = phaseColors[phase] || phaseColors.idle;
  const progress = sessionElapsed / SESSION_TARGET;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-sky-50 dark:from-[#0a1a1e] dark:via-[#0d1f26] dark:to-[#0a1828] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-safe pt-5 pb-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 dark:bg-white/10 shadow-sm transition-transform hover:scale-105 active:scale-95"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="text-center">
          <h1 className="text-[17px] font-semibold text-foreground">Breathing</h1>
          <p className="text-xs text-muted-foreground">{tech.label}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 dark:bg-white/10 shadow-sm">
          <span className="text-sm font-mono font-medium text-teal-700 dark:text-teal-400">
            {formatTime(sessionElapsed)}
          </span>
        </div>
      </div>

      {/* Technique selector */}
      <div className="flex justify-center gap-2 px-5 pb-6">
        {techniques.map((t, i) => (
          <button
            key={t.label}
            onClick={() => { reset(); setTechIdx(i); }}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-150 ${
              i === techIdx
                ? "bg-teal-600 text-white shadow-md"
                : "bg-white/70 dark:bg-white/10 text-muted-foreground hover:bg-white dark:hover:bg-white/20"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Main breathing circle */}
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 text-center"
            >
              <div className="flex h-32 w-32 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-500/20 text-5xl shadow-lg">
                ✨
              </div>
              <h2 className="text-2xl font-bold text-foreground">Session Complete</h2>
              <p className="text-sm text-muted-foreground max-w-[220px]">
                You breathed mindfully for 3 minutes. Your nervous system thanks you.
              </p>
              <div className="mt-2 flex items-center gap-2 rounded-full bg-teal-600 px-6 py-2 text-sm font-semibold text-white">
                🔥 Streak +1
              </div>
            </motion.div>
          ) : (
            <motion.div key="circle" className="relative flex items-center justify-center">
              {/* Outer pulse ring */}
              <motion.div
                animate={{ scale: running ? [1, 1.08, 1] : 1, opacity: running ? [0.3, 0.15, 0.3] : 0 }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className={`absolute rounded-full bg-gradient-to-br ${gradientClass}`}
                style={{ width: 240, height: 240 }}
              />
              {/* Main circle */}
              <motion.div
                animate={{ scale: running ? circleScale : 1 }}
                transition={{ duration: circleDuration, ease: "easeInOut" }}
                className={`relative flex flex-col items-center justify-center rounded-full bg-gradient-to-br ${gradientClass} shadow-[0_20px_60px_rgba(20,184,166,0.3)]`}
                style={{ width: 200, height: 200 }}
              >
                {phase !== "idle" ? (
                  <>
                    <span className="text-5xl font-bold text-white">{phaseCountdown}</span>
                    <span className="mt-1 text-sm font-medium text-white/90">{phaseLabels[phase]}</span>
                  </>
                ) : (
                  <span className="text-2xl font-semibold text-white">Ready</span>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Session progress bar */}
        {!done && (
          <div className="w-48">
            <div className="h-1 rounded-full bg-teal-100 dark:bg-teal-900/40 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-teal-500"
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="mt-1.5 text-center text-xs text-muted-foreground">
              {Math.ceil((SESSION_TARGET - sessionElapsed) / 60)} min left
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 px-5 pb-10 pt-6">
        {!done && (
          <button
            onClick={reset}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/70 dark:bg-white/10 shadow-sm transition-transform hover:scale-105 active:scale-95"
            aria-label="Reset"
          >
            <RotateCcw className="h-5 w-5 text-muted-foreground" />
          </button>
        )}
        <button
          onClick={done ? reset : running ? stop : begin}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-600 text-white shadow-[0_8px_24px_rgba(20,184,166,0.4)] transition-transform hover:scale-105 active:scale-95"
          aria-label={running ? "Pause" : "Start"}
        >
          {running ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 translate-x-0.5" />}
        </button>
        {done && (
          <button
            onClick={() => navigate(-1)}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/70 dark:bg-white/10 shadow-sm transition-transform hover:scale-105 active:scale-95"
            aria-label="Go home"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Phase guide */}
      {!done && phase !== "idle" && (
        <div className="pb-8 text-center">
          <p className="text-sm text-muted-foreground">
            {phase === "inhale" && "Breathe in slowly through your nose..."}
            {phase === "hold-in" && "Hold gently, stay still..."}
            {phase === "exhale" && "Release slowly through your mouth..."}
            {phase === "hold-out" && "Empty, at peace..."}
          </p>
        </div>
      )}
    </div>
  );
}
