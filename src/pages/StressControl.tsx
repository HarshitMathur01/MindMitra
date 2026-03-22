import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronDown, ChevronRight, Flame, Check, BookOpen, Clock, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

// ── Types ────────────────────────────────────────────────────────────────────

type ThoughtRecord = {
  id: string;
  date: string;
  situation: string;
  automaticThought: string;
  emotion: string;
  intensity: number;
  evidenceFor: string;
  evidenceAgainst: string;
  balancedThought: string;
};

type Technique = {
  id: string;
  label: string;
  emoji: string;
  title: string;
  body: string;
  steps: string[];
};

type Module = {
  week: number;
  title: string;
  description: string;
  topics: string[];
};

// ── Static data ───────────────────────────────────────────────────────────────

const TECHNIQUES: Technique[] = [
  {
    id: "abcde",
    label: "ABCDE Model",
    emoji: "🔤",
    title: "ABCDE Cognitive Model",
    body: "Developed by Albert Ellis, this model helps you understand how your beliefs about events — not the events themselves — shape how you feel.",
    steps: [
      "A — Activating event: What happened?",
      "B — Belief: What did you tell yourself?",
      "C — Consequence: How did you feel/behave?",
      "D — Dispute: Is the belief accurate or helpful?",
      "E — Effect: What's a more balanced belief?",
    ],
  },
  {
    id: "thought-record",
    label: "Thought Record",
    emoji: "📝",
    title: "7-Column Thought Record",
    body: "A structured CBT tool that helps you notice, examine, and reframe distorted thinking patterns before they fuel stress.",
    steps: [
      "Write the triggering situation",
      "Identify automatic thoughts",
      "Name the emotion and rate intensity 0–10",
      "List evidence that supports the thought",
      "List evidence that contradicts the thought",
      "Generate a balanced, alternative thought",
      "Re-rate emotion intensity after reframing",
    ],
  },
  {
    id: "worry-time",
    label: "Worry Time",
    emoji: "⏰",
    title: "Scheduled Worry Time",
    body: "Rather than trying to suppress worry, you contain it to a specific 15-minute window each day — which reduces its grip on the rest of your day.",
    steps: [
      "Choose a fixed 15-minute worry slot daily (not close to bedtime)",
      "When worries arise outside that time, postpone them",
      "At your worry slot, write each worry down",
      "Problem-solve what you can; accept what you can't",
      "Close the notebook — the slot is over",
    ],
  },
  {
    id: "pmr",
    label: "PMR",
    emoji: "💪",
    title: "Progressive Muscle Relaxation",
    body: "Systematically tensing and releasing muscle groups teaches your body the difference between tension and relaxation, lowering physical stress arousal.",
    steps: [
      "Sit or lie in a comfortable position",
      "Tense each muscle group for 5 seconds",
      "Release the tension and notice the contrast for 10 seconds",
      "Work from feet → calves → thighs → abdomen → hands → shoulders → face",
      "Breathe slowly throughout — inhale on tense, exhale on release",
    ],
  },
  {
    id: "behavioral",
    label: "Behavioral Activation",
    emoji: "🚀",
    title: "Behavioral Activation",
    body: "Stress and low mood often lead to withdrawal, which deepens the cycle. Behavioral Activation breaks this by scheduling small, positive activities.",
    steps: [
      "List activities that used to give you energy or pleasure",
      "Schedule 1–2 small activities daily (15–30 min each)",
      "Do them regardless of mood — action precedes motivation",
      "Rate mood before and after each activity",
      "Gradually increase frequency as momentum builds",
    ],
  },
];

const MODULES: Module[] = [
  {
    week: 1,
    title: "Understanding Stress",
    description: "Learn the biology of stress, recognise your personal triggers, and build your stress map.",
    topics: ["Fight-or-flight response", "Personal stress triggers", "Stress diary", "Psychoeducation"],
  },
  {
    week: 2,
    title: "Identifying Thought Patterns",
    description: "Spot cognitive distortions — the mental shortcuts that amplify stress.",
    topics: ["All-or-nothing thinking", "Catastrophising", "Mind-reading", "Should statements"],
  },
  {
    week: 3,
    title: "Cognitive Restructuring",
    description: "Challenge and replace distorted thoughts with balanced, evidence-based alternatives.",
    topics: ["Thought Records", "ABCDE Model", "Socratic questioning", "Core beliefs"],
  },
  {
    week: 4,
    title: "Behavioral Activation",
    description: "Break the avoidance cycle by scheduling positive, energising activities.",
    topics: ["Activity scheduling", "Pleasure/mastery ratio", "Anti-procrastination", "Graded exposure"],
  },
  {
    week: 5,
    title: "Maintaining Progress",
    description: "Build a personal relapse-prevention plan and sustain your gains long-term.",
    topics: ["Stress early-warning signs", "Personal toolkit", "Maintenance plan", "Self-compassion"],
  },
];

