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
      themeColor="from-[#0f0c29] via-[#302b63] to-[#24243e]"
    >
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
        <AnimatePresence mode="wait">
          {/* Step 1: Capture the thought */}
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-4">
                  <PenLine className="w-7 h-7 text-purple-400" />
                </div>
                <h2 className="text-xl font-semibold text-white/90 mb-2">
                  Catch the thought
                </h2>
                <p className="text-sm text-white/40 max-w-md mx-auto">
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
                    "w-full rounded-2xl p-5 bg-white/[0.03] text-white/90 placeholder:text-white/20",
                    "border border-white/10 focus:border-purple-500/40 focus:outline-none resize-none",
                    "text-base leading-relaxed transition-all duration-300",
                    "focus:shadow-[0_0_30px_rgba(168,85,247,0.1)]",
                  )}
                />

                {/* Floating bubble decorations */}
                {thought.length > 10 && (
                  <>
                    <motion.div
                      className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-purple-500/20 blur-sm"
                      animate={{ y: [0, -6, 0], scale: [1, 1.2, 1] }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                    <motion.div
                      className="absolute -bottom-2 -left-2 w-4 h-4 rounded-full bg-purple-400/15 blur-sm"
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
                    "flex items-center gap-2 px-6 py-3 rounded-2xl font-medium transition-all duration-300",
                    thought.trim()
                      ? "bg-purple-600 hover:bg-purple-500 text-white"
                      : "bg-white/5 text-white/20 cursor-not-allowed",
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
              className="space-y-6"
            >
              <div className="text-center mb-4">
                <h2 className="text-xl font-semibold text-white/90 mb-2">
                  Spot the thinking traps
                </h2>
                <p className="text-sm text-white/40 max-w-md mx-auto">
                  Which of these patterns match your thought? Select all that
                  apply.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/10">
                <p className="text-sm text-white/30 mb-1">Your thought:</p>
                <p className="text-white/70 italic">"{thought}"</p>
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
                        ? "border-purple-500/40 bg-purple-500/10 shadow-[0_0_20px_rgba(168,85,247,0.12)]"
                        : "border-white/8 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg shrink-0 mt-0.5">{d.emoji}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p
                            className={cn(
                              "text-sm font-medium transition-colors",
                              selectedDistortions.includes(d.id)
                                ? "text-purple-300"
                                : "text-white/80 group-hover:text-white",
                            )}
                          >
                            {d.name}
                          </p>
                          {selectedDistortions.includes(d.id) && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                            >
                              <Check className="w-3.5 h-3.5 text-purple-400" />
                            </motion.div>
                          )}
                        </div>
                        <p className="text-xs text-white/30 leading-relaxed">
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
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <motion.button
                  onClick={() => setStep(2)}
                  disabled={selectedDistortions.length === 0}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-2xl font-medium transition-all duration-300",
                    selectedDistortions.length > 0
                      ? "bg-purple-600 hover:bg-purple-500 text-white"
                      : "bg-white/5 text-white/20 cursor-not-allowed",
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
              className="space-y-6"
            >
              <div className="text-center mb-4">
                <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-7 h-7 text-teal-400" />
                </div>
                <h2 className="text-xl font-semibold text-white/90 mb-2">
                  Reframe the thought
                </h2>
                <p className="text-sm text-white/40 max-w-md mx-auto">
                  Let's build a more balanced perspective. Fill in the blanks
                  below.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/10 mb-2">
                <p className="text-sm text-white/30 mb-1">Trapped thought:</p>
                <p className="text-white/60 italic text-sm">"{thought}"</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedDistortions.map((id) => {
                    const d = DISTORTIONS.find((x) => x.id === id);
                    return (
                      <span
                        key={id}
                        className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/20"
                      >
                        {d?.emoji} {d?.name}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4 p-5 rounded-2xl bg-white/[0.02] border border-white/8">
                <p className="text-white/70 text-sm leading-relaxed">
                  Even though{" "}
                  <span className="text-purple-300/80 italic">
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
                    "w-full rounded-xl p-4 bg-white/[0.03] text-white/90 placeholder:text-white/20",
                    "border border-white/10 focus:border-teal-500/40 focus:outline-none resize-none",
                    "text-sm leading-relaxed transition-all duration-300",
                    "focus:shadow-[0_0_20px_rgba(20,184,166,0.1)]",
                  )}
                />

                <p className="text-white/70 text-sm">...and I can</p>
                <textarea
                  value={reframeCan}
                  onChange={(e) => setReframeCan(e.target.value)}
                  placeholder="e.g., ask for help and take it one step at a time"
                  rows={2}
                  className={cn(
                    "w-full rounded-xl p-4 bg-white/[0.03] text-white/90 placeholder:text-white/20",
                    "border border-white/10 focus:border-teal-500/40 focus:outline-none resize-none",
                    "text-sm leading-relaxed transition-all duration-300",
                    "focus:shadow-[0_0_20px_rgba(20,184,166,0.1)]",
                  )}
                />
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <motion.button
                  onClick={handleReframeSubmit}
                  disabled={!reframeAlso.trim() || !reframeCan.trim()}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-2xl font-medium transition-all duration-300",
                    reframeAlso.trim() && reframeCan.trim()
                      ? "bg-teal-600 hover:bg-teal-500 text-white"
                      : "bg-white/5 text-white/20 cursor-not-allowed",
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
              className="space-y-8 pt-4"
            >
              <div className="text-center">
                <h2 className="text-xl font-semibold text-white/90 mb-2">
                  The shift
                </h2>
                <p className="text-sm text-white/40">
                  See how your perspective transformed
                </p>
              </div>

              <div className="space-y-6">
                {/* Original thought */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="relative p-5 rounded-2xl bg-red-500/5 border border-red-500/10"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-400/60" />
                    <p className="text-xs text-red-400/60 uppercase tracking-wider font-medium">
                      Trapped Thought
                    </p>
                  </div>
                  <p className="text-white/50 italic line-through decoration-red-400/30">
                    "{thought}"
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {selectedDistortions.map((id) => {
                      const d = DISTORTIONS.find((x) => x.id === id);
                      return (
                        <span
                          key={id}
                          className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-300/60 border border-red-500/15"
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
                  <div className="w-px h-8 bg-gradient-to-b from-red-500/20 to-teal-500/20" />
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
                      className="relative p-5 rounded-2xl bg-teal-500/5 border border-teal-500/15 shadow-[0_0_30px_rgba(20,184,166,0.08)]"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-teal-400/70" />
                        <p className="text-xs text-teal-400/70 uppercase tracking-wider font-medium">
                          Reframed
                        </p>
                      </div>
                      <p className="text-white/80 leading-relaxed">
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
                  <p className="text-sm text-white/30 mb-6 italic">
                    Saved to your Thought Journal
                  </p>
                  <motion.button
                    onClick={handleFinish}
                    className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-medium transition-colors"
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
