import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Eye, Ear, Hand, Wind, Cherry, Check, Mic, MicOff } from "lucide-react";
import ToolShell from "@/components/mindgym/ToolShell";
import { CRISIS_KEYWORDS } from "@/lib/mindgym/types";
import { trackMindGymEvent } from "@/lib/mindgym/analytics";
import { cn } from "@/lib/utils";

interface FiveSensesProps {
  onAvatarCue?: (text: string, emotion: string) => void;
}

interface SenseStep {
  sense: string;
  icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
  count: number;
  prompt: string;
  color: string;
  cue: string;
}

const STEPS: SenseStep[] = [
  {
    sense: "See",
    icon: Eye,
    count: 5,
    prompt: "Name 5 things you can see right now",
    color: "#6366f1",
    cue: "Look around slowly. Notice shapes, colors, textures around you.",
  },
  {
    sense: "Hear",
    icon: Ear,
    count: 4,
    prompt: "Name 4 things you can hear",
    color: "#8b5cf6",
    cue: "Close your eyes for a moment. What sounds reach you?",
  },
  {
    sense: "Touch",
    icon: Hand,
    count: 3,
    prompt: "Name 3 things you can feel right now",
    color: "#14b8a6",
    cue: "Notice the surfaces touching your body. The air on your skin.",
  },
  {
    sense: "Smell",
    icon: Wind,
    count: 2,
    prompt: "Name 2 things you can smell",
    color: "#f59e0b",
    cue: "Breathe in gently. What scents are nearby?",
  },
  {
    sense: "Taste",
    icon: Cherry,
    count: 1,
    prompt: "Name 1 thing you can taste",
    color: "#ef4444",
    cue: "Notice your mouth. Any flavor lingering?",
  },
];

function containsCrisis(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
}

/* Gentle particle field — dots that settle as progress increases */
function ParticleField({ progress }: { progress: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 1 + Math.random() * 2.5,
        duration: 4 + Math.random() * 6,
        delay: Math.random() * 5,
      })),
    [],
  );

  const chaos = 1 - progress;

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
            background: `rgba(255, 255, 255, ${0.05 + progress * 0.08})`,
          }}
          animate={{
            x: [0, chaos * (30 - Math.random() * 60), 0],
            y: [0, chaos * (30 - Math.random() * 60), 0],
            opacity: [0.15 + progress * 0.2, 0.4 + progress * 0.3, 0.15 + progress * 0.2],
          }}
          transition={{
            duration: p.duration + progress * 4,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/* Breathing circle for the final screen */
function BreathingPrompt() {
  const controls = useAnimation();

  useEffect(() => {
    const loop = async () => {
      while (true) {
        await controls.start({
          scale: 1.3,
          transition: { duration: 4, ease: "easeInOut" },
        });
        await controls.start({
          scale: 1,
          transition: { duration: 4, ease: "easeInOut" },
        });
      }
    };
    loop();
  }, [controls]);

  return (
    <div className="flex flex-col items-center gap-4">
      <motion.div
        animate={controls}
        className="w-28 h-28 rounded-full flex items-center justify-center"
        style={{
          background:
            "radial-gradient(circle, rgba(20,184,166,0.25), rgba(20,184,166,0.05) 70%)",
          boxShadow: "0 0 60px rgba(20,184,166,0.15)",
        }}
      >
        <motion.div
          animate={controls}
          className="w-16 h-16 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(20,184,166,0.5), rgba(20,184,166,0.15))",
          }}
        />
      </motion.div>
      <motion.p
        className="text-xs text-white/30"
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 8, repeat: Infinity }}
      >
        Breathe gently
      </motion.p>
    </div>
  );
}

