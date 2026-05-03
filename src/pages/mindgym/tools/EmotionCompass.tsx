import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Wind,
  BookOpen,
  Heart,
  Zap,
} from "lucide-react";
import ToolShell from "@/components/mindgym/ToolShell";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface EmotionCompassProps {
  onAvatarCue?: (text: string, emotion: string) => void;
}

interface EmotionData {
  name: string;
  hindi: string;
  color: string;
  hue: number;
  levels: [string, string, string];
}

const EMOTIONS: EmotionData[] = [
  {
    name: "Joy",
    hindi: "खुशी",
    color: "#FFD700",
    hue: 45,
    levels: ["Serenity", "Joy", "Ecstasy"],
  },
  {
    name: "Trust",
    hindi: "भरोसा",
    color: "#7BC67E",
    hue: 125,
    levels: ["Acceptance", "Trust", "Admiration"],
  },
  {
    name: "Fear",
    hindi: "डर",
    color: "#4CAF50",
    hue: 145,
    levels: ["Apprehension", "Fear", "Terror"],
  },
  {
    name: "Surprise",
    hindi: "हैरानी",
    color: "#29B6F6",
    hue: 200,
    levels: ["Distraction", "Surprise", "Amazement"],
  },
  {
    name: "Sadness",
    hindi: "उदासी",
    color: "#5C6BC0",
    hue: 235,
    levels: ["Pensiveness", "Sadness", "Grief"],
  },
  {
    name: "Disgust",
    hindi: "नफ़रत",
    color: "#AB47BC",
    hue: 285,
    levels: ["Boredom", "Disgust", "Loathing"],
  },
  {
    name: "Anger",
    hindi: "गुस्सा",
    color: "#EF5350",
    hue: 0,
    levels: ["Annoyance", "Anger", "Rage"],
  },
  {
    name: "Anticipation",
    hindi: "उम्मीद",
    color: "#FF9800",
    hue: 30,
    levels: ["Interest", "Anticipation", "Vigilance"],
  },
];

interface MicroAction {
  icon: typeof Wind;
  label: string;
  description: string;
}

function getSuggestions(
  emotionName: string,
  intensity: number,
): MicroAction[] {
  const high = intensity >= 7;
  const mid = intensity >= 4 && intensity < 7;

  const map: Record<string, MicroAction[]> = {
    Joy: [
      {
        icon: BookOpen,
        label: "Gratitude Snapshot",
        description: "Write down 3 things that contributed to this feeling",
      },
      {
        icon: Heart,
        label: "Share the Joy",
        description: "Send a kind message to someone who matters",
      },
      ...(high
        ? [
            {
              icon: Zap,
              label: "Anchor this Moment",
              description: "Close your eyes and memorize this feeling for tough days",
            },
          ]
        : []),
    ],
    Trust: [
      {
        icon: BookOpen,
        label: "Reflect",
        description: "Journal about what made you feel safe today",
      },
      {
        icon: Heart,
        label: "Strengthen Bonds",
        description: "Reach out to someone you trust with a genuine thank you",
      },
    ],
    Fear: [
      {
        icon: Wind,
        label: "Try Breath Sphere",
        description: high
          ? "Your body needs calm — 4-7-8 breathing can help right now"
          : "A few box breathing cycles can ease the tension",
      },
      {
        icon: BookOpen,
        label: "Name the Fear",
        description: "Write down what exactly you're afraid of — specificity reduces power",
      },
      ...(high
        ? [
            {
              icon: Zap,
              label: "Ground Yourself",
              description: "5-4-3-2-1: Name 5 things you see, 4 you hear, 3 you touch...",
            },
          ]
        : []),
    ],
    Surprise: [
      {
        icon: BookOpen,
        label: "Process It",
        description: "Write what surprised you and how you're interpreting it",
      },
      {
        icon: Wind,
        label: "Pause & Breathe",
        description: "Give your mind a moment to catch up with events",
      },
    ],
    Sadness: [
      {
        icon: Wind,
        label: "Gentle Breathing",
        description: high
          ? "Try a Physiological Sigh — your body knows how to self-soothe"
          : "A slow breathing session can create some space",
      },
      {
        icon: BookOpen,
        label: "Write in Worry Vault",
        description: "Put your worries somewhere safe — get them out of your head",
      },
      ...(high
        ? [
            {
              icon: Heart,
              label: "Talk to Someone",
              description: "You don't have to carry this alone. Reach out to a friend or counselor",
            },
          ]
        : []),
    ],
    Disgust: [
      {
        icon: BookOpen,
        label: "Examine the Source",
        description: "What boundary was crossed? Understanding helps you respond wisely",
      },
      {
        icon: Wind,
        label: "Reset with Breath",
        description: "A few cycles of box breathing can clear the heaviness",
      },
    ],
    Anger: [
      {
        icon: Wind,
        label: "Cool Down Breathing",
        description: high
          ? "Before anything else: 4-7-8 breathing, 3 cycles minimum"
          : "Try box breathing to create space between stimulus and response",
      },
      {
        icon: BookOpen,
        label: "Use Thought Trap",
        description: "Check if a thinking trap is making this feel bigger than it is",
      },
      ...(mid || high
        ? [
            {
              icon: Zap,
              label: "Physical Release",
              description: "Walk, stretch, or do 10 pushups — move the energy through your body",
            },
          ]
        : []),
    ],
    Anticipation: [
      {
        icon: BookOpen,
        label: "Plan & Prepare",
        description: "Channel this energy — write one concrete next step",
      },
      {
        icon: Wind,
        label: "Stay Present",
        description: "A short breathing session can help you stay grounded in now",
      },
    ],
  };

  return map[emotionName] || [
    {
      icon: Wind,
      label: "Breathe",
      description: "Take a moment with the Breath Sphere",
    },
  ];
}

