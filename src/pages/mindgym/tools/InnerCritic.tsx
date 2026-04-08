import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gavel, ShieldCheck, Sparkles, BookmarkPlus, Bookmark, AlertTriangle } from "lucide-react";
import ToolShell from "@/components/mindgym/ToolShell";
import { CRISIS_KEYWORDS } from "@/lib/mindgym/types";
import CrisisOverlay from "@/components/mindgym/CrisisOverlay";
import { trackMindGymEvent } from "@/lib/mindgym/analytics";
import { cn } from "@/lib/utils";

interface InnerCriticProps {
  onAvatarCue?: (text: string, emotion: string) => void;
}

interface CompassionCard {
  thought: string;
  reframe: string;
  date: string;
}

const STORAGE_KEY = "mindmitra_compassion_cards_v1";

const PRESETS = [
  "I failed the exam, I'm completely worthless",
  "Everyone in my batch is doing better than me",
  "My parents would be so disappointed in me",
  "I'll never crack JEE/NEET, I'm not smart enough",
  "I don't have any real friends here",
  "I can't do anything right — I keep messing up",
  "I'm wasting my parents' money by being here",
  "Nobody actually cares about me",
] as const;

const DEFENSE_PROMPTS = [
  "Would you say this to your closest friend? What would you say to them instead?",
  "What's one fact or memory that contradicts this thought?",
  "What would the wisest, kindest version of you say right now?",
] as const;

function loadCards(): CompassionCard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CompassionCard[]) : [];
  } catch {
    return [];
  }
}

