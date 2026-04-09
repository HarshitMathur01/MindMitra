import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PenLine,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Check,
  AlertTriangle,
} from "lucide-react";
import ToolShell from "@/components/mindgym/ToolShell";
import CrisisOverlay from "@/components/mindgym/CrisisOverlay";
import { CRISIS_KEYWORDS } from "@/lib/mindgym/types";
import { trackMindGymEvent } from "@/lib/mindgym/analytics";
import { cn } from "@/lib/utils";

interface ThoughtTrapProps {
  onAvatarCue?: (text: string, emotion: string) => void;
}

interface Distortion {
  id: string;
  name: string;
  emoji: string;
  example: string;
}

const DISTORTIONS: Distortion[] = [
  {
    id: "all-or-nothing",
    name: "All-or-Nothing",
    emoji: "⚫",
    example: "I didn't score 90+, so I'm a complete failure.",
  },
  {
    id: "catastrophizing",
    name: "Catastrophizing",
    emoji: "🌋",
    example: "If I don't get into IIT, my life is over.",
  },
  {
    id: "mind-reading",
    name: "Mind Reading",
    emoji: "🔮",
    example: "Everyone in class thinks I'm stupid.",
  },
  {
    id: "overgeneralization",
    name: "Overgeneralization",
    emoji: "♾️",
    example: "I messed up one viva — I always choke under pressure.",
  },
  {
    id: "emotional-reasoning",
    name: "Emotional Reasoning",
    emoji: "💔",
    example: "I feel like a burden, so I must be one.",
  },
  {
    id: "should-statements",
    name: "Should Statements",
    emoji: "📏",
    example: "I should be studying 14 hours a day like my roommate.",
  },
  {
    id: "labeling",
    name: "Labeling",
    emoji: "🏷️",
    example: "I'm lazy. I'm not cut out for engineering.",
  },
  {
    id: "mental-filter",
    name: "Mental Filter",
    emoji: "🔍",
    example: "I got praise from 4 profs but one criticized me — I'm terrible.",
  },
];

interface JournalEntry {
  thought: string;
  distortions: string[];
  reframe: string;
  date: string;
}

const STORAGE_KEY = "mindmitra_thought_journal_v1";

const WARM_PANEL =
  "rounded-[2rem] border border-border bg-white/88 shadow-[0_20px_50px_-30px_rgba(62,84,60,0.24)] backdrop-blur-sm";
const WARM_INPUT =
  "w-full rounded-2xl p-5 bg-white/92 text-text-primary placeholder:text-text-secondary/55 border border-border focus:border-primary/40 focus:outline-none resize-none text-base leading-relaxed transition-all duration-300";

function loadJournal(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEntry(entry: JournalEntry) {
  const journal = loadJournal();
  journal.push(entry);
  if (journal.length > 200) journal.splice(0, journal.length - 200);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(journal));
}

function containsCrisisKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
}