export default function FiveSenses({ onAvatarCue }: FiveSensesProps) {
  const [step, setStep] = useState(0);
  const [items, setItems] = useState<string[][]>([[], [], [], [], []]);
  const [inputVal, setInputVal] = useState("");
  const [completed, setCompleted] = useState(false);
  const [showFinal, setShowFinal] = useState(false);
  const [crisisWarning, setCrisisWarning] = useState(false);
  const [micState, setMicState] = useState<"off" | "pending" | "on" | "denied">("off");
  const [micLevel, setMicLevel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const currentStepData = STEPS[step] as SenseStep | undefined;
  const currentItems = items[step] || [];
  const remaining = currentStepData
    ? currentStepData.count - currentItems.length
    : 0;
  const progress = useMemo(() => {
    const total = STEPS.reduce((s, st) => s + st.count, 0);
    const done = items.reduce((s, arr) => s + arr.length, 0);
    return done / total;
  }, [items]);

  const bgColor = useMemo(() => {
    const r = Math.round(15 + progress * 5);
    const g = Math.round(13 + progress * 15);
    const b = Math.round(19 + progress * 10);
    return `rgb(${r}, ${g}, ${b})`;
  }, [progress]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      analyserRef.current = null;
    };
  }, []);

  const startMic = useCallback(async () => {
    if (micState === "on" || micState === "pending") return;
    setMicState("pending");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyserRef.current = analyser;
      src.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        const a = analyserRef.current;
        if (!a) return;
        a.getByteTimeDomainData(data);
        // normalize RMS-ish
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        setMicLevel(Math.min(1, rms * 3.5));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      setMicState("on");
    } catch {
      setMicState("denied");
    }
  }, [micState]);

  const handleAdd = useCallback(() => {
    if (!inputVal.trim() || !currentStepData) return;
    if (containsCrisis(inputVal)) {
      trackMindGymEvent("crisis_triggered", { toolId: "five-senses" });
      setCrisisWarning(true);
      return;
    }

    const trimmed = inputVal.trim();
    const newItems = [...items];
    newItems[step] = [...(newItems[step] || []), trimmed];
    setItems(newItems);
    setInputVal("");
    setCrisisWarning(false);

    if (newItems[step].length >= currentStepData.count) {
      if (step < STEPS.length - 1) {
        setTimeout(() => {
          setStep(step + 1);
          onAvatarCue?.(STEPS[step + 1].cue, "calm");
        }, 600);
      } else {
        setShowFinal(true);
        onAvatarCue?.("You are here. You are safe. Well done.", "proud");
        setTimeout(() => setCompleted(true), 5000);
      }
    }
  }, [inputVal, items, step, currentStepData, onAvatarCue]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAdd();
      }
    },
    [handleAdd],
  );

  const handleReset = useCallback(() => {
    setStep(0);
    setItems([[], [], [], [], []]);
    setInputVal("");
    setCompleted(false);
    setShowFinal(false);
    setCrisisWarning(false);
  }, []);

  return (
    <ToolShell
      toolId="five-senses"
      title="5-4-3-2-1 Anchor"
      clinicalBasis="A DBT-based grounding technique used for panic attacks and dissociation. Engaging all five senses brings your nervous system back to the present moment."
      xp={25}
      completed={completed}
      onReset={handleReset}
      totalSteps={5}
      currentStep={step}
      themeColor="from-[#0c1815] via-[#1a3831] to-[#111f1b]"
    >
      <div
        className="min-h-[80vh] relative transition-colors duration-1000"
        style={{ backgroundColor: bgColor }}
      >
        <ParticleField progress={progress} />

        <div className="relative z-10 max-w-lg mx-auto px-4 pt-8 pb-24">
          <AnimatePresence mode="wait">
            {showFinal ? (
              /* ─── FINAL SCREEN ─── */
              <motion.div
                key="final"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.5 }}
                className="flex flex-col items-center justify-center min-h-[60vh] space-y-8"
              >
                <motion.h2
                  className="text-2xl font-semibold text-white/90 text-center leading-relaxed"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 1 }}
                >
                  You are here.
                  <br />
                  <span className="text-teal-400">You are safe.</span>
                </motion.h2>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.5, duration: 1 }}
                >
                  <BreathingPrompt />
                </motion.div>

                {/* All collected items */}
                <motion.div
                  className="w-full space-y-4 pt-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 2.5, duration: 1 }}
                >
                  {STEPS.map((s, si) => (
                    <div key={s.sense} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <s.icon
                          className="w-3.5 h-3.5"
                          style={{ color: s.color }}
                        />
                        <span
                          className="text-xs font-medium uppercase tracking-wider"
                          style={{ color: `${s.color}99` }}
                        >
                          {s.sense}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(items[si] || []).map((item, ii) => (
                          <motion.span
                            key={ii}
                            className="px-3 py-1 rounded-full text-xs border"
                            style={{
                              borderColor: `${s.color}30`,
                              background: `${s.color}10`,
                              color: `${s.color}cc`,
                            }}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 2.5 + si * 0.2 + ii * 0.1 }}
                          >
                            {item}
                          </motion.span>
                        ))}
                      </div>
                    </div>
                  ))}
                </motion.div>
              </motion.div>
            ) : currentStepData ? (
              /* ─── SENSE STEP ─── */
              <motion.div
                key={`step-${step}`}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.5 }}
                className="space-y-8"
              >
                {/* Step header */}
                <div className="text-center space-y-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.2 }}
                    className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                    style={{
                      background: `radial-gradient(circle, ${currentStepData.color}30, ${currentStepData.color}08)`,
                      boxShadow: `0 0 40px ${currentStepData.color}15`,
                    }}
                  >
                    <currentStepData.icon
                      className="w-7 h-7"
                      style={{ color: currentStepData.color }}
                    />
                  </motion.div>

                  <div>
                    <motion.p
                      className="text-xs uppercase tracking-widest mb-2"
                      style={{ color: `${currentStepData.color}80` }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      {currentStepData.sense}
                    </motion.p>
                    <motion.h2
                      className="text-xl font-semibold text-white/90"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      {currentStepData.prompt}
                    </motion.h2>
                  </div>

                  <motion.p
                    className="text-sm text-white/35 italic"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                  >
                    {currentStepData.cue}
                  </motion.p>

                {/* Optional mic-reactive visualization for HEAR step (spec) */}
                {currentStepData.sense === "Hear" && (
                  <div className="mt-2 flex items-center justify-center gap-3">
                    <button
                      onClick={startMic}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-full text-xs border transition-colors",
                        micState === "on"
                          ? "bg-teal-500/15 border-teal-500/25 text-teal-200"
                          : micState === "denied"
                          ? "bg-rose-500/10 border-rose-500/25 text-rose-200"
                          : "bg-white/5 border-white/10 text-white/60 hover:text-white/80",
                      )}
                    >
                      {micState === "on" ? (
                        <Mic className="w-3.5 h-3.5" />
                      ) : (
                        <MicOff className="w-3.5 h-3.5" />
                      )}
                      {micState === "on"
                        ? "Mic on"
                        : micState === "pending"
                        ? "Requesting…"
                        : micState === "denied"
                        ? "Mic blocked"
                        : "Enable mic (optional)"}
                    </button>

                    <div className="flex items-end gap-1 h-8">
                      {Array.from({ length: 8 }, (_, i) => {
                        const h = 6 + Math.round((micLevel * 24) * (0.5 + (i / 16)));
                        return (
                          <motion.div
                            key={i}
                            className="w-1.5 rounded-full"
                            style={{
                              height: h,
                              background: `rgba(255,255,255,${0.08 + micLevel * 0.35})`,
                            }}
                            animate={{ height: h }}
                            transition={{ duration: 0.12, ease: "linear" }}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
                </div>

                {/* Floating tags */}
                <div className="min-h-[120px] flex flex-wrap gap-2 justify-center items-start">
                  <AnimatePresence>
                    {currentItems.map((item, i) => (
                      <motion.div
                        key={`${step}-${i}`}
                        initial={{
                          opacity: 0,
                          scale: 0.5,
                          y: 20,
                          rotate: -5 + Math.random() * 10,
                        }}
                        animate={{
                          opacity: 1,
                          scale: 1,
                          y: [0, -4 - Math.random() * 8, 0],
                          rotate: [-2 + Math.random() * 4, 2 - Math.random() * 4],
                        }}
                        transition={{
                          opacity: { duration: 0.3 },
                          scale: { duration: 0.4, type: "spring" },
                          y: {
                            duration: 3 + Math.random() * 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                          },
                          rotate: {
                            duration: 4 + Math.random() * 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                          },
                        }}
                        className="px-4 py-2 rounded-2xl text-sm font-medium border backdrop-blur-sm"
                        style={{
                          borderColor: `${currentStepData.color}35`,
                          background: `${currentStepData.color}12`,
                          color: `${currentStepData.color}dd`,
                          boxShadow: `0 4px 20px ${currentStepData.color}08`,
                        }}
                      >
                        {item}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Input area */}
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputVal}
                      onChange={(e) => {
                        setInputVal(e.target.value);
                        setCrisisWarning(false);
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder={`Type and press Enter (${remaining} remaining)`}
                      maxLength={60}
                      className={cn(
                        "w-full bg-white/[0.04] border rounded-2xl px-5 py-4 text-sm text-white placeholder-white/25 focus:outline-none transition-colors",
                        crisisWarning
                          ? "border-rose-500/40 focus:border-rose-500/60"
                          : "border-white/10 focus:border-teal-500/40",
                      )}
                    />
                    {inputVal.trim() && (
                      <motion.button
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        onClick={handleAdd}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                        style={{
                          background: `${currentStepData.color}25`,
                          color: currentStepData.color,
                        }}
                      >
                        <Check className="w-4 h-4" />
                      </motion.button>
                    )}
                  </div>

                  {crisisWarning && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-rose-400 text-xs text-center"
                    >
                      If you're in distress, please use the "Need help?" button
                      below.
                    </motion.p>
                  )}

                  {/* Progress dots */}
                  <div className="flex justify-center gap-2">
                    {Array.from({ length: currentStepData.count }).map(
                      (_, i) => (
                        <motion.div
                          key={i}
                          className="w-2 h-2 rounded-full"
                          animate={{
                            scale: i < currentItems.length ? 1 : 0.6,
                            backgroundColor:
                              i < currentItems.length
                                ? currentStepData.color
                                : "rgba(255,255,255,0.1)",
                          }}
                          transition={{ type: "spring", stiffness: 300 }}
                        />
                      ),
                    )}
                  </div>
                </div>

                {/* Overall step indicator */}
                <div className="flex justify-center gap-3 pt-4">
                  {STEPS.map((s, i) => {
                    const Icon = s.icon;
                    const isDone = i < step;
                    const isCurrent = i === step;
                    return (
                      <motion.div
                        key={i}
                        className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center border transition-colors",
                          isDone
                            ? "border-teal-500/40 bg-teal-500/15"
                            : isCurrent
                              ? "border-white/20 bg-white/[0.06]"
                              : "border-white/5 bg-white/[0.02]",
                        )}
                        animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      >
                        {isDone ? (
                          <Check
                            className="w-3.5 h-3.5 text-teal-400"
                          />
                        ) : (
                          <Icon
                            className="w-3.5 h-3.5"
                            style={{
                              color: isCurrent
                                ? s.color
                                : "rgba(255,255,255,0.15)",
                            }}
                          />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </ToolShell>
  );
}
