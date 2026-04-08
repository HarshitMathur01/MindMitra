import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wind, Timer, Volume2, VolumeX, Play, RotateCcw, Check } from "lucide-react";
import ToolShell from "@/components/mindgym/ToolShell";
import { cn } from "@/lib/utils";

interface BreathSphereProps {
  onAvatarCue?: (text: string, emotion: string) => void;
}

type Pattern = "calm" | "box" | "478" | "sigh";
type Phase = "inhale" | "holdIn" | "exhale" | "holdOut";

interface PatternConfig {
  label: string;
  desc: string;
  phases: Record<Phase, number>;
}

const PATTERNS: Record<Pattern, PatternConfig> = {
  calm: {
    label: "Calm",
    desc: "4-4-6-2 — gentle reset",
    phases: { inhale: 4, holdIn: 4, exhale: 6, holdOut: 2 },
  },
  box: {
    label: "Box Breathing",
    desc: "4-4-4-4 — Navy SEAL calm",
    phases: { inhale: 4, holdIn: 4, exhale: 4, holdOut: 4 },
  },
  "478": {
    label: "4-7-8",
    desc: "Dr. Weil's sleep technique",
    phases: { inhale: 4, holdIn: 7, exhale: 8, holdOut: 0 },
  },
  sigh: {
    label: "Physiological Sigh",
    desc: "Double inhale + long exhale",
    phases: { inhale: 2.5, holdIn: 1.5, exhale: 7, holdOut: 1 },
  },
};

const PHASE_ORDER: Phase[] = ["inhale", "holdIn", "exhale", "holdOut"];

const PHASE_LABELS: Record<Phase, string> = {
  inhale: "Breathe In",
  holdIn: "Hold",
  exhale: "Breathe Out",
  holdOut: "Rest",
};

const DURATIONS = [
  { label: "2 min", seconds: 120 },
  { label: "5 min", seconds: 300 },
];

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  angle: number;
  speed: number;
  opacity: number;
  life: number;
}

function useAmbientSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const runningRef = useRef(false);

  const start = useCallback(() => {
    if (runningRef.current) return;
    try {
      const ctx = new AudioContext();
      
      const bufferLength = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferLength, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferLength; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5; 
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(200, ctx.currentTime);
      filter.Q.setValueAtTime(1, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();

      ctxRef.current = ctx;
      sourceRef.current = source;
      gainRef.current = gain;
      filterRef.current = filter;
      runningRef.current = true;
    } catch {
    }
  }, []);

  const updatePhase = useCallback((phase: "inhale" | "holdIn" | "exhale" | "holdOut", active: boolean) => {
    const gain = gainRef.current;
    const ctx = ctxRef.current;
    const filter = filterRef.current;
    if (gain && ctx && filter) {
      if (!active) {
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
        return;
      }
      const duration = 0.5;
      if (phase === "inhale") {
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + duration);
        filter.frequency.linearRampToValueAtTime(800, ctx.currentTime + duration);
      } else if (phase === "holdIn") {
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + duration);
        filter.frequency.linearRampToValueAtTime(600, ctx.currentTime + duration);
      } else {
        gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + duration);
        filter.frequency.linearRampToValueAtTime(200, ctx.currentTime + duration);
      }
    }
  }, []);

  const stop = useCallback(() => {
    try {
      sourceRef.current?.stop();
      ctxRef.current?.close();
    } catch {
    }
    runningRef.current = false;
    ctxRef.current = null;
    sourceRef.current = null;
    gainRef.current = null;
    filterRef.current = null;
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { start, stop, updatePhase };
}

export default function BreathSphere({ onAvatarCue }: BreathSphereProps) {
  const [pattern, setPattern] = useState<Pattern>("calm");
  const [duration, setDuration] = useState(120);
  const [customMin, setCustomMin] = useState("");
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [moodAnswer, setMoodAnswer] = useState<boolean | null>(null);

  const [phase, setPhase] = useState<Phase>("inhale");
  const [phaseProgress, setPhaseProgress] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [particles, setParticles] = useState<Particle[]>([]);
  const [sphereScale, setSphereScale] = useState(1);
  const [glowIntensity, setGlowIntensity] = useState(0.3);
  const [sphereColorPhase, setSphereColorPhase] = useState<"inhale" | "exhale">(
    "inhale",
  );

  const particleIdRef = useRef(0);
  const timerIdRef = useRef<NodeJS.Timeout | null>(null);
  const particleAnimRef = useRef<number>(0);
  const elapsedRef = useRef(0);
  const phaseElapsedRef = useRef(0);
  const phaseIndexRef = useRef(0);
  const cycleRef = useRef(0);

  const audio = useAmbientSound();

  const config = PATTERNS[pattern];

  const spawnParticles = useCallback(() => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      newParticles.push({
        id: particleIdRef.current++,
        x: 0,
        y: 0,
        size: 2 + Math.random() * 4,
        angle,
        speed: 30 + Math.random() * 50,
        opacity: 0.6 + Math.random() * 0.4,
        life: 1,
      });
    }
    setParticles((prev) => [...prev.slice(-20), ...newParticles]);
  }, []);

  const animateParticles = useCallback(() => {
    if (!started) return;

    setParticles((prev) =>
      prev
        .map((p) => ({
          ...p,
          x: p.x + Math.cos(p.angle) * p.speed * 0.016,
          y: p.y + Math.sin(p.angle) * p.speed * 0.016,
          life: Math.max(0, p.life - 0.016 * 0.7),
          opacity: p.opacity * Math.max(0, p.life - 0.016 * 0.7),
        }))
        .filter((p) => p.life > 0),
    );

    particleAnimRef.current = requestAnimationFrame(animateParticles);
  }, [started]);

  useEffect(() => {
    if (started) {
      particleAnimRef.current = requestAnimationFrame(animateParticles);
      return () => cancelAnimationFrame(particleAnimRef.current);
    }
  }, [started, animateParticles]);

  // Main timer loop: runs every 100ms to update phase and sphere animation
  useEffect(() => {
    if (!started) return;

    const timer = setInterval(() => {
      elapsedRef.current += 0.1;
      phaseElapsedRef.current += 0.1;

      const pIdx = phaseIndexRef.current;
      const currentPhase = PHASE_ORDER[pIdx];
      const phaseDuration = config.phases[currentPhase];

      // Phase transition logic
      if (phaseDuration > 0 && phaseElapsedRef.current >= phaseDuration) {
        phaseElapsedRef.current = 0;
        const nextIdx = (pIdx + 1) % 4;
        phaseIndexRef.current = nextIdx;
        if (nextIdx === 0) {
          cycleRef.current += 1;
          setCycleCount(cycleRef.current);
        }
        setPhase(PHASE_ORDER[nextIdx]);
      } else if (phaseDuration <= 0) {
        phaseElapsedRef.current = 0;
        const nextIdx = (pIdx + 1) % 4;
        phaseIndexRef.current = nextIdx;
        if (nextIdx === 0) {
          cycleRef.current += 1;
          setCycleCount(cycleRef.current);
        }
        setPhase(PHASE_ORDER[nextIdx]);
      } else {
        setPhase(currentPhase);
      }

      // Calculate phase progress (0 to 1)
      const nowPhase = PHASE_ORDER[phaseIndexRef.current];
      const nowDur = config.phases[nowPhase];
      const progress = nowDur > 0 ? Math.min(phaseElapsedRef.current / nowDur, 1) : 1;

      setPhaseProgress(progress);
      setElapsedSeconds(Math.floor(elapsedRef.current));

      // Compute sphere scale and glow for Framer Motion
      let newScale = 1;
      let newGlow = 0.3;
      let newColorPhase: "inhale" | "exhale" = "inhale";

      if (nowPhase === "inhale") {
        newScale = 1 + progress * 0.5;
        newGlow = 0.3 + progress * 0.4;
        newColorPhase = "inhale";
      } else if (nowPhase === "holdIn") {
        newScale = 1.5;
        newGlow = 0.7 + progress * 0.15;
        newColorPhase = "inhale";
      } else if (nowPhase === "exhale") {
        newScale = 1.5 - progress * 0.5;
        newGlow = 0.85 - progress * 0.55;
        newColorPhase = "exhale";
      } else {
        // holdOut
        newScale = 1;
        newGlow = 0.3;
        newColorPhase = "exhale";
      }

      setSphereScale(newScale);
      setGlowIntensity(newGlow);
      setSphereColorPhase(newColorPhase);

      // Check session completion
      if (elapsedRef.current >= duration) {
        setStarted(false);
        setCompleted(true);
        onAvatarCue?.("Great breathing session! How do you feel?", "calm");
        clearInterval(timerIdRef.current!);
      }
    }, 100);

    timerIdRef.current = timer;

    return () => {
      if (timerIdRef.current) clearInterval(timerIdRef.current);
    };
  }, [started, config, duration, onAvatarCue]);

  useEffect(() => {
    if (started) {
      if (soundOn) audio.start();
      onAvatarCue?.("Let's breathe together. Follow the sphere.", "calm");
    } else {
      audio.stop();
    }
  }, [started, audio, onAvatarCue, soundOn]);

  useEffect(() => {
    if (!started || !soundOn) {
      audio.updatePhase("holdOut", false);
      return;
    }
    audio.updatePhase(phase, true);
    if (phase === "exhale") {
      spawnParticles();
    }
  }, [phase, started, soundOn, audio, spawnParticles]);

  const toggleSound = () => {
    if (soundOn) {
      audio.stop();
    } else {
      audio.start();
    }
    setSoundOn(!soundOn);
  };

  const timeLeft = Math.max(0, duration - elapsedSeconds);
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  const handleReset = () => {
    setStarted(false);
    setCompleted(false);
    setPhase("inhale");
    setPhaseProgress(0);
    setCycleCount(0);
    setElapsedSeconds(0);
    setMoodAnswer(null);
    setSphereScale(1);
    setGlowIntensity(0.3);
    setSphereColorPhase("inhale");
    phaseElapsedRef.current = 0;
    phaseIndexRef.current = 0;
    cycleRef.current = 0;
    elapsedRef.current = 0;
    setParticles([]);
    if (timerIdRef.current) clearInterval(timerIdRef.current);
    audio.stop();
  };

  const handleCustomDuration = () => {
    const mins = parseFloat(customMin);
    if (mins > 0 && mins <= 30) setDuration(Math.round(mins * 60));
  };

  return (
    <ToolShell
      toolId="breath-sphere"
      title="Breath Sphere"
      clinicalBasis="Diaphragmatic breathing activates the parasympathetic nervous system, improving heart-rate variability (HRV) and reducing cortisol. Even 2 minutes of paced breathing can shift your autonomic state from fight-or-flight to rest-and-digest."
      xp={20}
      completed={completed && moodAnswer !== null}
      onReset={handleReset}
      themeColor="from-[#0a1128] via-[#12243d] to-[#0d182b]"
    >
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
        <AnimatePresence mode="wait">
          {!started && !completed && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider mb-3">
                  Breathing Pattern
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(Object.entries(PATTERNS) as [Pattern, PatternConfig][]).map(
                    ([key, val]) => (
                      <button
                        key={key}
                        onClick={() => setPattern(key)}
                        className={cn(
                          "p-4 rounded-2xl border text-left transition-all duration-300",
                          pattern === key
                            ? "border-primary/50 bg-primary/10 shadow-[0_0_20px_rgba(20,184,166,0.15)]"
                            : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
                        )}
                      >
                        <p className="text-sm font-medium text-white/90 mb-1">
                          {val.label}
                        </p>
                        <p className="text-xs text-white/40">{val.desc}</p>
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider mb-3">
                  Duration
                </p>
                <div className="flex gap-3 flex-wrap">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.seconds}
                      onClick={() => setDuration(d.seconds)}
                      className={cn(
                        "px-5 py-2.5 rounded-xl border text-sm transition-all duration-300",
                        duration === d.seconds
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]",
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      placeholder="Custom"
                      value={customMin}
                      onChange={(e) => setCustomMin(e.target.value)}
                      className="w-20 px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-white/80 placeholder:text-white/30 focus:outline-none focus:border-primary/50"
                    />
                    {customMin && (
                      <button
                        onClick={handleCustomDuration}
                        className="text-xs text-primary hover:text-primary"
                      >
                        Set
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-center pt-4">
                <motion.button
                  onClick={() => setStarted(true)}
                  className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-primary hover:bg-primary/90 text-white font-medium text-lg transition-colors"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Play className="w-5 h-5" />
                  Begin Breathing
                </motion.button>
              </div>
            </motion.div>
          )}

          {started && (
            <motion.div
              key="breathing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center pt-4"
            >
              <div className="flex items-center justify-between w-full mb-6">
                <div className="flex items-center gap-3">
                  <Wind className="w-4 h-4 text-primary/60" />
                  <span className="text-sm text-white/50">
                    Cycle {Math.max(1, cycleCount)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleSound}
                    className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    {soundOn ? (
                      <Volume2 className="w-4 h-4 text-white/40" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-white/40" />
                    )}
                  </button>
                  <div className="flex items-center gap-1.5 text-white/40">
                    <Timer className="w-3.5 h-3.5" />
                    <span className="text-sm font-mono tabular-nums">
                      {mins}:{secs.toString().padStart(2, "0")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="relative w-72 h-72 flex items-center justify-center my-8">
                {/* Outer glow rings — Framer Motion animated */}
                {[1, 2, 3].map((ring) => (
                  <motion.div
                    key={ring}
                    className="absolute inset-0 rounded-full"
                    animate={{
                      scale: sphereScale * (1 + ring * 0.12),
                    }}
                    transition={{ type: "tween", duration: 0.6, ease: "easeOut" }}
                    style={{
                      background: `radial-gradient(circle, hsla(${
                        sphereColorPhase === "inhale" ? "188" : "35"
                      }, 70%, 50%, ${glowIntensity * 0.08 / ring}) 0%, transparent 70%)`,
                    }}
                  />
                ))}

                {/* Main sphere — Framer Motion driven */}
                <motion.div
                  className="absolute w-40 h-40 rounded-full"
                  animate={{
                    scale: sphereScale,
                  }}
                  transition={{ type: "tween", duration: 0.6, ease: "easeOut" }}
                  style={{
                    background: `radial-gradient(circle at 35% 35%, hsla(${
                      sphereColorPhase === "inhale" ? "188" : "35"
                    }, 80%, 65%, ${glowIntensity + 0.1}), hsla(${
                      sphereColorPhase === "inhale" ? "188" : "35"
                    }, 60%, 40%, ${glowIntensity * 0.7}), hsla(${
                      sphereColorPhase === "inhale" ? "218" : "65"
                    }, 50%, 20%, ${glowIntensity * 0.3}))`,
                    boxShadow: `
                      0 0 ${40 * glowIntensity}px hsla(${
                      sphereColorPhase === "inhale" ? "188" : "35"
                    }, 70%, 50%, ${glowIntensity * 0.6}),
                      0 0 ${80 * glowIntensity}px hsla(${
                      sphereColorPhase === "inhale" ? "188" : "35"
                    }, 60%, 40%, ${glowIntensity * 0.3}),
                      inset 0 0 ${30 * glowIntensity}px hsla(${
                      sphereColorPhase === "inhale" ? "188" : "35"
                    }, 90%, 80%, ${glowIntensity * 0.2})
                    `,
                  }}
                />

                {/* Highlight — follows sphere scale */}
                <motion.div
                  className="absolute w-16 h-10 rounded-full"
                  animate={{
                    scale: sphereScale * 0.7,
                    top: `calc(50% - ${sphereScale * 28}px)`,
                    left: `calc(50% - ${sphereScale * 10}px)`,
                  }}
                  transition={{ type: "tween", duration: 0.6, ease: "easeOut" }}
                  style={{
                    background: `radial-gradient(ellipse, hsla(0, 0%, 100%, ${glowIntensity * 0.25}), transparent 70%)`,
                  }}
                />

                {/* Particles */}
                {particles.map((p) => (
                  <div
                    key={p.id}
                    className="absolute rounded-full"
                    style={{
                      width: p.size,
                      height: p.size,
                      left: `calc(50% + ${p.x}px)`,
                      top: `calc(50% + ${p.y}px)`,
                      background: `hsla(${
                        sphereColorPhase === "inhale" ? "188" : "35"
                      }, 70%, 70%, ${p.opacity * p.life})`,
                      boxShadow: `0 0 ${p.size * 2}px hsla(${
                        sphereColorPhase === "inhale" ? "188" : "35"
                      }, 70%, 60%, ${p.opacity * p.life * 0.5})`,
                    }}
                  />
                ))}

                {/* Orbiting dots */}
                {[0, 1, 2, 3].map((i) => {
                  const angle = (i / 4) * Math.PI * 2 + elapsedSeconds * 0.3;
                  const radius = 80 * sphereScale;
                  return (
                    <div
                      key={`orb-${i}`}
                      className="absolute w-1.5 h-1.5 rounded-full"
                      style={{
                        left: `calc(50% + ${Math.cos(angle) * radius}px)`,
                        top: `calc(50% + ${Math.sin(angle) * radius}px)`,
                        background: `hsla(${
                          sphereColorPhase === "inhale" ? "188" : "35"
                        }, 60%, 60%, ${glowIntensity * 0.4})`,
                        boxShadow: `0 0 6px hsla(${
                          sphereColorPhase === "inhale" ? "188" : "35"
                        }, 60%, 60%, ${glowIntensity * 0.3})`,
                      }}
                    />
                  );
                })}
              </div>

              {/* Phase indicator */}
              <motion.div
                key={phase}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-4"
              >
                <p className="text-2xl font-light text-white/90 tracking-wide">
                  {PHASE_LABELS[phase]}
                </p>
                <p className="text-sm text-white/30 mt-1">
                  {config.phases[phase]}s
                </p>
              </motion.div>

              {/* Phase progress ring */}
              <svg width="48" height="48" className="mb-6">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="2"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                  strokeOpacity={0.5}
                  strokeDasharray={`${phaseProgress * 125.6} 125.6`}
                  strokeLinecap="round"
                  transform="rotate(-90 24 24)"
                  style={{ transition: "stroke-dasharray 0.1s linear" }}
                />
              </svg>

              {/* Session progress */}
              <div className="w-full max-w-xs">
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/50 rounded-full transition-all duration-1000"
                    style={{
                      width: `${(elapsedSeconds / duration) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {completed && (
            <motion.div
              key="post"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center pt-12 space-y-8"
            >
              <div>
                <p className="text-5xl font-light text-primary mb-2">
                  {cycleCount}
                </p>
                <p className="text-white/40 text-sm">
                  breathing cycles completed
                </p>
              </div>

              <div className="space-y-4">
                <p className="text-white/70 text-lg">Do you feel calmer?</p>
                <div className="flex justify-center gap-4">
                  <motion.button
                    onClick={() => setMoodAnswer(true)}
                    className={cn(
                      "flex items-center gap-2 px-6 py-3 rounded-2xl border transition-all duration-300",
                      moodAnswer === true
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]",
                    )}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Check className="w-4 h-4" />
                    Yes
                  </motion.button>
                  <motion.button
                    onClick={() => setMoodAnswer(false)}
                    className={cn(
                      "flex items-center gap-2 px-6 py-3 rounded-2xl border transition-all duration-300",
                      moodAnswer === false
                        ? "border-white/50 bg-white/15 text-white"
                        : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]",
                    )}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Not yet
                  </motion.button>
                </div>
                {moodAnswer === false && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm text-white/40 italic"
                  >
                    That's okay — it can take practice. Try a longer session next
                    time.
                  </motion.p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToolShell>
  );
}