export default function ThoughtTrap({ onAvatarCue }: ThoughtTrapProps) {
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [crisisOpen, setCrisisOpen] = useState(false);

  const [thought, setThought] = useState("");
  const [selectedDistortions, setSelectedDistortions] = useState<string[]>([]);
  const [reframeAlso, setReframeAlso] = useState("");
  const [reframeCan, setReframeCan] = useState("");
  const [showReveal, setShowReveal] = useState(false);

  useEffect(() => {
    if (step === 0) {
      onAvatarCue?.(
        "Write down a thought that's been bothering you. No judgment here.",
        "supportive",
      );
    } else if (step === 1) {
      onAvatarCue?.(
        "Our minds play tricks on us. Which of these patterns do you see?",
        "curious",
      );
    } else if (step === 2) {
      onAvatarCue?.(
        "Let's find a more balanced way to see this.",
        "encouraging",
      );
    }
  }, [step, onAvatarCue]);

  const handleThoughtSubmit = useCallback(() => {
    if (!thought.trim()) return;
    if (containsCrisisKeyword(thought)) {
      trackMindGymEvent("crisis_triggered", { toolId: "thought-trap" });
      setCrisisOpen(true);
      return;
    }
    setStep(1);
  }, [thought]);

  const toggleDistortion = (id: string) => {
    setSelectedDistortions((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  };

  const handleReframeSubmit = () => {
    if (!reframeAlso.trim() || !reframeCan.trim()) return;

    const fullReframe = `Even though ${thought.trim()}, it's also true that ${reframeAlso.trim()} and I can ${reframeCan.trim()}.`;

    saveEntry({
      thought: thought.trim(),
      distortions: selectedDistortions,
      reframe: fullReframe,
      date: new Date().toISOString(),
    });

    setStep(3);
    setTimeout(() => setShowReveal(true), 600);
    onAvatarCue?.("Look at that shift. You rewired a thought pattern.", "proud");
  };

  const handleFinish = () => setCompleted(true);

  const handleReset = () => {
    setStep(0);
    setCompleted(false);
    setThought("");
    setSelectedDistortions([]);
    setReframeAlso("");
    setReframeCan("");
    setShowReveal(false);
  };

  const fullReframe = `Even though ${thought.trim()}, it's also true that ${reframeAlso.trim()} and I can ${reframeCan.trim()}.`;

  return (
    <ToolShell
      toolId="thought-trap"
      title="Thought Trap"
      clinicalBasis="Based on Aaron Beck's Cognitive Behavioral Therapy (CBT). When we identify cognitive distortions and actively reframe them, we weaken automatic negative thought patterns and build more balanced thinking over time."
      xp={40}
      completed={completed}
      onReset={handleReset}
      totalSteps={4}
      currentStep={step}
      themeColor="from-[#f6f0e4] via-[#f2ecde] to-[#e8f0e4]"
      themeAccent="emerald"
      surfaceTone="warm"
    >
      <div className="w-full max-w-none px-4 sm:px-6 lg:px-10 pt-6 pb-24">
        <AnimatePresence mode="wait">
          {/* Step 1: Capture the thought */}
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`space-y-6 p-5 sm:p-6 ${WARM_PANEL}`}
            >
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                  <PenLine className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-text-primary mb-2 tracking-tight">
                  Catch the thought
                </h2>
                <p className="text-sm sm:text-base text-text-secondary max-w-md mx-auto leading-7">
                  What negative thought keeps replaying in your mind? Write it
                  exactly as it sounds in your head.
                </p>
              </div>

              <div className="relative">
                <textarea
                  value={thought}
                  onChange={(e) => setThought(e.target.value)}
                  placeholder="e.g., I'm not smart enough for this college..."
                  rows={4}
                  className={cn(
                    WARM_INPUT,
                    "focus:shadow-[0_0_30px_rgba(82,111,85,0.12)]",
                  )}
                />

                {/* Floating bubble decorations */}
                {thought.length > 10 && (
                  <>
                    <motion.div
                      className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-primary/18 blur-sm"
                      animate={{ y: [0, -6, 0], scale: [1, 1.2, 1] }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                    <motion.div
                      className="absolute -bottom-2 -left-2 w-4 h-4 rounded-full bg-emerald-400/15 blur-sm"
                      animate={{ y: [0, -4, 0], scale: [1, 1.3, 1] }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 0.5,
                      }}
                    />
                  </>
                )}
              </div>

              <div className="flex justify-end">
                <motion.button
                  onClick={handleThoughtSubmit}
                  disabled={!thought.trim()}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-300",
                    thought.trim()
                      ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_16px_34px_-24px_rgba(82,111,85,0.45)]"
                      : "bg-white/70 text-text-secondary/50 cursor-not-allowed border border-border",
                  )}
                  whileHover={thought.trim() ? { scale: 1.03 } : {}}
                  whileTap={thought.trim() ? { scale: 0.97 } : {}}
                >
                  Identify Traps
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Identify distortions */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`space-y-6 p-5 sm:p-6 ${WARM_PANEL}`}
            >
              <div className="text-center mb-4">
                <h2 className="text-2xl font-semibold text-text-primary mb-2 tracking-tight">
                  Spot the thinking traps
                </h2>
                <p className="text-sm sm:text-base text-text-secondary max-w-md mx-auto leading-7">
                  Which of these patterns match your thought? Select all that
                  apply.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-primary/10 border border-border">
                <p className="text-sm font-semibold text-text-secondary mb-1 uppercase tracking-[0.2em]">
                  Your thought:
                </p>
                <p className="text-text-primary/80 italic leading-7">"{thought}"</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {DISTORTIONS.map((d, i) => (
                  <motion.button
                    key={d.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => toggleDistortion(d.id)}
                    className={cn(
                      "p-4 rounded-2xl border text-left transition-all duration-300 group",
                      selectedDistortions.includes(d.id)
                        ? "border-primary/40 bg-primary/10 shadow-[0_0_20px_rgba(82,111,85,0.14)]"
                        : "border-border bg-white/92 hover:bg-white hover:border-primary/20",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg shrink-0 mt-0.5">{d.emoji}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p
                            className={cn(
                              "text-sm font-semibold transition-colors",
                              selectedDistortions.includes(d.id)
                                ? "text-primary"
                                : "text-text-primary group-hover:text-primary",
                            )}
                          >
                            {d.name}
                          </p>
                          {selectedDistortions.includes(d.id) && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                            >
                              <Check className="w-3.5 h-3.5 text-primary" />
                            </motion.div>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                          "{d.example}"
                        </p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setStep(0)}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl text-text-secondary hover:text-text-primary hover:bg-white/80 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <motion.button
                  onClick={() => setStep(2)}
                  disabled={selectedDistortions.length === 0}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-300",
                    selectedDistortions.length > 0
                      ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_16px_34px_-24px_rgba(82,111,85,0.45)]"
                      : "bg-white/70 text-text-secondary/50 cursor-not-allowed border border-border",
                  )}
                  whileHover={
                    selectedDistortions.length > 0 ? { scale: 1.03 } : {}
                  }
                  whileTap={
                    selectedDistortions.length > 0 ? { scale: 0.97 } : {}
                  }
                >
                  Reframe
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Reframe */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`space-y-6 p-5 sm:p-6 ${WARM_PANEL}`}
            >
              <div className="text-center mb-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-text-primary mb-2 tracking-tight">
                  Reframe the thought
                </h2>
                <p className="text-sm sm:text-base text-text-secondary max-w-md mx-auto leading-7">
                  Let's build a more balanced perspective. Fill in the blanks
                  below.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-primary/10 border border-border mb-2">
                <p className="text-sm font-semibold text-text-secondary mb-1 uppercase tracking-[0.2em]">
                  Trapped thought:
                </p>
                <p className="text-text-primary/75 italic text-sm leading-7">"{thought}"</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedDistortions.map((id) => {
                    const d = DISTORTIONS.find((x) => x.id === id);
                    return (
                      <span
                        key={id}
                        className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20"
                      >
                        {d?.emoji} {d?.name}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4 p-5 rounded-2xl bg-white/92 border border-border shadow-[0_16px_36px_-28px_rgba(62,84,60,0.12)]">
                <p className="text-text-primary text-sm sm:text-base leading-7">
                  Even though{" "}
                  <span className="text-primary/80 italic font-medium">
                    {thought.trim()}
                  </span>
                  , it's also true that...
                </p>
                <textarea
                  value={reframeAlso}
                  onChange={(e) => setReframeAlso(e.target.value)}
                  placeholder="e.g., I've handled tough situations before"
                  rows={2}
                  className={cn(
                    "w-full rounded-xl p-4 bg-white/92 text-text-primary placeholder:text-text-secondary/55",
                    "border border-border focus:border-primary/40 focus:outline-none resize-none",
                    "text-sm leading-relaxed transition-all duration-300",
                    "focus:shadow-[0_0_20px_rgba(82,111,85,0.1)]",
                  )}
                />

                <p className="text-text-primary text-sm sm:text-base font-medium">...and I can</p>
                <textarea
                  value={reframeCan}
                  onChange={(e) => setReframeCan(e.target.value)}
                  placeholder="e.g., ask for help and take it one step at a time"
                  rows={2}
                  className={cn(
                    "w-full rounded-xl p-4 bg-white/92 text-text-primary placeholder:text-text-secondary/55",
                    "border border-border focus:border-primary/40 focus:outline-none resize-none",
                    "text-sm leading-relaxed transition-all duration-300",
                    "focus:shadow-[0_0_20px_rgba(82,111,85,0.1)]",
                  )}
                />
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl text-text-secondary hover:text-text-primary hover:bg-white/80 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <motion.button
                  onClick={handleReframeSubmit}
                  disabled={!reframeAlso.trim() || !reframeCan.trim()}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-300",
                    reframeAlso.trim() && reframeCan.trim()
                      ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_16px_34px_-24px_rgba(82,111,85,0.45)]"
                      : "bg-white/70 text-text-secondary/50 cursor-not-allowed border border-border",
                  )}
                  whileHover={
                    reframeAlso.trim() && reframeCan.trim()
                      ? { scale: 1.03 }
                      : {}
                  }
                  whileTap={
                    reframeAlso.trim() && reframeCan.trim()
                      ? { scale: 0.97 }
                      : {}
                  }
                >
                  See the Shift
                  <Sparkles className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Reveal */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`space-y-8 pt-4 p-5 sm:p-6 ${WARM_PANEL}`}
            >
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-text-primary mb-2 tracking-tight">
                  The shift
                </h2>
                <p className="text-sm sm:text-base text-text-secondary leading-7">
                  See how your perspective transformed
                </p>
              </div>

              <div className="space-y-6">
                {/* Original thought */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="relative p-5 rounded-2xl bg-rose-500/8 border border-rose-200"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500/70" />
                    <p className="text-xs text-rose-500/70 uppercase tracking-[0.22em] font-semibold">
                      Trapped Thought
                    </p>
                  </div>
                  <p className="text-text-secondary italic line-through decoration-rose-400/40 leading-7">
                    "{thought}"
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {selectedDistortions.map((id) => {
                      const d = DISTORTIONS.find((x) => x.id === id);
                      return (
                        <span
                          key={id}
                          className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 border border-rose-200"
                        >
                          {d?.emoji} {d?.name}
                        </span>
                      );
                    })}
                  </div>
                </motion.div>

                {/* Arrow */}
                <motion.div
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={showReveal ? { opacity: 1, scaleY: 1 } : {}}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="flex justify-center"
                >
                  <div className="w-px h-8 bg-gradient-to-b from-rose-300/30 to-primary/30" />
                </motion.div>

                {/* Reframed thought */}
                <AnimatePresence>
                  {showReveal && (
                    <motion.div
                      initial={{ opacity: 0, x: 20, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{
                        delay: 0.2,
                        type: "spring",
                        damping: 20,
                      }}
                      className="relative p-5 rounded-2xl bg-primary/10 border border-primary/20 shadow-[0_0_30px_rgba(82,111,85,0.1)]"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <p className="text-xs text-primary uppercase tracking-[0.22em] font-semibold">
                          Reframed
                        </p>
                      </div>
                      <p className="text-text-primary leading-7 text-base">
                        {fullReframe}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {showReveal && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="text-center pt-4"
                >
                  <p className="text-sm sm:text-base text-text-secondary mb-6 italic">
                    Saved to your Thought Journal
                  </p>
                  <motion.button
                    onClick={handleFinish}
                    className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-colors shadow-[0_16px_34px_-24px_rgba(82,111,85,0.45)]"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Check className="w-5 h-5" />
                    Complete
                  </motion.button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CrisisOverlay open={crisisOpen} onClose={() => setCrisisOpen(false)} />
    </ToolShell>
  );
}
