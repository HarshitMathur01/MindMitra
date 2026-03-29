import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Pause, Play, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";

/* ─── Types ─── */
type Phase = "idle" | "inhale" | "hold-in" | "exhale" | "hold-out";

type Technique = {
  label: string;
  tag: string;
  inhale: number;
  holdIn: number;
  exhale: number;
  holdOut: number;
};

/* ─── Constants ─── */
const techniques: Technique[] = [
  { label: "Box",   tag: "4 · 4 · 4 · 4", inhale: 4, holdIn: 4, exhale: 4, holdOut: 4 },
  { label: "Relax", tag: "4 · 7 · 8",      inhale: 4, holdIn: 7, exhale: 8, holdOut: 0 },
  { label: "Calm",  tag: "5 · 5",           inhale: 5, holdIn: 0, exhale: 5, holdOut: 0 },
];

const SESSION_OPTIONS = [
  { label: "1 min", seconds: 60 },
  { label: "3 min", seconds: 180 },
  { label: "5 min", seconds: 300 },
];

const phaseOrder: Exclude<Phase, "idle">[] = [
  "inhale",
  "hold-in",
  "exhale",
  "hold-out",
];

const phaseLabels: Record<string, string> = {
  inhale:     "Breathe In",
  "hold-in":  "Hold",
  exhale:     "Breathe Out",
  "hold-out": "Hold",
};

/* ─── Phase-keyed palettes ─── */
const AMBIENT_BG: Record<string, string> = {
  idle:       "from-[#0b1120] via-[#0e1829] to-[#0a1322]",
  inhale:     "from-[#091e2d] via-[#0c2838] to-[#071c2e]",
  "hold-in":  "from-[#0e1833] via-[#111d3a] to-[#0c162e]",
  exhale:     "from-[#140f28] via-[#181233] to-[#110d26]",
  "hold-out": "from-[#0d1326] via-[#10172e] to-[#0b1123]",
};

const CIRCLE_PALETTE: Record<string, { from: string; to: string; glow: string }> = {
  idle:       { from: "#5eead4", to: "#2dd4bf", glow: "rgba(94,234,212,0.22)" },
  inhale:     { from: "#67e8f9", to: "#22d3ee", glow: "rgba(103,232,249,0.28)" },
  "hold-in":  { from: "#93c5fd", to: "#60a5fa", glow: "rgba(147,197,253,0.22)" },
  exhale:     { from: "#c4b5fd", to: "#a78bfa", glow: "rgba(196,181,253,0.26)" },
  "hold-out": { from: "#a5b4fc", to: "#818cf8", glow: "rgba(165,180,252,0.22)" },
};

const PHASE_GUIDE: Record<string, string> = {
  idle:       "Find a comfortable position and begin when you're ready",
  inhale:     "Breathe in slowly through your nose",
  "hold-in":  "Hold gently… stay still",
  exhale:     "Release slowly through your mouth",
  "hold-out": "Rest in the stillness",
};

const BREATHING_TIPS: string[] = [
  "Let your breath be your anchor. Nothing else needs your attention right now.",
  "Each exhale releases tension you didn't know you were holding.",
  "Your nervous system is grateful for every conscious breath you take.",
  "Breathing slowly signals safety to every cell in your body.",
  "You don't have to do this perfectly. Just keep breathing.",
  "Notice the pause between each breath — that stillness belongs to you.",
  "Three minutes of conscious breathing can noticeably lower cortisol.",
];

const COMPLETION_QUOTES: string[] = [
  "The breath is always there, waiting to bring you home.",
  "You just gave your nervous system the greatest gift — presence.",
  "Calm is not the absence of storm. It is breathing through one.",
  "In these few minutes, you moved from reaction to response. That is everything.",
];

/* ─── Floating particles (generated once) ─── */
const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2.5 + 1,
  duration: Math.random() * 25 + 18,
  delay: Math.random() * 12,
  opacity: Math.random() * 0.25 + 0.08,
}));

/* ─── Helpers ─── */
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

const RING_R = 118;
const RING_C = 2 * Math.PI * RING_R;