interface EmotionLogEntry {
  emotion: string;
  level: string;
  intensity: number;
  trigger: string;
  date: string;
}

const LOG_KEY = "mindmitra_emotion_log_v1";

function saveEmotionLog(entry: EmotionLogEntry) {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const log: EmotionLogEntry[] = raw ? JSON.parse(raw) : [];
    log.push(entry);
    if (log.length > 300) log.splice(0, log.length - 300);
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch {
    /* storage full */
  }
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
) {
  const innerStart = polarToCartesian(cx, cy, innerR, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, startAngle);
  const outerStart = polarToCartesian(cx, cy, outerR, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
    "Z",
  ].join(" ");
}

export default function EmotionCompass({ onAvatarCue }: EmotionCompassProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState(false);

  const [selectedEmotion, setSelectedEmotion] = useState<number | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [intensity, setIntensity] = useState(5);
  const [trigger, setTrigger] = useState("");
  const [ripple, setRipple] = useState<{
    x: number;
    y: number;
    key: number;
  } | null>(null);

  const cx = 180;
  const cy = 180;
  const gap = 1.2;
  const sliceAngle = 360 / 8;

  const rings = useMemo(
    () => [
      { innerR: 50, outerR: 90 },
      { innerR: 92, outerR: 130 },
      { innerR: 132, outerR: 168 },
    ],
    [],
  );

  const handleSegmentClick = useCallback(
    (emotionIdx: number, levelIdx: number, event: React.MouseEvent<SVGPathElement>) => {
      setSelectedEmotion(emotionIdx);
      setSelectedLevel(levelIdx);

      const svg = event.currentTarget.closest("svg");
      if (svg) {
        const rect = svg.getBoundingClientRect();
        setRipple({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          key: Date.now(),
        });
      }

      const emotion = EMOTIONS[emotionIdx];
      onAvatarCue?.(
        `${emotion.levels[levelIdx]}... I see. Let's explore that.`,
        emotion.name.toLowerCase(),
      );
    },
    [onAvatarCue],
  );

  const handleNext = () => {
    if (step === 0 && selectedEmotion !== null && selectedLevel !== null) {
      setStep(1);
    } else if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      const emotion = EMOTIONS[selectedEmotion!];
      saveEmotionLog({
        emotion: emotion.name,
        level: emotion.levels[selectedLevel!],
        intensity,
        trigger: trigger.trim(),
        date: new Date().toISOString(),
      });
      setStep(3);
      onAvatarCue?.(
        "Here are some things that might help right now.",
        "supportive",
      );
    }
  };

  const handleComplete = () => setCompleted(true);

  const handleReset = () => {
    setStep(0);
    setCompleted(false);
    setSelectedEmotion(null);
    setSelectedLevel(null);
    setIntensity(5);
    setTrigger("");
    setRipple(null);
  };

  const currentEmotion =
    selectedEmotion !== null ? EMOTIONS[selectedEmotion] : null;
  const currentLevel =
    selectedEmotion !== null && selectedLevel !== null
      ? EMOTIONS[selectedEmotion].levels[selectedLevel]
      : null;

  return (
    <ToolShell
      toolId="emotion-compass"
      title="Emotion Compass"
      clinicalBasis="Based on Robert Plutchik's Wheel of Emotions. Research shows that emotional granularity — the ability to precisely name what you feel — reduces amygdala reactivity and improves emotional regulation. Naming it to tame it."
      xp={15}
      completed={completed}
      onReset={handleReset}
      totalSteps={4}
      currentStep={step}
      themeAccent="sky"
      surfaceTone="warm"
      backdropScene="window"
    >
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
        <AnimatePresence mode="wait">
          {/* Step 0: Select emotion from wheel */}
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-4">
                <h2 className="font-serif-display italic text-[1.85rem] font-light text-[#2a1c14] mb-2 leading-tight">
                  What are you feeling?
                </h2>
                <p className="text-sm text-[#5b4a3e]">
                  Tap the emotion that resonates most. Inner ring = mild, outer
                  = intense.
                </p>
              </div>

              <div className="flex justify-center">
                <div className="relative">
                  <svg
                    width={cx * 2}
                    height={cy * 2}
                    viewBox={`0 0 ${cx * 2} ${cy * 2}`}
                    className="drop-shadow-lg"
                  >
                    {/* Ripple effect */}
                    {ripple && (
                      <motion.circle
                        key={ripple.key}
                        cx={ripple.x}
                        cy={ripple.y}
                        r={0}
                        fill="none"
                        stroke="rgba(80,60,40,0.45)"
                        strokeWidth={2}
                        initial={{ r: 0, opacity: 0.8 }}
                        animate={{ r: 80, opacity: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                    )}

                    {EMOTIONS.map((emotion, eIdx) => {
                      const baseAngle = eIdx * sliceAngle;

                      return emotion.levels.map((level, lIdx) => {
                        const ring = rings[lIdx];
                        const startA = baseAngle + gap / 2;
                        const endA = baseAngle + sliceAngle - gap / 2;
                        const path = arcPath(
                          cx,
                          cy,
                          ring.innerR,
                          ring.outerR,
                          startA,
                          endA,
                        );

                        const isSelected =
                          selectedEmotion === eIdx && selectedLevel === lIdx;

                        const lightness = 30 + lIdx * 12;
                        const saturation = 50 + lIdx * 10;
                        const fillColor = `hsl(${emotion.hue}, ${saturation}%, ${lightness}%)`;
                        const activeColor = `hsl(${emotion.hue}, ${saturation + 15}%, ${lightness + 15}%)`;

                        const labelR = (ring.innerR + ring.outerR) / 2;
                        const labelAngle = baseAngle + sliceAngle / 2;
                        const labelPos = polarToCartesian(
                          cx,
                          cy,
                          labelR,
                          labelAngle,
                        );

                        return (
                          <g key={`${eIdx}-${lIdx}`}>
                            <motion.path
                              d={path}
                              fill={isSelected ? activeColor : fillColor}
                              stroke={
                                isSelected
                                  ? "rgba(42,28,20,0.65)"
                                  : "rgba(251,246,236,0.92)"
                              }
                              strokeWidth={isSelected ? 2 : 1}
                              className="cursor-pointer"
                              onClick={(e) =>
                                handleSegmentClick(eIdx, lIdx, e)
                              }
                              whileHover={{ scale: 1.02, opacity: 0.9 }}
                              style={{ transformOrigin: `${cx}px ${cy}px` }}
                              initial={false}
                              animate={{
                                scale: isSelected ? 1.04 : 1,
                                filter: isSelected
                                  ? `drop-shadow(0 0 8px ${activeColor})`
                                  : "none",
                              }}
                              transition={{ duration: 0.2 }}
                            />
                            {lIdx === 2 && (
                              <text
                                x={labelPos.x}
                                y={labelPos.y}
                                textAnchor="middle"
                                dominantBaseline="central"
                                className="pointer-events-none select-none"
                                fill="rgba(42,28,20,0.92)"
                                fontSize="7.5"
                                fontWeight="600"
                              >
                                {level}
                              </text>
                            )}
                            {lIdx === 1 && (
                              <text
                                x={labelPos.x}
                                y={labelPos.y}
                                textAnchor="middle"
                                dominantBaseline="central"
                                className="pointer-events-none select-none"
                                fill="rgba(42,28,20,0.78)"
                                fontSize="7"
                              >
                                {level}
                              </text>
                            )}
                            {lIdx === 0 && (
                              <text
                                x={labelPos.x}
                                y={labelPos.y}
                                textAnchor="middle"
                                dominantBaseline="central"
                                className="pointer-events-none select-none"
                                fill="rgba(42,28,20,0.62)"
                                fontSize="6"
                              >
                                {level}
                              </text>
                            )}
                          </g>
                        );
                      });
                    })}

                    {/* Center label */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={48}
                      fill="#FBF6EC"
                      stroke="rgba(80,60,40,0.18)"
                      strokeWidth={1}
                    />
                    {currentEmotion ? (
                      <>
                        <text
                          x={cx}
                          y={cy - 10}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={currentEmotion.color}
                          fontSize="11"
                          fontWeight="600"
                        >
                          {currentLevel}
                        </text>
                        <text
                          x={cx}
                          y={cy + 6}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="rgba(80,60,40,0.55)"
                          fontSize="10"
                        >
                          {currentEmotion.hindi}
                        </text>
                      </>
                    ) : (
                      <text
                        x={cx}
                        y={cy}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="rgba(80,60,40,0.45)"
                        fontSize="9"
                      >
                        Tap to select
                      </text>
                    )}
                  </svg>
                </div>
              </div>

              {/* Hindi labels legend */}
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 px-4">
                {EMOTIONS.map((e) => (
                  <span
                    key={e.name}
                    className={cn(
                      "text-xs transition-colors duration-200",
                      selectedEmotion !== null &&
                        EMOTIONS[selectedEmotion].name === e.name
                        ? "text-[#2a1c14]"
                        : "text-[#7a6556]",
                    )}
                  >
                    <span style={{ color: e.color }}>{e.hindi}</span>
                    <span className="text-[#9a8674] ml-1">{e.name}</span>
                  </span>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <motion.button
                  onClick={handleNext}
                  disabled={selectedEmotion === null}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-2xl font-medium transition-all duration-300",
                    selectedEmotion !== null
                      ? "bg-[#3F6B47] hover:bg-[#345a3b] text-white shadow-[0_8px_22px_-12px_rgba(63,107,71,0.45)]"
                      : "bg-white/55 text-[#9a8674] cursor-not-allowed border border-black/8",
                  )}
                  whileHover={selectedEmotion !== null ? { scale: 1.03 } : {}}
                  whileTap={selectedEmotion !== null ? { scale: 0.97 } : {}}
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Step 1: Intensity */}
          {step === 1 && currentEmotion && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center">
                <motion.div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{
                    background: `${currentEmotion.color}15`,
                    border: `1px solid ${currentEmotion.color}30`,
                  }}
                  animate={{
                    boxShadow: [
                      `0 0 0px ${currentEmotion.color}00`,
                      `0 0 ${intensity * 3}px ${currentEmotion.color}${Math.round(intensity * 6).toString(16).padStart(2, "0")}`,
                      `0 0 0px ${currentEmotion.color}00`,
                    ],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <span className="text-2xl">{currentLevel}</span>
                </motion.div>
                <h2 className="font-serif-display italic text-[1.85rem] font-light text-[#2a1c14] mb-1 leading-tight">
                  How intense is this{" "}
                  <span style={{ color: currentEmotion.color }}>
                    {currentEmotion.name.toLowerCase()}
                  </span>
                  ?
                </h2>
                <p className="text-sm text-[#5b4a3e]">
                  {currentEmotion.hindi} — {currentLevel}
                </p>
              </div>

              <div className="space-y-4 max-w-sm mx-auto">
                <div className="relative pt-2">
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={intensity}
                    onChange={(e) => setIntensity(Number(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, ${currentEmotion.color}30, ${currentEmotion.color})`,
                    }}
                  />
                  <div className="flex justify-between mt-2">
                    <span className="text-xs text-[#7a6556]">Barely there</span>
                    <span className="text-xs text-[#7a6556]">Overwhelming</span>
                  </div>
                </div>

                <motion.div
                  className="text-center"
                  key={intensity}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.15 }}
                >
                  <span
                    className="font-serif-display text-5xl font-light"
                    style={{ color: currentEmotion.color }}
                  >
                    {intensity}
                  </span>
                  <span className="text-[#9a8674] text-lg">/10</span>
                </motion.div>

                {/* Visual intensity feedback */}
                <div className="flex justify-center gap-1">
                  {Array.from({ length: 10 }, (_, i) => (
                    <motion.div
                      key={i}
                      className="w-2 rounded-full"
                      style={{
                        background:
                          i < intensity
                            ? currentEmotion.color
                            : "rgba(80,60,40,0.10)",
                        height: 8 + i * 3,
                      }}
                      animate={{
                        opacity: i < intensity ? 0.6 + (i / 10) * 0.4 : 0.3,
                      }}
                      transition={{ duration: 0.2 }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep(0)}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl text-[#7a6556] hover:text-[#2a1c14] hover:bg-white/72 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <motion.button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#3F6B47] hover:bg-[#345a3b] text-white font-medium transition-colors shadow-[0_8px_22px_-12px_rgba(63,107,71,0.45)]"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Optional trigger */}
          {step === 2 && currentEmotion && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-4">
                <h2 className="font-serif-display italic text-[1.85rem] font-light text-[#2a1c14] mb-2 leading-tight">
                  What triggered this?
                </h2>
                <p className="text-sm text-[#5b4a3e]">
                  Optional — but naming triggers builds self-awareness
                </p>
              </div>

              <textarea
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                placeholder="e.g., Got a low score on the mid-sem, had an argument with roommate..."
                rows={3}
                className={cn(
                  "w-full rounded-2xl p-5 bg-white/72 text-[#2a1c14] placeholder:text-[#9a8674]",
                  "border border-black/10 focus:outline-none resize-none backdrop-blur-sm",
                  "text-sm leading-relaxed transition-all duration-300",
                )}
                style={{
                  borderColor: trigger
                    ? `${currentEmotion.color}55`
                    : undefined,
                }}
              />

              <div className="p-4 rounded-2xl bg-white/68 border border-black/8 backdrop-blur-sm">
                <p className="text-xs text-[#7a6556] mb-2">Your check-in so far:</p>
                <div className="flex items-center gap-3">
                  <span
                    className="px-3 py-1 rounded-full text-xs font-medium"
                    style={{
                      background: `${currentEmotion.color}25`,
                      color: currentEmotion.color,
                      border: `1px solid ${currentEmotion.color}45`,
                    }}
                  >
                    {currentLevel} ({currentEmotion.hindi})
                  </span>
                  <span className="text-[#5b4a3e] text-sm">
                    Intensity: {intensity}/10
                  </span>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl text-[#7a6556] hover:text-[#2a1c14] hover:bg-white/72 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <motion.button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#3F6B47] hover:bg-[#345a3b] text-white font-medium transition-colors shadow-[0_8px_22px_-12px_rgba(63,107,71,0.45)]"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  See Suggestions
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Suggestions */}
          {step === 3 && currentEmotion && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-4">
                <motion.div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{
                    background: `${currentEmotion.color}12`,
                    border: `1px solid ${currentEmotion.color}25`,
                  }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 15 }}
                >
                  <Zap className="w-7 h-7" style={{ color: currentEmotion.color }} />
                </motion.div>
                <h2 className="font-serif-display italic text-[1.85rem] font-light text-[#2a1c14] mb-2 leading-tight">
                  Micro-actions for you
                </h2>
                <p className="text-sm text-[#5b4a3e]">
                  Feeling{" "}
                  <span style={{ color: currentEmotion.color }}>
                    {currentLevel?.toLowerCase()}
                  </span>{" "}
                  at {intensity}/10 — here's what might help
                </p>
              </div>

              <div className="space-y-3">
                {getSuggestions(currentEmotion.name, intensity).map((action, i) => {
                    const Icon = action.icon;
                    return (
                      <motion.div
                        key={action.label}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.15 }}
                        className="p-4 rounded-2xl bg-white/72 border border-black/8 hover:bg-white/85 transition-colors backdrop-blur-sm shadow-[0_6px_18px_-12px_rgba(80,60,40,0.18)]"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                              background: `${currentEmotion.color}22`,
                              border: `1px solid ${currentEmotion.color}45`,
                            }}
                          >
                            <Icon
                              className="w-5 h-5"
                              style={{ color: currentEmotion.color }}
                            />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#2a1c14] mb-0.5">
                              {action.label}
                            </p>
                            <p className="text-xs text-[#5b4a3e] leading-relaxed">
                              {action.description}
                            </p>
                            {(action.label.includes("Breath Sphere") ||
                              action.label.includes("Worry Vault") ||
                              action.label.includes("Thought Trap")) && (
                              <div className="mt-3">
                                <button
                                  onClick={() => {
                                    if (action.label.includes("Breath Sphere"))
                                      navigate("/mindgym/breath-sphere");
                                    else if (action.label.includes("Worry Vault"))
                                      navigate("/mindgym/worry-vault");
                                    else if (action.label.includes("Thought Trap"))
                                      navigate("/mindgym/thought-trap");
                                  }}
                                  className="text-xs text-[#3F6B47] hover:text-[#2c5235] transition-colors"
                                >
                                  Open this practice →
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
              </div>

              {/* Summary card */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="p-4 rounded-2xl border border-black/8 bg-white/65 backdrop-blur-sm"
              >
                <p className="text-xs text-[#7a6556] mb-2">Logged to your Emotion Journal</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="px-2.5 py-1 rounded-full text-xs"
                    style={{
                      background: `${currentEmotion.color}25`,
                      color: currentEmotion.color,
                      border: `1px solid ${currentEmotion.color}45`,
                    }}
                  >
                    {currentEmotion.name} · {currentLevel}
                  </span>
                  <span className="text-xs text-[#5b4a3e]">
                    {intensity}/10
                  </span>
                  {trigger.trim() && (
                    <span className="text-xs text-[#7a6556] italic truncate max-w-[200px]">
                      — {trigger.trim()}
                    </span>
                  )}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-center pt-2"
              >
                <motion.button
                  onClick={handleComplete}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-[#3F6B47] hover:bg-[#345a3b] text-white font-medium transition-colors shadow-[0_10px_28px_-14px_rgba(63,107,71,0.45)]"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Check className="w-5 h-5" />
                  Complete Check-in
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToolShell>
  );
}
