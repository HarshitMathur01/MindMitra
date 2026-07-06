import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wind, Timer, Volume2, VolumeX, Play, RotateCcw, Check, Megaphone } from "lucide-react";
import ToolShell from "@/components/mindgym/ToolShell";
import { WARM_CLASSES } from "@/lib/mindgym/theme";
import { useAzureNarration } from "@/hooks/useAzureNarration";
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

const BREATH_GUIDE_VOICE = {
  voiceName: "en-us-ava:DragonHDOmniLatestNeural",
  language: "en-US",
  role: "Girl",
  style: "whispering",
} as const;

function buildGuidePrompt(pattern: Pattern, phase: Phase): string {
  if (pattern === "sigh") {
    switch (phase) {
      case "inhale":
        return "Take a double inhale, gently and slowly.";
      case "holdIn":
        return "Pause briefly and keep your shoulders relaxed.";
      case "exhale":
        return "Exhale slowly and let the air out fully.";
      case "holdOut":
        return "Rest for a moment. Stay relaxed.";
    }
  }

  const duration = PATTERNS[pattern].phases[phase];
  if (duration <= 0) return "";

  const countText = `${duration} count${duration === 1 ? "" : "s"}`;

  switch (phase) {
    case "inhale":
      return `Inhale slowly for ${countText}.`;
    case "holdIn":
      return `Hold gently for ${countText}.`;
    case "exhale":
      return `Exhale slowly for ${countText}.`;
    case "holdOut":
      return `Rest for ${countText}.`;
  }
}