const WEEK_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

const EMOTIONS = ["Anxious", "Overwhelmed", "Frustrated", "Sad", "Angry", "Ashamed", "Fearful"];

const STEP_LABELS = ["Situation", "Automatic Thought", "Emotion", "Intensity", "Evidence For", "Evidence Against", "Balanced Thought"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayKey() {
  return new Date().toISOString().split("T")[0]!;
}

function getStreak(): number {
  try {
    return parseInt(localStorage.getItem("mm_cbt_streak") ?? "0", 10);
  } catch {
    return 0;
  }
}

function bumpStreak() {
  const last = localStorage.getItem("mm_cbt_streak_date");
  const today = todayKey();
  if (last === today) return;
  const streak = getStreak();
  localStorage.setItem("mm_cbt_streak", String(streak + 1));
  localStorage.setItem("mm_cbt_streak_date", today);
}

function getWeekActivity(): boolean[] {
  const today = new Date();
  const dayOfWeek = (today.getDay() + 6) % 7; // 0=Mon
  const records: ThoughtRecord[] = JSON.parse(localStorage.getItem("mm_cbt_records") ?? "[]");
  const recordDates = new Set(records.map((r) => r.date));
  return WEEK_LABELS.map((_, i) => {
    if (i > dayOfWeek) return false;
    const d = new Date(today);
    d.setDate(d.getDate() - (dayOfWeek - i));
    return recordDates.has(d.toISOString().split("T")[0]!);
  });
}

// ── Fade-up animation variant ─────────────────────────────────────────────────

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, ease: [0, 0, 0.58, 1] as [number, number, number, number], delay },
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StressControl() {
  const navigate = useNavigate();

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [situation, setSituation] = useState("");
  const [automaticThought, setAutomaticThought] = useState("");
  const [emotion, setEmotion] = useState(EMOTIONS[0]!);
  const [intensity, setIntensity] = useState(5);
  const [evidenceFor, setEvidenceFor] = useState("");
  const [evidenceAgainst, setEvidenceAgainst] = useState("");
  const [balancedThought, setBalancedThought] = useState("");
  const [saved, setSaved] = useState(false);

  // Confetti
  const [confetti, setConfetti] = useState<{ id: number; x: number; color: string }[]>([]);
  const confettiId = useRef(0);

  // Technique library
  const [selectedTechnique, setSelectedTechnique] = useState<string | null>(null);

  // Curriculum accordion
  const [openModule, setOpenModule] = useState<number | null>(null);

  // Streak + week activity
  const [streak] = useState(getStreak);
  const [weekActivity] = useState(getWeekActivity);
  const todayDotIdx = (new Date().getDay() + 6) % 7;

  const daysCompleted = weekActivity.filter(Boolean).length;
  const ringR = 44;
  const ringSize = 104;
  const circ = 2 * Math.PI * ringR;
  const dashOffset = circ * (1 - daysCompleted / 7);

  const canSave =
    situation.trim().length > 0 &&
    automaticThought.trim().length > 0 &&
    balancedThought.trim().length > 0;

  // Count filled form fields for progress indicator
  const filledSteps = [
    situation.trim().length > 0,
    automaticThought.trim().length > 0,
    true, // emotion always selected
    true, // intensity always set
    evidenceFor.trim().length > 0,
    evidenceAgainst.trim().length > 0,
    balancedThought.trim().length > 0,
  ].filter(Boolean).length;

  function handleSave() {
    if (!canSave) return;
    const record: ThoughtRecord = {
      id: Date.now().toString(),
      date: todayKey(),
      situation,
      automaticThought,
      emotion,
      intensity,
      evidenceFor,
      evidenceAgainst,
      balancedThought,
    };
    const existing: ThoughtRecord[] = JSON.parse(localStorage.getItem("mm_cbt_records") ?? "[]");
    localStorage.setItem("mm_cbt_records", JSON.stringify([record, ...existing]));
    bumpStreak();

    const burst = Array.from({ length: 5 }, (_, i) => ({
      id: confettiId.current++,
      x: 30 + i * 10,
      color: ["#f59e0b", "#fbbf24", "#d97706", "#fde68a", "#f97316"][i]!,
    }));
    setConfetti(burst);
    setTimeout(() => setConfetti([]), 1400);

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setSituation("");
      setAutomaticThought("");
      setEmotion(EMOTIONS[0]!);
      setIntensity(5);
      setEvidenceFor("");
      setEvidenceAgainst("");
      setBalancedThought("");
      setFormOpen(false);
    }, 2000);
  }

  useEffect(() => () => {}, []);

  const activeTechnique = TECHNIQUES.find((t) => t.id === selectedTechnique) ?? null;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-md">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted transition-transform hover:scale-105 active:scale-95"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <h1 className="text-[17px] font-semibold">Stress Control</h1>
          <p className="text-xs text-muted-foreground">
            {streak > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium">{streak} day streak 🔥</span>
            ) : (
              "Evidence-based CBT program"
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
          <Flame className="h-3.5 w-3.5" />
          {streak}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ── Two-column grid on lg+ ── */}
        <div className="grid lg:grid-cols-2 gap-6">

          {/* ── LEFT COLUMN ── */}
          <div className="space-y-6">

            {/* ── Hero card ── */}
            <motion.section {...fadeUp(0.05)} className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 p-5 shadow-[0_14px_30px_rgba(15,23,42,0.07)]">
              {/* Decorative emoji */}
              <span className="pointer-events-none absolute right-4 top-3 text-5xl opacity-15 select-none" aria-hidden>🧠</span>

              <span className="inline-block rounded-full bg-amber-100 dark:bg-amber-900/40 px-3 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                CBT Program
              </span>
              <h2 className="mt-3 text-xl font-bold text-foreground">5-Week Stress Control Journey</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                An evidence-based Cognitive Behavioural Therapy program. Each week you'll build practical skills to understand, challenge, and rewrite the thoughts that fuel stress.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <span className="flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                  <BookOpen className="h-3 w-3" /> 5 Modules
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                  <Clock className="h-3 w-3" /> ~15 min/day
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                  <Zap className="h-3 w-3" /> Self-paced
                </span>
              </div>
            </motion.section>

            {/* ── Today's Exercise ── */}
            <motion.section {...fadeUp(0.10)} className="rounded-[24px] bg-card shadow-[0_14px_30px_rgba(15,23,42,0.06)] overflow-hidden">
              <button
                className="flex w-full items-center justify-between p-5 text-left"
                onClick={() => setFormOpen((v) => !v)}
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today's Exercise</p>
                  <h3 className="mt-0.5 text-base font-semibold">Thought Record</h3>
                  {formOpen && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Step{" "}
                      <span className="font-semibold text-amber-600 dark:text-amber-400">{filledSteps}</span>
                      {" "}/ {STEP_LABELS.length} filled
                    </p>
                  )}
                </div>
                <motion.div animate={{ rotate: formOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                </motion.div>
              </button>

              <AnimatePresence initial={false}>
                {formOpen && (
                  <motion.div
                    key="form"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border px-5 pb-5 space-y-4 pt-4">

                      {/* Step 1 — Situation */}
                      <div>
                        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white">1</span>
                          Situation
                        </label>
                        <textarea
                          value={situation}
                          onChange={(e) => setSituation(e.target.value)}
                          placeholder="Briefly describe what happened..."
                          rows={2}
                          className="w-full rounded-xl border border-border bg-amber-50/40 dark:bg-amber-500/5 px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-amber-50 dark:focus:bg-amber-500/10 transition-colors resize-none"
                        />
                      </div>

                      {/* Step 2 — Automatic thought */}
                      <div>
                        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white">2</span>
                          Automatic Thought
                        </label>
                        <textarea
                          value={automaticThought}
                          onChange={(e) => setAutomaticThought(e.target.value)}
                          placeholder="What went through your mind in that moment?"
                          rows={2}
                          className="w-full rounded-xl border border-border bg-amber-50/40 dark:bg-amber-500/5 px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-amber-50 dark:focus:bg-amber-500/10 transition-colors resize-none"
                        />
                      </div>

                      {/* Steps 3 & 4 — Emotion + Intensity (2-col on sm+) */}
                      <div className="grid sm:grid-cols-2 gap-4">
                        {/* Step 3 — Emotion */}
                        <div>
                          <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1.5">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white">3</span>
                            Emotion
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {EMOTIONS.map((e) => (
                              <button
                                key={e}
                                onClick={() => setEmotion(e)}
                                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                                  emotion === e
                                    ? "bg-amber-500 text-white"
                                    : "bg-muted text-muted-foreground hover:bg-amber-100 dark:hover:bg-amber-900/30"
                                }`}
                              >
                                {e}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Step 4 — Intensity */}
                        <div>
                          <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1.5">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white">4</span>
                            Intensity:{" "}
                            <span className="text-amber-600 dark:text-amber-400 font-bold">{intensity}/10</span>
                          </label>
                          <input
                            type="range"
                            min={1} max={10}
                            value={intensity}
                            onChange={(e) => setIntensity(Number(e.target.value))}
                            className="w-full accent-amber-500"
                          />
                          <div className="flex justify-between text-[10px] text-muted-foreground/60 mt-0.5">
                            <span>Mild</span><span>Moderate</span><span>Intense</span>
                          </div>
                        </div>
                      </div>

                      {/* Step 5 — Evidence for */}
                      <div>
                        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white">5</span>
                          Evidence Supporting the Thought
                        </label>
                        <textarea
                          value={evidenceFor}
                          onChange={(e) => setEvidenceFor(e.target.value)}
                          placeholder="What facts support this thought?"
                          rows={2}
                          className="w-full rounded-xl border border-border bg-amber-50/40 dark:bg-amber-500/5 px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-amber-50 dark:focus:bg-amber-500/10 transition-colors resize-none"
                        />
                      </div>

                      {/* Step 6 — Evidence against */}
                      <div>
                        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white">6</span>
                          Evidence Against the Thought
                        </label>
                        <textarea
                          value={evidenceAgainst}
                          onChange={(e) => setEvidenceAgainst(e.target.value)}
                          placeholder="What facts contradict this thought?"
                          rows={2}
                          className="w-full rounded-xl border border-border bg-amber-50/40 dark:bg-amber-500/5 px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-amber-50 dark:focus:bg-amber-500/10 transition-colors resize-none"
                        />
                      </div>

                      {/* Step 7 — Balanced thought */}
                      <div>
                        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white">7</span>
                          Balanced / Alternative Thought
                        </label>
                        <textarea
                          value={balancedThought}
                          onChange={(e) => setBalancedThought(e.target.value)}
                          placeholder="A more accurate, balanced way to see this..."
                          rows={2}
                          className="w-full rounded-xl border border-border bg-amber-50/40 dark:bg-amber-500/5 px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-amber-50 dark:focus:bg-amber-500/10 transition-colors resize-none"
                        />
                      </div>

                      {/* Save button */}
                      <div className="relative">
                        <button
                          onClick={handleSave}
                          disabled={!canSave}
                          className={`relative w-full rounded-full py-3 text-sm font-semibold transition-all duration-200 overflow-hidden ${
                            canSave
                              ? "bg-amber-500 text-white hover:scale-[1.02] active:scale-[0.98] shadow-[0_4px_14px_rgba(245,158,11,0.35)]"
                              : "bg-muted text-muted-foreground cursor-not-allowed"
                          }`}
                        >
                          <AnimatePresence mode="wait">
                            {saved ? (
                              <motion.span
                                key="saved"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className="flex items-center justify-center gap-2"
                              >
                                <Check className="h-4 w-4" /> Saved!
                              </motion.span>
                            ) : (
                              <motion.span key="save" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                Save Thought Record
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </button>

                        {/* Confetti */}
                        <AnimatePresence>
                          {confetti.map((p) => (
                            <motion.div
                              key={p.id}
                              className="pointer-events-none absolute bottom-3 rounded-full"
                              style={{ left: `${p.x}%`, width: 8, height: 8, backgroundColor: p.color }}
                              initial={{ y: 0, opacity: 1, scale: 1 }}
                              animate={{ y: -80, opacity: 0, scale: 0.6, x: (p.x % 2 === 0 ? 1 : -1) * 20 }}
                              transition={{ duration: 1.2, ease: "easeOut" }}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>

          </div>{/* end LEFT COLUMN */}

          {/* ── RIGHT COLUMN ── */}
          <div className="space-y-6">

            {/* ── Weekly Progress ── */}
            <motion.section {...fadeUp(0.10)} className="rounded-[24px] bg-card p-5 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
              <h3 className="text-sm font-semibold text-foreground">This Week</h3>
              <div className="mt-4 flex items-center gap-5">
                {/* SVG ring — 104px */}
                <div className="relative shrink-0 flex items-center justify-center">
                  <svg width={ringSize} height={ringSize} className="-rotate-90">
                    <circle
                      cx={ringSize / 2} cy={ringSize / 2} r={ringR}
                      fill="none" stroke="currentColor" strokeWidth="7"
                      className="text-muted/30"
                    />
                    <motion.circle
                      cx={ringSize / 2} cy={ringSize / 2} r={ringR}
                      fill="none" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round"
                      style={{ strokeDasharray: circ }}
                      animate={{ strokeDashoffset: dashOffset }}
                      transition={{ duration: 0.9, ease: "easeOut" }}
                    />
                  </svg>
                  <div className="absolute text-center">
                    <p className="text-2xl font-bold text-foreground leading-none">{daysCompleted}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">/ 7 days</p>
                  </div>
                </div>

                {/* 7-day dots */}
                <div className="flex flex-1 justify-between">
                  {WEEK_LABELS.map((label, i) => (
                    <div key={`${label}-${i}`} className="flex flex-col items-center gap-1.5">
                      <span className={`text-[11px] font-medium ${i === todayDotIdx ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                        {label}
                      </span>
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center text-sm transition-colors ${
                          i === todayDotIdx
                            ? "border-2 border-amber-400 bg-amber-50 dark:bg-amber-500/10 mm-today-pulse"
                            : weekActivity[i]
                            ? "bg-amber-400 text-white"
                            : i <= todayDotIdx
                            ? "border border-dashed border-border"
                            : "bg-muted/30"
                        }`}
                      >
                        {weekActivity[i] && i !== todayDotIdx ? "✓" : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {daysCompleted === 0
                  ? "Start today — every record builds the skill."
                  : daysCompleted >= 5
                  ? "Outstanding consistency this week! 🔥"
                  : `${daysCompleted} day${daysCompleted > 1 ? "s" : ""} active — keep the momentum going.`}
              </p>
            </motion.section>

            {/* ── CBT Techniques Library ── */}
            <motion.section {...fadeUp(0.15)} className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground px-0.5">Techniques Library</h3>

              {/* Chip grid — 2-col on sm+, scroll on mobile */}
              <div className="flex gap-2.5 overflow-x-auto pb-1 sm:overflow-visible sm:grid sm:grid-cols-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {TECHNIQUES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTechnique((prev) => (prev === t.id ? null : t.id))}
                    className={`flex shrink-0 sm:shrink items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-150 ${
                      selectedTechnique === t.id
                        ? "bg-amber-500 text-white shadow-md"
                        : "bg-background border border-border text-foreground shadow-[0_2px_8px_rgba(15,23,42,0.06)] hover:bg-amber-50 dark:hover:bg-amber-500/10"
                    }`}
                  >
                    <span>{t.emoji}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Technique detail */}
              <AnimatePresence>
                {activeTechnique && (
                  <motion.div
                    key={activeTechnique.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.25 }}
                    className="rounded-[20px] border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-500/10 p-5 shadow-[0_8px_20px_rgba(15,23,42,0.05)]"
                  >
                    <p className="text-lg font-bold">{activeTechnique.emoji} {activeTechnique.title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{activeTechnique.body}</p>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">How to use</p>
                    <ol className="mt-2 space-y-2">
                      {activeTechnique.steps.map((step, i) => (
                        <li key={i} className="flex gap-3 text-sm">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white">
                            {i + 1}
                          </span>
                          <span className="text-foreground/80 leading-snug">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>

          </div>{/* end RIGHT COLUMN */}

        </div>{/* end grid */}

        {/* ── 5-Module Curriculum (full width) ── */}
        <motion.section {...fadeUp(0.20)} className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground px-0.5">5-Week Curriculum</h3>
          <div className="rounded-[24px] bg-card shadow-[0_14px_30px_rgba(15,23,42,0.06)] overflow-hidden divide-y divide-border">
            {MODULES.map((mod) => (
              <div key={mod.week}>
                <button
                  className="flex w-full items-center gap-3 px-5 py-4 text-left group"
                  onClick={() => setOpenModule((prev) => (prev === mod.week ? null : mod.week))}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    openModule === mod.week
                      ? "bg-amber-500 text-white"
                      : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                  }`}>
                    W{mod.week}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{mod.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{mod.description}</p>
                  </div>
                  <motion.div animate={{ rotate: openModule === mod.week ? 90 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-amber-500 transition-colors" />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {openModule === mod.week && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-4 pt-1 space-y-2">
                        <p className="text-sm text-muted-foreground leading-relaxed">{mod.description}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {mod.topics.map((topic) => (
                            <span key={topic} className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                              {topic}
                            </span>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Bottom padding */}
        <div className="h-6" />
      </main>
    </div>
  );
}
