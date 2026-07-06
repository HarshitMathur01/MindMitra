import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Volume2,
  VolumeX,
  BarChart3,
  Settings,
  Clock,
  Users,
} from "lucide-react";
import ToolShell from "@/components/mindgym/ToolShell";
import { createLocalStore } from "@/lib/mindgym/localStore";
import { cn } from "@/lib/utils";
import { recordCompletion } from "@/lib/mindgym/storage";

interface FocusFlowProps {
  onAvatarCue?: (text: string, emotion: string) => void;
}

type Phase = "idle" | "work" | "mood-check" | "break" | "summary";
type SoundType = "rain" | "cafe" | "library" | "silence";

interface SessionRecord {
  date: string;
  pomodoros: number;
  moods: number[];
  duration: number;
}

interface FocusFlowData {
  sessions: SessionRecord[];
  settings: { work: number; break_: number; sound: SoundType };
}

interface TimerPreset {
  label: string;
  work: number;
  break_: number;
}

const focusFlowStore = createLocalStore<FocusFlowData>("mindmitra_focus_flow_v1", () => ({
  sessions: [],
  settings: { work: 25, break_: 5, sound: "silence" },
}));

const PRESETS: TimerPreset[] = [
  { label: "Classic", work: 25, break_: 5 },
  { label: "Quick", work: 15, break_: 3 },
  { label: "Deep", work: 45, break_: 10 },
];

const MOOD_EMOJIS = [
  { emoji: "😤", label: "Frustrated", value: 1 },
  { emoji: "😰", label: "Anxious", value: 2 },
  { emoji: "😑", label: "Neutral", value: 3 },
  { emoji: "🙂", label: "Good", value: 4 },
  { emoji: "😌", label: "Calm", value: 5 },
] as const;

const BREATHING_PROMPTS = [
  "Breathe in for 4 counts... hold for 4... out for 6...",
  "Close your eyes. Feel your feet on the ground. Take 3 slow breaths.",
  "Relax your shoulders. Unclench your jaw. Breathe naturally for 30 seconds.",
  "Inhale peace... exhale tension. Repeat 5 times.",
  "Place your hand on your chest. Feel it rise and fall with each breath.",
] as const;

const MICRO_EXERCISES = [
  { title: "30s Breath Reset", body: "Inhale for 4… hold for 2… exhale for 6. Repeat slowly." },
  { title: "Body Scan (30s)", body: "Relax your jaw. Drop your shoulders. Unclench your hands." },
  { title: "Name 3 Things", body: "Name 3 things you can see. 2 you can hear. 1 you can feel." },
  { title: "Thought Label", body: "If a thought appears, label it: “planning” / “worrying” / “judging”… then return to breath." },
] as const;

const SOUNDS: { id: SoundType; label: string; icon: string }[] = [
  { id: "rain", label: "Rain", icon: "🌧" },
  { id: "cafe", label: "Café", icon: "☕" },
  { id: "library", label: "Library", icon: "📚" },
  { id: "silence", label: "Silence", icon: "🔇" },
];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function createNoiseNode(
  ctx: AudioContext,
  type: SoundType
): { source: AudioBufferSourceNode; gain: GainNode } | null {
  if (type === "silence") return null;

  const bufferSize = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = "bandpass";

  const gain = ctx.createGain();
  gain.gain.value = 0.08;

  if (type === "rain") {
    bandpass.frequency.value = 800;
    bandpass.Q.value = 0.5;
    gain.gain.value = 0.06;
  } else if (type === "cafe") {
    bandpass.frequency.value = 1200;
    bandpass.Q.value = 0.3;
    gain.gain.value = 0.04;
  } else if (type === "library") {
    bandpass.frequency.value = 400;
    bandpass.Q.value = 0.8;
    gain.gain.value = 0.025;
  }

  source.connect(bandpass);
  bandpass.connect(gain);
  gain.connect(ctx.destination);

  return { source, gain };
}