const BREATH_COMPLETE_PROMPT = "Great work. Take a slow breath and notice how you feel.";

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
      /* Web Audio may be unavailable or suspended */
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
      /* stop/close may throw if already torn down */
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
  const [guideVoiceOn, setGuideVoiceOn] = useState(true);
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
  const narration = useAzureNarration({
    voiceName: BREATH_GUIDE_VOICE.voiceName,
    language: BREATH_GUIDE_VOICE.language,
    role: BREATH_GUIDE_VOICE.role,
    style: BREATH_GUIDE_VOICE.style,
  });
  const lastNarratedPhaseRef = useRef<Phase | null>(null);
  const completedNarrationRef = useRef(false);

  const config = PATTERNS[pattern];
  const sphereHue = sphereColorPhase === "inhale" ? "146" : "100";
  const sphereDepthHue = sphereColorPhase === "inhale" ? "138" : "92";
  const sphereHighlightHue = sphereColorPhase === "inhale" ? "42" : "48";
  const warmSurfaceCard = WARM_CLASSES.panel;
  const warmControlCard = "rounded-2xl border border-border bg-white/84 shadow-[0_16px_36px_-28px_rgba(62,84,60,0.18)] backdrop-blur-sm";

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

  useEffect(() => {
    if (!narration.isSupported) {
      narration.cancel();
      lastNarratedPhaseRef.current = null;
      return;
    }

    if (!guideVoiceOn) {
      narration.cancel();
      lastNarratedPhaseRef.current = null;
      return;
    }

    if (!started) {
      if (!completed) {
        narration.cancel();
        lastNarratedPhaseRef.current = null;
      }
      return;
    }

    const guidePrompt = buildGuidePrompt(pattern, phase);
    if (!guidePrompt || lastNarratedPhaseRef.current === phase) return;

    lastNarratedPhaseRef.current = phase;
    void narration.speak(guidePrompt).catch(() => undefined);
  }, [completed, guideVoiceOn, narration, pattern, phase, started]);

  useEffect(() => {
    if (!completed || !guideVoiceOn || !narration.isSupported) return;
    if (completedNarrationRef.current) return;

    completedNarrationRef.current = true;
    void narration.speak(BREATH_COMPLETE_PROMPT).catch(() => undefined);
  }, [completed, guideVoiceOn, narration]);

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
    narration.cancel();
    lastNarratedPhaseRef.current = null;
    completedNarrationRef.current = false;
    if (timerIdRef.current) clearInterval(timerIdRef.current);
    audio.stop();
  };

  const handleCustomDuration = () => {
    const mins = parseFloat(customMin);
    if (mins > 0 && mins <= 30) setDuration(Math.round(mins * 60));
  };

  const handleStartBreathing = () => {
    setStarted(true);

    if (!guideVoiceOn || !narration.isSupported) return;

    const guidePrompt = buildGuidePrompt(pattern, "inhale");
    if (!guidePrompt) return;

    narration.cancel();
    lastNarratedPhaseRef.current = "inhale";
    void narration.speak(`Let's breathe together. ${guidePrompt}`).catch(() => undefined);
  };

  const toggleGuideVoice = () => {
    if (!narration.isSupported) return;

    const nextEnabled = !guideVoiceOn;
    setGuideVoiceOn(nextEnabled);

    if (!nextEnabled) {
      narration.cancel();
      lastNarratedPhaseRef.current = null;
      return;
    }

    if (!started || completed) return;

    const guidePrompt = buildGuidePrompt(pattern, phase);
    if (!guidePrompt) return;

    narration.cancel();
    lastNarratedPhaseRef.current = phase;
    void narration.speak(guidePrompt).catch(() => undefined);
  };

  return (
    <ToolShell
      toolId="breath-sphere"
      title="Breath Sphere"
      clinicalBasis="Diaphragmatic breathing activates the parasympathetic nervous system, improving heart-rate variability (HRV) and reducing cortisol. Even 2 minutes of paced breathing can shift your autonomic state from fight-or-flight to rest-and-digest."
      xp={20}
      completed={completed && moodAnswer !== null}
      onReset={handleReset}
      themeAccent="teal"
      surfaceTone="warm"
      backdropScene="breath-video"
    >
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
        <AnimatePresence mode="wait">
          {!started && !completed && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`space-y-8 p-5 sm:p-6 ${warmSurfaceCard}`}
            >
              <div>
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-[0.24em] mb-3">
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
                            ? "border-primary/40 bg-primary/12 shadow-[0_0_24px_rgba(82,111,85,0.14)]"
                            : "border-border bg-white/92 hover:bg-white",
                        )}
                      >
                        <p className="text-base font-semibold text-foreground mb-1">
                          {val.label}
                        </p>
                        <p className="text-sm leading-5 text-muted-foreground">{val.desc}</p>
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-[0.24em] mb-3">
                  Duration
                </p>
                <div className="flex gap-3 flex-wrap">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.seconds}
                      onClick={() => setDuration(d.seconds)}
                      className={cn(
                        "px-5 py-2.5 rounded-xl border text-sm font-semibold transition-all duration-300",
                        duration === d.seconds
                          ? "border-primary/40 bg-primary/12 text-primary"
                          : "border-border bg-white/92 text-foreground hover:bg-white",
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
                      className="w-20 px-3 py-2.5 rounded-xl border border-border bg-white/92 text-sm text-foreground font-medium placeholder:text-muted-foreground/55 focus:outline-none focus:border-primary/40"
                    />
                    {customMin && (
                      <button
                        onClick={handleCustomDuration}
                        className="text-sm font-semibold text-primary hover:text-primary"
                      >
                        Set
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-center pt-4">
                <motion.button
                  onClick={handleStartBreathing}
                  className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg transition-colors shadow-[0_18px_40px_-24px_rgba(82,111,85,0.55)]"
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
              <div className={`flex items-center justify-between w-full mb-6 px-4 py-3 ${warmControlCard}`}>
                <div className="flex items-center gap-3">
                  <Wind className="w-4 h-4 text-primary/70" />
                  <span className="text-sm sm:text-base font-medium text-foreground">
                    Cycle {Math.max(1, cycleCount)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleGuideVoice}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      narration.isSupported ? "hover:bg-white" : "cursor-not-allowed opacity-40",
                    )}
                    title={guideVoiceOn ? "Mute guide voice" : "Enable guide voice"}
                    aria-label={guideVoiceOn ? "Mute guide voice" : "Enable guide voice"}
                    disabled={!narration.isSupported}
                  >
                    <Megaphone className={`w-4 h-4 ${guideVoiceOn ? "text-primary" : "text-muted-foreground"} ${narration.isSpeaking ? "animate-pulse" : ""}`} />
                  </button>
                  <button
                    onClick={toggleSound}
                    className="p-2 rounded-lg hover:bg-white transition-colors"
                    title={soundOn ? "Mute ambient sound" : "Enable ambient sound"}
                    aria-label={soundOn ? "Mute ambient sound" : "Enable ambient sound"}
                  >
                    {soundOn ? (
                      <Volume2 className="w-4 h-4 text-primary" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  <div className="flex items-center gap-1.5 text-foreground">
                    <Timer className="w-3.5 h-3.5" />
                    <span className="text-sm sm:text-base font-semibold font-mono tabular-nums">
                      {mins}:{secs.toString().padStart(2, "0")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="relative w-72 h-72 flex items-center justify-center my-8 rounded-full border border-border bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.98)_0%,rgba(247,242,232,0.94)_48%,rgba(227,238,218,0.82)_100%)] shadow-[0_30px_70px_-35px_rgba(62,84,60,0.35)] overflow-hidden">
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
                      background: `radial-gradient(circle, hsla(${sphereHue}, 36%, 58%, ${glowIntensity * 0.08 / ring}) 0%, transparent 70%)`,
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
                    background: `radial-gradient(circle at 35% 35%, hsla(${sphereHue}, 44%, 74%, ${glowIntensity + 0.1}), hsla(${sphereDepthHue}, 32%, 44%, ${glowIntensity * 0.72}), hsla(${sphereHighlightHue}, 52%, 94%, ${glowIntensity * 0.3}))`,
                    boxShadow: `
                      0 0 ${40 * glowIntensity}px hsla(${sphereHue}, 38%, 52%, ${glowIntensity * 0.55}),
                      0 0 ${80 * glowIntensity}px hsla(${sphereDepthHue}, 34%, 42%, ${glowIntensity * 0.28}),
                      inset 0 0 ${30 * glowIntensity}px hsla(${sphereHighlightHue}, 55%, 96%, ${glowIntensity * 0.18})
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
                    background: `radial-gradient(ellipse, hsla(42, 68%, 98%, ${glowIntensity * 0.4}), transparent 70%)`,
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
                      background: `hsla(${sphereHue}, 36%, 60%, ${p.opacity * p.life})`,
                      boxShadow: `0 0 ${p.size * 2}px hsla(${sphereHue}, 38%, 54%, ${p.opacity * p.life * 0.5})`,
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
                        background: `hsla(${sphereHue}, 34%, 58%, ${glowIntensity * 0.4})`,
                        boxShadow: `0 0 6px hsla(${sphereHue}, 34%, 58%, ${glowIntensity * 0.3})`,
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
                className={`text-center mb-4 px-5 py-4 ${warmControlCard}`}
              >
                <p className="text-3xl font-semibold text-foreground tracking-tight">
                  {PHASE_LABELS[phase]}
                </p>
                <p className="text-sm sm:text-base text-muted-foreground mt-1">
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
                  stroke="rgba(74,95,73,0.12)"
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
                <div className="h-2 bg-border/70 rounded-full overflow-hidden">
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
              className={`text-center pt-12 space-y-8 p-5 sm:p-6 ${warmSurfaceCard}`}
            >
              <div>
                <p className="text-6xl font-semibold text-primary mb-2">
                  {cycleCount}
                </p>
                <p className="text-muted-foreground text-sm sm:text-base">
                  breathing cycles completed
                </p>
              </div>

              <div className="space-y-4">
                <p className="text-foreground text-xl font-semibold">Do you feel calmer?</p>
                <div className="flex justify-center gap-4">
                  <motion.button
                    onClick={() => setMoodAnswer(true)}
                    className={cn(
                      "flex items-center gap-2 px-7 py-3.5 rounded-2xl border text-base font-semibold transition-all duration-300",
                      moodAnswer === true
                        ? "border-primary/40 bg-primary/12 text-primary"
                        : "border-border bg-white/92 text-foreground hover:bg-white",
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
                      "flex items-center gap-2 px-7 py-3.5 rounded-2xl border text-base font-semibold transition-all duration-300",
                      moodAnswer === false
                        ? "border-border bg-white text-foreground"
                        : "border-border bg-white/92 text-foreground hover:bg-white",
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
                    className="text-sm sm:text-base text-muted-foreground italic leading-7 max-w-prose mx-auto"
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