function saveCard(card: CompassionCard): void {
  const cards = loadCards();
  cards.push(card);
  if (cards.length > 100) cards.splice(0, cards.length - 100);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

function containsCrisis(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
}

export default function InnerCritic({ onAvatarCue }: InnerCriticProps) {
  const [step, setStep] = useState(0);
  const [thought, setThought] = useState("");
  const [crisisDetected, setCrisisDetected] = useState(false);
  const [crisisOpen, setCrisisOpen] = useState(false);
  const [defenseAnswers, setDefenseAnswers] = useState(["", "", ""]);
  const [completed, setCompleted] = useState(false);
  const [savedCards, setSavedCards] = useState<CompassionCard[]>(loadCards);
  const [showCards, setShowCards] = useState(false);

  const reframe = defenseAnswers[2] || defenseAnswers[0] || "You are worthy of compassion.";

  useEffect(() => {
    onAvatarCue?.("Welcome to Inner Critic Court. Let's challenge that harsh inner voice together.", "caring");
  }, []);

  const handleThoughtSubmit = useCallback(() => {
    if (!thought.trim()) return;
    if (containsCrisis(thought)) {
      trackMindGymEvent("crisis_triggered", { toolId: "inner-critic" });
      setCrisisDetected(true);
      setCrisisOpen(true);
      return;
    }
    setCrisisDetected(false);
    setStep(1);
    onAvatarCue?.("Now let's see how the prosecution presents this thought...", "thoughtful");
  }, [thought, onAvatarCue]);

  const handleProsecutionNext = useCallback(() => {
    setStep(2);
    onAvatarCue?.("Time for the defense! You've got this — answer with kindness.", "encouraging");
  }, [onAvatarCue]);

  const handleDefenseSubmit = useCallback(() => {
    const filled = defenseAnswers.filter((a) => a.trim().length > 0);
    if (filled.length < 2) return;
    setStep(3);
    onAvatarCue?.("The verdict is in. Your compassionate voice wins.", "proud");
    setTimeout(() => setCompleted(true), 3000);
  }, [defenseAnswers, onAvatarCue]);

  const handleSaveCard = useCallback(() => {
    const card: CompassionCard = {
      thought,
      reframe,
      date: new Date().toISOString(),
    };
    saveCard(card);
    setSavedCards(loadCards());
  }, [thought, reframe]);

  const handleReset = useCallback(() => {
    setStep(0);
    setThought("");
    setCrisisDetected(false);
    setDefenseAnswers(["", "", ""]);
    setCompleted(false);
  }, []);

  const updateDefense = (idx: number, val: string) => {
    setDefenseAnswers((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  };

  return (
    <ToolShell
      toolId="inner-critic"
      title="Inner Critic Court"
      clinicalBasis="Kristin Neff's self-compassion therapy reduces shame-driven thinking through cognitive defusion — separating yourself from harsh thoughts and responding with the voice of a kind friend."
      xp={45}
      themeColor="from-[#1b0b14] via-[#351b2a] to-[#190e1c]"
      completed={completed}
      onReset={handleReset}
      totalSteps={4}
      currentStep={step}
      onAvatarCue={onAvatarCue}
    >
      <div className="max-w-2xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {/* ───── STEP 0: Enter thought ───── */}
          {step === 0 && (
            <motion.div
              key="step-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <div className="text-center mb-8">
                <motion.div
                  className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <Gavel className="w-8 h-8 text-purple-400" />
                </motion.div>
                <h2 className="text-xl font-semibold text-white mb-2">
                  What is your inner critic saying?
                </h2>
                <p className="text-white/50 text-sm max-w-md mx-auto">
                  Write down a harsh, self-critical thought — the kind you&apos;d never say to a friend.
                  We&apos;ll put it on trial together.
                </p>
              </div>

              <textarea
                value={thought}
                onChange={(e) => {
                  setThought(e.target.value);
                  if (crisisDetected) setCrisisDetected(false);
                }}
                placeholder="Type your self-critical thought here..."
                className="w-full h-32 rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 transition-all text-sm"
              />

              {crisisDetected && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                  <p className="text-rose-300 text-xs leading-relaxed">
                    It sounds like you may be going through something really difficult.
                    Please use the <strong>&quot;Need help?&quot;</strong> button below to reach a crisis helpline.
                    You deserve support right now.
                  </p>
                </motion.div>
              )}

              <div className="mt-6">
                <p className="text-xs text-white/40 mb-3">Or pick a common thought:</p>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setThought(preset)}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-full border transition-all",
                        thought === preset
                          ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                          : "bg-white/5 border-white/10 text-white/50 hover:text-white/70 hover:bg-white/10"
                      )}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 mt-8">
                <button
                  onClick={handleThoughtSubmit}
                  disabled={!thought.trim()}
                  className={cn(
                    "flex-1 py-3 rounded-2xl font-medium text-sm transition-all",
                    thought.trim()
                      ? "bg-purple-600 hover:bg-purple-700 text-white"
                      : "bg-white/5 text-white/30 cursor-not-allowed"
                  )}
                >
                  Enter the Courtroom
                </button>
                {savedCards.length > 0 && (
                  <button
                    onClick={() => setShowCards(!showCards)}
                    className="flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-white/10 text-white/50 hover:text-white/70 hover:bg-white/5 transition-all text-sm"
                  >
                    <Bookmark className="w-4 h-4" />
                    {savedCards.length}
                  </button>
                )}
              </div>

              {/* Saved compassion cards */}
              <AnimatePresence>
                {showCards && savedCards.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-6 overflow-hidden"
                  >
                    <h3 className="text-sm font-medium text-white/60 mb-3">
                      Your Compassion Cards
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {savedCards.slice().reverse().map((card, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl bg-white/5 border border-white/5"
                        >
                          <p className="text-xs text-white/40 line-through mb-1">
                            {card.thought}
                          </p>
                          <p className="text-sm text-teal-300">{card.reframe}</p>
                          <p className="text-[10px] text-white/20 mt-1">
                            {new Date(card.date).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ───── STEP 1: Prosecution ───── */}
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <div className="text-center mb-6">
                <h2 className="text-lg font-semibold text-white mb-1">The Prosecution Speaks</h2>
                <p className="text-white/40 text-xs">Your inner critic presents its case.</p>
              </div>

              <motion.div
                className="relative rounded-2xl overflow-hidden"
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-red-950/60 via-[#1a1015] to-[#0f0d13]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.08),transparent_60%)]" />

                <div className="relative p-6">
                  <div className="flex items-start gap-4">
                    <motion.div
                      className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0"
                      animate={{ boxShadow: ["0 0 0px rgba(239,68,68,0)", "0 0 20px rgba(239,68,68,0.3)", "0 0 0px rgba(239,68,68,0)"] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Gavel className="w-6 h-6 text-red-400" />
                    </motion.div>
                    <div className="flex-1">
                      <p className="text-xs text-red-400/80 font-medium uppercase tracking-wider mb-2">
                        Prosecutor — The Inner Critic
                      </p>
                      <motion.p
                        className="text-white text-base leading-relaxed italic"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3, duration: 0.6 }}
                      >
                        &ldquo;{thought}&rdquo;
                      </motion.p>
                    </div>
                  </div>

                  <motion.div
                    className="mt-6 space-y-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8, duration: 0.5 }}
                  >
                    <p className="text-xs text-red-400/60">The prosecution argues:</p>
                    {[
                      "This thought has been repeated so many times it must be true.",
                      "There is no counter-evidence. The defendant should accept it.",
                      "Feelings of failure confirm the verdict.",
                    ].map((line, i) => (
                      <motion.p
                        key={i}
                        className="text-sm text-white/40 pl-4 border-l-2 border-red-500/20"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.2 + i * 0.3 }}
                      >
                        {line}
                      </motion.p>
                    ))}
                  </motion.div>
                </div>
              </motion.div>

              <motion.button
                onClick={handleProsecutionNext}
                className="w-full mt-8 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-medium text-sm transition-colors"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2 }}
              >
                <ShieldCheck className="w-4 h-4 inline-block mr-2" />
                Rise for the Defense
              </motion.button>
            </motion.div>
          )}

          {/* ───── STEP 2: Defense ───── */}
          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <div className="text-center mb-6">
                <h2 className="text-lg font-semibold text-white mb-1">Your Defense</h2>
                <p className="text-white/40 text-xs">Speak with the compassion you&apos;d give a close friend.</p>
              </div>

              <div className="rounded-2xl bg-gradient-to-br from-teal-950/40 via-[#0f1a18] to-[#0f0d13] border border-teal-500/10 p-5">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-teal-400" />
                  </div>
                  <div>
                    <p className="text-xs text-teal-400/80 font-medium uppercase tracking-wider">
                      Defense Counsel — You
                    </p>
                    <p className="text-[11px] text-white/30 mt-0.5">
                      Responding to: &ldquo;{thought.slice(0, 50)}{thought.length > 50 ? "..." : ""}&rdquo;
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  {DEFENSE_PROMPTS.map((prompt, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.2 }}
                    >
                      <label className="text-sm text-white/60 mb-2 block leading-relaxed">
                        {idx + 1}. {prompt}
                      </label>
                      <textarea
                        value={defenseAnswers[idx]}
                        onChange={(e) => updateDefense(idx, e.target.value)}
                        placeholder="Write your compassionate response..."
                        className="w-full h-24 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/25 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/30 transition-all text-sm"
                      />
                    </motion.div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleDefenseSubmit}
                disabled={defenseAnswers.filter((a) => a.trim()).length < 2}
                className={cn(
                  "w-full mt-8 py-3 rounded-2xl font-medium text-sm transition-all",
                  defenseAnswers.filter((a) => a.trim()).length >= 2
                    ? "bg-teal-600 hover:bg-teal-700 text-white"
                    : "bg-white/5 text-white/30 cursor-not-allowed"
                )}
              >
                Deliver the Verdict
              </button>
            </motion.div>
          )}

          {/* ───── STEP 3: Verdict ───── */}
          {step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="text-center"
            >
              <motion.div
                className="w-20 h-20 rounded-full bg-teal-500/20 flex items-center justify-center mx-auto mb-6"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 12, delay: 0.2 }}
              >
                <Sparkles className="w-10 h-10 text-teal-400" />
              </motion.div>

              <h2 className="text-xl font-semibold text-white mb-2">The Verdict</h2>
              <p className="text-white/40 text-sm mb-8">
                The court finds the inner critic&apos;s case unsubstantiated.
              </p>

              <div className="max-w-md mx-auto space-y-6">
                {/* Struck-out prosecution */}
                <motion.div
                  className="relative rounded-xl bg-red-500/5 border border-red-500/10 p-4"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <p className="text-xs text-red-400/50 uppercase tracking-wider mb-1">Dismissed</p>
                  <p className="text-white/40 text-sm line-through decoration-red-500/60 decoration-2 italic">
                    &ldquo;{thought}&rdquo;
                  </p>
                  <motion.div
                    className="absolute inset-0 rounded-xl pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                  >
                    <svg className="absolute inset-0 w-full h-full">
                      <motion.line
                        x1="5%"
                        y1="50%"
                        x2="95%"
                        y2="50%"
                        stroke="rgba(239,68,68,0.3)"
                        strokeWidth="2"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ delay: 1, duration: 0.8, ease: "easeInOut" }}
                      />
                    </svg>
                  </motion.div>
                </motion.div>

                {/* Compassionate reframe */}
                <motion.div
                  className="rounded-xl bg-teal-500/10 border border-teal-500/20 p-5"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.4, type: "spring", damping: 15 }}
                >
                  <p className="text-xs text-teal-400/70 uppercase tracking-wider mb-2">
                    Your Compassionate Truth
                  </p>
                  <p className="text-teal-200 text-base leading-relaxed font-medium">
                    &ldquo;{reframe}&rdquo;
                  </p>
                </motion.div>

                {/* Defense summary */}
                <motion.div
                  className="text-left space-y-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.8 }}
                >
                  {defenseAnswers.map(
                    (answer, i) =>
                      answer.trim() && (
                        <div
                          key={i}
                          className="pl-3 border-l-2 border-teal-500/20"
                        >
                          <p className="text-[11px] text-white/30">
                            {DEFENSE_PROMPTS[i].slice(0, 50)}...
                          </p>
                          <p className="text-sm text-white/60 mt-0.5">{answer}</p>
                        </div>
                      )
                  )}
                </motion.div>

                {/* Save as compassion card */}
                <motion.button
                  onClick={handleSaveCard}
                  className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-full bg-purple-500/15 border border-purple-500/20 text-purple-300 text-sm hover:bg-purple-500/25 transition-colors"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 2.2 }}
                >
                  <BookmarkPlus className="w-4 h-4" />
                  Save as Compassion Card
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CrisisOverlay open={crisisOpen} onClose={() => setCrisisOpen(false)} />
    </ToolShell>
  );
}