export default function FocusFlow({ onAvatarCue }: FocusFlowProps) {
  const [data, setData] = useState<FocusFlowData>(focusFlowStore.read);
  const [phase, setPhase] = useState<Phase>("idle");
  const [workMin, setWorkMin] = useState(data.settings.work);
  const [breakMin, setBreakMin] = useState(data.settings.break_);
  const [customWork, setCustomWork] = useState("");
  const [customBreak, setCustomBreak] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [sound, setSound] = useState<SoundType>(data.settings.sound);
  const [timeLeft, setTimeLeft] = useState(workMin * 60);
  const [totalTime, setTotalTime] = useState(workMin * 60);
  const [running, setRunning] = useState(false);
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [sessionMoods, setSessionMoods] = useState<number[]>([]);
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [breakPrompt, setBreakPrompt] = useState("");
  const [muted, setMuted] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const noiseRef = useRef<{ source: AudioBufferSourceNode; gain: GainNode } | null>(null);

  const progress = totalTime > 0 ? (totalTime - timeLeft) / totalTime : 0;
  const circumference = 2 * Math.PI * 120;
  const dashOffset = circumference * (1 - progress);

  const startAudio = useCallback(
    (s: SoundType) => {
      stopAudio();
      if (s === "silence" || muted) return;
      try {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const node = createNoiseNode(ctx, s);
        if (node) {
          noiseRef.current = node;
          node.source.start();
        }
      } catch {
        /* Web Audio not supported */
      }
    },
    [muted]
  );

  const stopAudio = useCallback(() => {
    try {
      noiseRef.current?.source.stop();
    } catch {
      /* already stopped */
    }
    noiseRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopAudio();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [stopAudio]);

  useEffect(() => {
    if (muted && noiseRef.current) {
      noiseRef.current.gain.gain.value = 0;
    } else if (!muted && noiseRef.current) {
      noiseRef.current.gain.gain.value = 0.06;
    }
  }, [muted]);

  useEffect(() => {
    if (running && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, timeLeft]);

  useEffect(() => {
    if (timeLeft === 0 && running) {
      setRunning(false);
      if (phase === "work") {
        stopAudio();
        setPomodoroCount((c) => c + 1);
        setPhase("mood-check");
        onAvatarCue?.("Great focus session! How are you feeling?", "proud");
      } else if (phase === "break") {
        setPhase("idle");
        onAvatarCue?.("Break's over. Ready for another round?", "encouraging");
      }
    }
  }, [timeLeft, running, phase, stopAudio, onAvatarCue]);

  const startWork = useCallback(() => {
    const seconds = workMin * 60;
    setTimeLeft(seconds);
    setTotalTime(seconds);
    setPhase("work");
    setRunning(true);
    if (!sessionStart) setSessionStart(Date.now());
    startAudio(sound);
    onAvatarCue?.(`${workMin}-minute focus session started. You've got this!`, "encouraging");
  }, [workMin, sound, sessionStart, startAudio, onAvatarCue]);

  const handleMoodSelect = useCallback(
    (mood: number) => {
      setSessionMoods((prev) => [...prev, mood]);
      // Award XP per pomodoro (spec): 10 XP each time the user completes work + mood check.
      recordCompletion("focus-flow", 10);

      const micro =
        MICRO_EXERCISES[Math.floor(Math.random() * MICRO_EXERCISES.length)];
      setBreakPrompt(`${micro.title} — ${micro.body}`);
      const seconds = breakMin * 60;
      setTimeLeft(seconds);
      setTotalTime(seconds);
      setPhase("break");
      setRunning(true);
      onAvatarCue?.(
        "Take this break to recharge. Try the breathing exercise below.",
        "calm"
      );
    },
    [breakMin, onAvatarCue]
  );

  const finishSession = useCallback(() => {
    const session: SessionRecord = {
      date: new Date().toISOString(),
      pomodoros: pomodoroCount,
      moods: sessionMoods,
      duration: sessionStart ? Math.floor((Date.now() - sessionStart) / 1000) : 0,
    };

    const updated: FocusFlowData = {
      sessions: [...data.sessions, session],
      settings: { work: workMin, break_: breakMin, sound },
    };
    if (updated.sessions.length > 200)
      updated.sessions = updated.sessions.slice(-200);
    focusFlowStore.write(updated);
    setData(updated);
    setPhase("summary");
    // Completion screen is still useful as a wrap-up, but XP is awarded per pomodoro above.
    setCompleted(true);
    onAvatarCue?.(
      `Session complete! ${pomodoroCount} pomodoro${pomodoroCount !== 1 ? "s" : ""} done.`,
      "proud"
    );
  }, [pomodoroCount, sessionMoods, sessionStart, data, workMin, breakMin, sound, onAvatarCue]);

  const handleReset = useCallback(() => {
    setPhase("idle");
    setTimeLeft(workMin * 60);
    setTotalTime(workMin * 60);
    setRunning(false);
    setPomodoroCount(0);
    setSessionMoods([]);
    setSessionStart(null);
    setCompleted(false);
    stopAudio();
  }, [workMin, stopAudio]);

  const applyPreset = (preset: TimerPreset) => {
    setWorkMin(preset.work);
    setBreakMin(preset.break_);
    setTimeLeft(preset.work * 60);
    setTotalTime(preset.work * 60);
    setShowCustom(false);
  };

  const applyCustom = () => {
    const w = parseInt(customWork) || 25;
    const b = parseInt(customBreak) || 5;
    setWorkMin(Math.max(1, Math.min(120, w)));
    setBreakMin(Math.max(1, Math.min(30, b)));
    setTimeLeft(Math.max(1, Math.min(120, w)) * 60);
    setTotalTime(Math.max(1, Math.min(120, w)) * 60);
    setShowCustom(false);
  };

  const weeklyStats = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekStr = weekAgo.toISOString();

    const recent = data.sessions.filter((s) => s.date >= weekStr);
    const totalPomodoros = recent.reduce((a, s) => a + s.pomodoros, 0);
    const totalDuration = recent.reduce((a, s) => a + s.duration, 0);
    const allMoods = recent.flatMap((s) => s.moods);
    const avgMood =
      allMoods.length > 0
        ? allMoods.reduce((a, m) => a + m, 0) / allMoods.length
        : 0;

    return {
      totalPomodoros,
      totalHours: (totalDuration / 3600).toFixed(1),
      avgMood: avgMood.toFixed(1),
      sessionCount: recent.length,
    };
  }, [data.sessions]);

  const avgMoodLabel =
    parseFloat(weeklyStats.avgMood) >= 4
      ? "Great"
      : parseFloat(weeklyStats.avgMood) >= 3
      ? "Okay"
      : parseFloat(weeklyStats.avgMood) >= 2
      ? "Tense"
      : "—";

  const ringGradientId = "focusRingGrad";

  return (
    <ToolShell
      toolId="focus-flow"
      title="Focus Flow Timer"
      clinicalBasis="Time-boxing reduces anxiety about large tasks through behavioral activation. Structured breaks prevent burnout and maintain flow states. Mood check-ins build emotional awareness during cognitive work."
      xp={10}
      themeAccent="clay"
      surfaceTone="warm"
      backdropScene="mountain-video"
      completed={completed}
      onReset={handleReset}
      onAvatarCue={onAvatarCue}
    >
      <div className="max-w-2xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {/* ───── IDLE: Setup ───── */}
          {phase === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              {/* Timer ring preview */}
              <div className="flex justify-center mb-8">
                <div className="relative">
                  <svg width="260" height="260" viewBox="0 0 260 260">
                    <defs>
                      <linearGradient
                        id={ringGradientId}
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#E8B98A" />
                        <stop offset="100%" stopColor="#9CAF88" />
                      </linearGradient>
                    </defs>
                    <circle
                      cx="130"
                      cy="130"
                      r="120"
                      fill="none"
                      stroke="rgba(80,60,40,0.10)"
                      strokeWidth="6"
                    />
                    <circle
                      cx="130"
                      cy="130"
                      r="120"
                      fill="none"
                      stroke={`url(#${ringGradientId})`}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference}
                      transform="rotate(-90 130 130)"
                      opacity={0.3}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-serif-display text-4xl font-light text-[#2a1c14] tracking-tight tabular-nums">
                      {formatTime(workMin * 60)}
                    </span>
                    <span className="text-xs text-[#7a6556] mt-1">
                      {workMin}m work / {breakMin}m break
                    </span>
                  </div>
                </div>
              </div>

              {/* Presets */}
              <div className="flex gap-2 justify-center mb-4">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => applyPreset(preset)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                      workMin === preset.work && breakMin === preset.break_
                        ? "bg-[#9CAF88]/30 border border-[#3F6B47]/40 text-[#3F6B47]"
                        : "bg-white/70 border border-black/10 text-[#5b4a3e] hover:text-[#2a1c14] hover:bg-white/90"
                    )}
                  >
                    {preset.label}
                    <span className="text-xs opacity-60 ml-1">
                      {preset.work}/{preset.break_}
                    </span>
                  </button>
                ))}
                <button
                  onClick={() => setShowCustom(!showCustom)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                    showCustom
                      ? "bg-[#9CAF88]/30 border border-[#3F6B47]/40 text-[#3F6B47]"
                      : "bg-white/70 border border-black/10 text-[#5b4a3e] hover:text-[#2a1c14] hover:bg-white/90"
                  )}
                >
                  <Settings className="w-3.5 h-3.5 inline mr-1" />
                  Custom
                </button>
              </div>

              {/* Custom input */}
              <AnimatePresence>
                {showCustom && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mb-4"
                  >
                    <div className="flex gap-3 items-end justify-center p-4 rounded-xl bg-white/70 border border-black/10 backdrop-blur-sm">
                      <div>
                        <label className="text-[11px] text-[#7a6556] block mb-1">
                          Work (min)
                        </label>
                        <input
                          type="number"
                          value={customWork}
                          onChange={(e) => setCustomWork(e.target.value)}
                          placeholder="25"
                          className="w-20 px-3 py-2 rounded-lg bg-white/85 border border-black/10 text-[#2a1c14] text-sm text-center focus:outline-none focus:ring-1 focus:ring-[#3F6B47]/30"
                          min={1}
                          max={120}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-[#7a6556] block mb-1">
                          Break (min)
                        </label>
                        <input
                          type="number"
                          value={customBreak}
                          onChange={(e) => setCustomBreak(e.target.value)}
                          placeholder="5"
                          className="w-20 px-3 py-2 rounded-lg bg-white/85 border border-black/10 text-[#2a1c14] text-sm text-center focus:outline-none focus:ring-1 focus:ring-[#3F6B47]/30"
                          min={1}
                          max={30}
                        />
                      </div>
                      <button
                        onClick={applyCustom}
                        className="px-4 py-2 rounded-lg bg-[#3F6B47] hover:bg-[#345a3b] text-white text-sm transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Sound selector */}
              <div className="mb-6">
                <p className="text-xs text-[#7a6556] text-center mb-3">
                  Ambient Sound
                </p>
                <div className="flex gap-2 justify-center">
                  {SOUNDS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSound(s.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all",
                        sound === s.id
                          ? "bg-white/85 border border-black/15 text-[#2a1c14]"
                          : "bg-white/55 border border-black/8 text-[#7a6556] hover:text-[#3a2a20] hover:bg-white/75"
                      )}
                    >
                      <span className="text-base">{s.icon}</span>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Session info */}
              {pomodoroCount > 0 && (
                <div className="text-center mb-4">
                  <p className="text-sm text-[#5b4a3e]">
                    Pomodoros this session:{" "}
                    <span className="text-[#3F6B47] font-medium">
                      {pomodoroCount}
                    </span>
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 justify-center">
                <button
                  onClick={startWork}
                  className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-[#3F6B47] hover:bg-[#345a3b] text-white font-medium transition-colors shadow-[0_8px_24px_-12px_rgba(63,107,71,0.45)]"
                >
                  <Play className="w-5 h-5" />
                  {pomodoroCount > 0 ? "Next Pomodoro" : "Start Focusing"}
                </button>
                {pomodoroCount > 0 && (
                  <button
                    onClick={finishSession}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl border border-black/10 text-[#5b4a3e] hover:text-[#2a1c14] hover:bg-white/70 transition-all"
                  >
                    End Session
                  </button>
                )}
              </div>

              {/* Bottom actions */}
              <div className="flex justify-center gap-4 mt-8">
                <button
                  onClick={() => setShowStats(!showStats)}
                  className="flex items-center gap-1.5 text-xs text-[#7a6556] hover:text-[#3a2a20] transition-colors"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  Weekly Stats
                </button>
                <div className="flex items-center gap-1.5 text-xs text-[#9a8674] cursor-not-allowed">
                  <Users className="w-3.5 h-3.5" />
                  Study with a Stranger
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/55 text-[#9a8674]">
                    Coming soon
                  </span>
                </div>
              </div>

              {/* Weekly stats panel */}
              <AnimatePresence>
                {showStats && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mt-6"
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        {
                          label: "Focus Hours",
                          value: weeklyStats.totalHours,
                          sub: "this week",
                        },
                        {
                          label: "Pomodoros",
                          value: weeklyStats.totalPomodoros,
                          sub: "this week",
                        },
                        {
                          label: "Sessions",
                          value: weeklyStats.sessionCount,
                          sub: "this week",
                        },
                        {
                          label: "Avg Mood",
                          value: avgMoodLabel,
                          sub:
                            weeklyStats.avgMood !== "0.0"
                              ? `${weeklyStats.avgMood}/5`
                              : "no data",
                        },
                      ].map((stat) => (
                        <div
                          key={stat.label}
                          className="p-3 rounded-xl bg-white/70 border border-black/8 text-center backdrop-blur-sm"
                        >
                          <p className="text-lg font-semibold text-[#2a1c14]">
                            {stat.value}
                          </p>
                          <p className="text-[11px] text-[#7a6556]">{stat.label}</p>
                          <p className="text-[10px] text-[#9a8674]">{stat.sub}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ───── WORK / BREAK: Timer ───── */}
          {(phase === "work" || phase === "break") && (
            <motion.div
              key={phase}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="text-center"
            >
              <p className="text-xs uppercase tracking-[0.28em] mb-6">
                {phase === "work" ? (
                  <span className="text-[#3F6B47]">Focusing</span>
                ) : (
                  <span className="text-[#3a4a6b]">Break Time</span>
                )}
                {pomodoroCount > 0 && (
                  <span className="text-[#9a8674] ml-2">
                    #{pomodoroCount + (phase === "work" ? 1 : 0)}
                  </span>
                )}
              </p>

              {/* Timer ring */}
              <div className="relative inline-block mb-6">
                <svg width="280" height="280" viewBox="0 0 280 280">
                  <defs>
                    <linearGradient
                      id="activeRingGrad"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      {phase === "work" ? (
                        <>
                          <stop offset="0%" stopColor="#E8B98A" />
                          <stop offset="50%" stopColor="#9CAF88" />
                          <stop offset="100%" stopColor="#3F6B47" />
                        </>
                      ) : (
                        <>
                          <stop offset="0%" stopColor="#8FA0C2" />
                          <stop offset="100%" stopColor="#B8A6D9" />
                        </>
                      )}
                    </linearGradient>
                  </defs>

                  {/* Background track */}
                  <circle
                    cx="140"
                    cy="140"
                    r="120"
                    fill="none"
                    stroke="rgba(80,60,40,0.10)"
                    strokeWidth="8"
                  />

                  {/* Progress ring */}
                  <motion.circle
                    cx="140"
                    cy="140"
                    r="120"
                    fill="none"
                    stroke="url(#activeRingGrad)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    transform="rotate(-90 140 140)"
                    animate={{ strokeDashoffset: dashOffset }}
                    transition={{ duration: 0.5, ease: "linear" }}
                  />

                  {/* Glow dot at progress head */}
                  {progress > 0 && progress < 1 && (
                    <motion.circle
                      cx={
                        140 +
                        120 * Math.cos(2 * Math.PI * progress - Math.PI / 2)
                      }
                      cy={
                        140 +
                        120 * Math.sin(2 * Math.PI * progress - Math.PI / 2)
                      }
                      r="4"
                      fill="#3F6B47"
                      animate={{
                        opacity: [0.6, 1, 0.6],
                        r: [3, 5, 3],
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span
                    className="font-serif-display text-5xl font-light text-[#2a1c14] tracking-tight tabular-nums"
                    key={timeLeft}
                    initial={{ opacity: 0.8 }}
                    animate={{ opacity: 1 }}
                  >
                    {formatTime(timeLeft)}
                  </motion.span>
                  <span className="text-xs text-[#7a6556] mt-2">
                    {phase === "work" ? "focus time" : "break"}
                  </span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4 mb-6">
                <button
                  onClick={() => setRunning(!running)}
                  className={cn(
                    "w-14 h-14 rounded-full flex items-center justify-center transition-all",
                    running
                      ? "bg-white/85 hover:bg-white border border-black/10 text-[#2a1c14]"
                      : "bg-[#3F6B47] hover:bg-[#345a3b] text-white shadow-[0_8px_22px_-12px_rgba(63,107,71,0.45)]"
                  )}
                >
                  {running ? (
                    <Pause className="w-6 h-6" />
                  ) : (
                    <Play className="w-6 h-6 ml-0.5" />
                  )}
                </button>

                {phase === "work" && (
                  <button
                    onClick={() => {
                      setRunning(false);
                      setTimeLeft(0);
                    }}
                    className="w-10 h-10 rounded-full bg-white/70 hover:bg-white/90 border border-black/8 flex items-center justify-center text-[#7a6556] hover:text-[#2a1c14] transition-all"
                    title="Skip to mood check"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={() => setMuted(!muted)}
                  className="w-10 h-10 rounded-full bg-white/70 hover:bg-white/90 border border-black/8 flex items-center justify-center text-[#7a6556] hover:text-[#2a1c14] transition-all"
                >
                  {muted ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>

                <button
                  onClick={handleReset}
                  className="w-10 h-10 rounded-full bg-white/70 hover:bg-white/90 border border-black/8 flex items-center justify-center text-[#7a6556] hover:text-[#2a1c14] transition-all"
                  title="Reset"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Break breathing prompt */}
              {phase === "break" && breakPrompt && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-sm mx-auto p-4 rounded-2xl bg-[#8FA0C2]/22 border border-[#8FA0C2]/45 backdrop-blur-sm"
                >
                  <p className="text-xs text-[#3a4a6b] uppercase tracking-[0.22em] mb-1">
                    Breathing Exercise
                  </p>
                  <p className="text-sm text-[#2a1c14]/90 leading-relaxed">
                    {breakPrompt}
                  </p>
                </motion.div>
              )}

              {/* Sound indicator */}
              {sound !== "silence" && phase === "work" && (
                <p className="text-[11px] text-[#9a8674] mt-4">
                  {SOUNDS.find((s) => s.id === sound)?.icon}{" "}
                  {SOUNDS.find((s) => s.id === sound)?.label} ambience playing
                  {muted && " (muted)"}
                </p>
              )}
            </motion.div>
          )}

          {/* ───── MOOD CHECK ───── */}
          {phase === "mood-check" && (
            <motion.div
              key="mood-check"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="text-center py-8"
            >
              <motion.div
                className="w-16 h-16 rounded-full bg-[#9CAF88]/35 flex items-center justify-center mx-auto mb-4 border border-[#3F6B47]/25"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 12 }}
              >
                <Clock className="w-8 h-8 text-[#3F6B47]" />
              </motion.div>
              <h3 className="font-serif-display italic text-[1.6rem] font-light text-[#2a1c14] mb-2">
                Pomodoro #{pomodoroCount} complete!
              </h3>
              <p className="text-[#5b4a3e] text-sm mb-8">
                How are you feeling right now?
              </p>

              <div className="flex justify-center gap-3">
                {MOOD_EMOJIS.map((mood, i) => (
                  <motion.button
                    key={mood.value}
                    onClick={() => handleMoodSelect(mood.value)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white/70 border border-black/10 hover:bg-white/90 hover:border-black/15 transition-all min-w-[64px] backdrop-blur-sm"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span className="text-2xl">{mood.emoji}</span>
                    <span className="text-[10px] text-[#7a6556]">
                      {mood.label}
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ───── SUMMARY ───── */}
          {phase === "summary" && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="py-8"
            >
              <div className="text-center mb-8">
                <h3 className="font-serif-display italic text-[1.8rem] font-light text-[#2a1c14] mb-2">
                  Session Summary
                </h3>
                <p className="text-[#5b4a3e] text-sm">
                  Great work staying focused today!
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-8">
                <div className="p-4 rounded-2xl bg-[#9CAF88]/22 border border-[#3F6B47]/25 text-center backdrop-blur-sm">
                  <p className="text-2xl font-bold text-[#3F6B47]">
                    {pomodoroCount}
                  </p>
                  <p className="text-xs text-[#5b4a3e] mt-1">Pomodoros</p>
                </div>
                <div className="p-4 rounded-2xl bg-[#B8A6D9]/22 border border-[#5b4a82]/25 text-center backdrop-blur-sm">
                  <p className="text-2xl font-bold text-[#5b4a82]">
                    {pomodoroCount * 10}
                  </p>
                  <p className="text-xs text-[#5b4a3e] mt-1">XP Earned</p>
                </div>
                <div className="p-4 rounded-2xl bg-[#8FA0C2]/22 border border-[#3a4a6b]/25 text-center backdrop-blur-sm">
                  <p className="text-2xl font-bold text-[#3a4a6b]">
                    {sessionStart
                      ? Math.round((Date.now() - sessionStart) / 60000)
                      : 0}
                    m
                  </p>
                  <p className="text-xs text-[#5b4a3e] mt-1">Total Time</p>
                </div>
              </div>

              {/* Mood arc */}
              {sessionMoods.length > 0 && (
                <div className="mb-8">
                  <p className="text-xs text-[#7a6556] mb-3">
                    Mood across check-ins
                  </p>
                  <div className="flex items-end gap-2 justify-center h-16">
                    {sessionMoods.map((mood, i) => (
                      <motion.div
                        key={i}
                        className="flex flex-col items-center gap-1"
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ delay: i * 0.1 }}
                        style={{ originY: 1 }}
                      >
                        <span className="text-lg">
                          {MOOD_EMOJIS.find((m) => m.value === mood)?.emoji}
                        </span>
                        <div
                          className={cn(
                            "w-8 rounded-t-md",
                            mood >= 4
                              ? "bg-[#3F6B47]/55"
                              : mood >= 3
                              ? "bg-[#E8C97A]/70"
                              : "bg-[#C7775F]/55"
                          )}
                          style={{ height: `${(mood / 5) * 40}px` }}
                        />
                        <span className="text-[10px] text-[#9a8674]">
                          #{i + 1}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleReset}
                className="w-full py-3 rounded-2xl bg-white/70 border border-black/10 text-[#5b4a3e] hover:text-[#2a1c14] hover:bg-white/90 transition-all text-sm backdrop-blur-sm"
              >
                <RotateCcw className="w-4 h-4 inline mr-2" />
                Start New Session
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToolShell>
  );
}