/* ═══════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════ */
export default function Breathe() {
  const navigate = useNavigate();

  const [techIdx, setTechIdx] = useState(0);
  const [durationIdx, setDurationIdx] = useState(1); // 3 min default
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [phaseCountdown, setPhaseCountdown] = useState(0);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const [tipIdx, setTipIdx] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);

  const tech = techniques[techIdx];
  const sessionTarget = SESSION_OPTIONS[durationIdx].seconds;

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const countdownRef = useRef(0);
  const sessionRef = useRef(0);
  const tipIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Phase helpers ── */
  const getNextPhase = (current: Phase): Phase => {
    const idx = phaseOrder.indexOf(current as Exclude<Phase, "idle">);
    let next = phaseOrder[(idx + 1) % phaseOrder.length];
    if (next === "inhale") setCycleCount((c) => c + 1);
    while (getPhaseSeconds(tech, next as Phase) === 0) {
      const ni = phaseOrder.indexOf(next);
      next = phaseOrder[(ni + 1) % phaseOrder.length];
      if (next === "inhale") setCycleCount((c) => c + 1);
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
    setTipIdx(0);
    setCycleCount(0);
  };

  const begin = () => {
    if (done) reset();
    const first = phaseOrder.find(
      (p) => getPhaseSeconds(tech, p as Phase) > 0,
    ) as Phase;
    startPhase(first);
    setRunning(true);
  };

  /* ── Timers ── */
  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      sessionRef.current += 1;
      setSessionElapsed(sessionRef.current);
      if (sessionRef.current >= sessionTarget) {
        stop();
        setDone(true);
        return;
      }
      countdownRef.current -= 1;
      setPhaseCountdown(countdownRef.current);
      if (countdownRef.current <= 0) {
        const next = getNextPhase(phaseRef.current);
        startPhase(next);
      }
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, techIdx, sessionTarget]);

  useEffect(() => {
    if (running) {
      tipIntervalRef.current = setInterval(
        () => setTipIdx((i) => (i + 1) % BREATHING_TIPS.length),
        30_000,
      );
    } else {
      if (tipIntervalRef.current) clearInterval(tipIntervalRef.current);
      tipIntervalRef.current = null;
    }
    return () => {
      if (tipIntervalRef.current) clearInterval(tipIntervalRef.current);
    };
  }, [running]);

  /* ── Derived ── */
  const circleScale =
    phase === "inhale" ? 1.3 : phase === "exhale" ? 0.78 : 1.04;
  const phaseSec = phase !== "idle" ? getPhaseSeconds(tech, phase) : 4;
  const pal = CIRCLE_PALETTE[phase] ?? CIRCLE_PALETTE.idle;
  const bgClass = AMBIENT_BG[phase] ?? AMBIENT_BG.idle;
  const progress = sessionElapsed / sessionTarget;
  const phaseTotal = phase !== "idle" ? getPhaseSeconds(tech, phase) : 1;
  const phaseProgress = phase !== "idle" ? 1 - phaseCountdown / phaseTotal : 0;
  const ringOffset = RING_C * (1 - phaseProgress);

  const activePhases = phaseOrder.filter(
    (p) => getPhaseSeconds(tech, p as Phase) > 0,
  );
  const currentPhaseIdx = activePhases.indexOf(phase as Exclude<Phase, "idle">);

  const completionQuote = useMemo(
    () => COMPLETION_QUOTES[Math.floor(Math.random() * COMPLETION_QUOTES.length)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [done],
  );

  /* ═══════ Render ═══════ */
  return (
    <div className="relative isolate flex min-h-[100dvh] flex-col overflow-hidden select-none">
      {/* ─── Ambient background ─── */}
      <div className="absolute inset-0 -z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            className={`absolute inset-0 bg-gradient-to-br ${bgClass}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: "easeInOut" }}
          />
        </AnimatePresence>

        {/* Floating particles */}
        {PARTICLES.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-white"
            style={{
              width: p.size,
              height: p.size,
              left: `${p.x}%`,
              top: `${p.y}%`,
            }}
            animate={{
              y: [0, -100, -200],
              x: [0, Math.sin(p.id) * 15, Math.sin(p.id) * 8],
              opacity: [p.opacity, p.opacity * 1.4, 0],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              delay: p.delay,
              ease: "linear",
            }}
          />
        ))}

        {/* Radial vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.45)_100%)]" />
      </div>

      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md text-white/80 transition-all hover:bg-white/15 active:scale-95"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <motion.h1
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-lg font-light tracking-[0.25em] text-white/90 uppercase"
        >
          Breathe
        </motion.h1>

        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md">
          <span className="text-[11px] font-mono text-white/60">
            {formatTime(sessionElapsed)}
          </span>
        </div>
      </div>

      {/* ─── Settings (when idle) ─── */}
      {!done && !running && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.15 }}
          className="flex flex-col items-center gap-3 px-5 pb-5"
        >
          {/* Technique pills */}
          <div className="flex gap-2">
            {techniques.map((t, i) => (
              <button
                key={t.label}
                onClick={() => {
                  reset();
                  setTechIdx(i);
                }}
                className={`rounded-full px-4 py-2 text-xs font-medium tracking-wide transition-all duration-300 ${
                  i === techIdx
                    ? "bg-white/[0.14] text-white backdrop-blur-md ring-1 ring-white/20 shadow-lg shadow-white/5"
                    : "bg-white/5 text-white/40 hover:bg-white/[0.08] hover:text-white/60"
                }`}
              >
                {t.label}{" "}
                <span className="ml-1 text-[10px] opacity-60">{t.tag}</span>
              </button>
            ))}
          </div>
          {/* Duration pills */}
          <div className="flex gap-2">
            {SESSION_OPTIONS.map((opt, i) => (
              <button
                key={opt.label}
                onClick={() => setDurationIdx(i)}
                className={`rounded-full px-3.5 py-1.5 text-[11px] font-medium tracking-wider transition-all duration-300 ${
                  i === durationIdx
                    ? "bg-white/[0.12] text-white/90 ring-1 ring-white/15"
                    : "text-white/35 hover:text-white/55"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {running && <div className="pb-5" />}

      {/* ─── Main area ─── */}
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-5">
        <AnimatePresence mode="wait">
          {done ? (
            /* ── Completion ── */
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="flex flex-col items-center gap-7 text-center px-4 pb-8"
            >
              {/* Glowing orb */}
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-teal-400/20 blur-3xl scale-[1.8]" />
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-teal-400/20 to-cyan-400/10 backdrop-blur-md ring-1 ring-white/10">
                  <motion.span
                    animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="text-3xl text-white/80"
                  >
                    &#10022;
                  </motion.span>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-light tracking-wide text-white/90">
                  Session Complete
                </h2>
                <p className="mt-1.5 text-sm text-white/45 font-light">
                  {SESSION_OPTIONS[durationIdx].label} &middot; {cycleCount}{" "}
                  breath cycle{cycleCount !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="rounded-2xl bg-white/5 backdrop-blur-md p-5 ring-1 ring-white/[0.08] max-w-[300px]">
                <p className="text-sm italic text-white/60 leading-relaxed font-light">
                  &ldquo;{completionQuote}&rdquo;
                </p>
              </div>

              <div className="flex gap-3 mt-1">
                <button
                  onClick={reset}
                  className="rounded-full bg-white/[0.08] backdrop-blur-sm px-5 py-2.5 text-sm text-white/60 ring-1 ring-white/10 transition-all hover:bg-white/[0.12]"
                >
                  Breathe Again
                </button>
                <button
                  onClick={() => navigate(-1)}
                  className="rounded-full bg-white/[0.14] backdrop-blur-sm px-5 py-2.5 text-sm text-white/80 ring-1 ring-white/15 transition-all hover:bg-white/[0.18]"
                >
                  Return Home
                </button>
              </div>
            </motion.div>
          ) : (
            /* ── Active / Idle session ── */
            <motion.div
              key="session"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-8 w-full"
            >
              {/* ── Breathing orb area ── */}
              <div className="relative" style={{ width: 300, height: 300 }}>
                {/* Deep ambient glow */}
                <motion.div
                  className="absolute rounded-full blur-[60px]"
                  style={{
                    width: 200,
                    height: 200,
                    top: 50,
                    left: 50,
                    background: `radial-gradient(circle, ${pal.glow}, transparent 70%)`,
                  }}
                  animate={{
                    scale: running ? [1, 1.35, 1] : [1, 1.08, 1],
                    opacity: running ? [0.5, 0.85, 0.5] : [0.25, 0.35, 0.25],
                  }}
                  transition={{
                    duration: phaseSec,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />

                {/* Concentric pulse rings */}
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-full pointer-events-none"
                    style={{
                      width: 190 + i * 42,
                      height: 190 + i * 42,
                      top: 55 - i * 21,
                      left: 55 - i * 21,
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                    animate={{
                      scale: running
                        ? [1, 1.04 + i * 0.015, 1]
                        : [1, 1.01, 1],
                      opacity: running
                        ? [0.35 - i * 0.08, 0.1, 0.35 - i * 0.08]
                        : 0.15,
                    }}
                    transition={{
                      duration: phaseSec,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: i * 0.35,
                    }}
                  />
                ))}

                {/* SVG progress ring */}
                <svg
                  width="300"
                  height="300"
                  className="absolute inset-0 -rotate-90 z-10 pointer-events-none"
                >
                  {/* Track */}
                  <circle
                    cx="150"
                    cy="150"
                    r={RING_R}
                    fill="none"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeOpacity="0.06"
                  />
                  {/* Progress arc */}
                  <motion.circle
                    cx="150"
                    cy="150"
                    r={RING_R}
                    fill="none"
                    stroke={pal.from}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeOpacity="0.55"
                    style={{ strokeDasharray: RING_C }}
                    animate={{ strokeDashoffset: ringOffset }}
                    transition={{ duration: 1, ease: "linear" }}
                  />
                </svg>

                {/* ── Main orb ── */}
                <motion.div
                  animate={{ scale: running ? circleScale : 1 }}
                  transition={{
                    duration: phaseSec,
                    ease: "easeInOut",
                  }}
                  className="absolute rounded-full backdrop-blur-sm"
                  style={{
                    width: 180,
                    height: 180,
                    top: 60,
                    left: 60,
                    background: `radial-gradient(circle at 38% 36%, ${pal.from}20, ${pal.to}10, transparent 70%)`,
                    boxShadow: `0 0 80px ${pal.glow}, inset 0 0 60px ${pal.glow}`,
                    border: "1.5px solid rgba(255,255,255,0.10)",
                  }}
                >
                  <div className="flex h-full w-full flex-col items-center justify-center">
                    {phase !== "idle" ? (
                      <>
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={`${phase}-${phaseCountdown}`}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.08 }}
                            transition={{ duration: 0.22 }}
                            className="text-[42px] font-extralight text-white/90 tabular-nums leading-none"
                          >
                            {phaseCountdown}
                          </motion.span>
                        </AnimatePresence>
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={phase}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.35 }}
                            className="mt-2 text-[10px] font-medium text-white/55 tracking-[0.22em] uppercase"
                          >
                            {phaseLabels[phase]}
                          </motion.span>
                        </AnimatePresence>
                      </>
                    ) : (
                      <motion.span
                        animate={{ opacity: [0.5, 0.9, 0.5] }}
                        transition={{
                          duration: 3.5,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                        className="text-base font-light text-white/65 tracking-[0.2em]"
                      >
                        Ready
                      </motion.span>
                    )}
                  </div>
                </motion.div>
              </div>

              {/* ── Phase cycle indicator ── */}
              {running && (
                <div className="flex items-center gap-1.5">
                  {activePhases.map((p, i) => (
                    <motion.div
                      key={p}
                      className="rounded-full"
                      animate={{
                        width: i === currentPhaseIdx ? 22 : 6,
                        height: 6,
                        backgroundColor:
                          i === currentPhaseIdx
                            ? pal.from
                            : "rgba(255,255,255,0.15)",
                      }}
                      transition={{ duration: 0.4, ease: "easeInOut" }}
                    />
                  ))}
                </div>
              )}

              {/* ── Phase guide ── */}
              <AnimatePresence mode="wait">
                <motion.p
                  key={phase}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.55 }}
                  className="text-center text-[13px] text-white/45 font-light leading-relaxed max-w-[250px]"
                >
                  {PHASE_GUIDE[phase] ?? PHASE_GUIDE.idle}
                </motion.p>
              </AnimatePresence>

              {/* ── Rotating breathing tip ── */}
              {running && (
                <AnimatePresence mode="wait">
                  <motion.p
                    key={tipIdx}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    className="max-w-[280px] text-center text-[11px] italic text-white/25 leading-relaxed font-light"
                  >
                    &ldquo;{BREATHING_TIPS[tipIdx]}&rdquo;
                  </motion.p>
                </AnimatePresence>
              )}

              {/* ── Session progress bar ── */}
              <div className="w-48">
                <div className="h-[2px] rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${pal.from}88, ${pal.to}55)`,
                    }}
                    animate={{ width: `${progress * 100}%` }}
                    transition={{ duration: 0.8, ease: "linear" }}
                  />
                </div>
                <p className="mt-2 text-center text-[10px] text-white/25 font-light tracking-wider">
                  {Math.ceil((sessionTarget - sessionElapsed) / 60)} min
                  remaining
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Controls ─── */}
      {!done && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2 }}
          className="flex items-center justify-center gap-6 px-5 pb-10 pt-4"
        >
          <button
            onClick={reset}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] backdrop-blur-md text-white/50 ring-1 ring-white/[0.08] transition-all hover:bg-white/10 active:scale-95"
            aria-label="Reset"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={running ? stop : begin}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.12] backdrop-blur-md text-white ring-1 ring-white/[0.15] shadow-lg shadow-black/20 transition-all hover:bg-white/[0.18] active:scale-95"
            aria-label={running ? "Pause" : "Start"}
          >
            {running ? (
              <Pause className="h-6 w-6" />
            ) : (
              <Play className="h-6 w-6 translate-x-0.5" />
            )}
          </button>
          {/* Invisible spacer for optical centering */}
          <div className="h-11 w-11" />
        </motion.div>
      )}
    </div>
  );
}
