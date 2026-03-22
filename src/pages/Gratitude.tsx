import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronDown, ChevronUp, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";

type GratitudeEntry = {
  id: string;
  date: string; // ISO string
  items: [string, string, string];
};

const STORAGE_KEY = "mm_gratitude_entries";
const STREAK_KEY = "mm_gratitude_streak";

const PLACEHOLDERS: [string, string, string] = [
  "A person who made me smile today...",
  "A moment of peace or beauty I noticed...",
  "Something my body or mind did well...",
];

const CARD_COLORS = [
  "bg-pink-50 dark:bg-pink-500/10 border-pink-100 dark:border-pink-500/20",
  "bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20",
  "bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20",
];

const BADGE_COLORS = [
  "bg-pink-500 text-white",
  "bg-rose-500 text-white",
  "bg-amber-500 text-white",
];

const AFFIRMATIONS_AFTER_SAVE = [
  "Gratitude rewires the brain for joy. ✨",
  "You just grew your happiness muscles. 🌱",
  "Science says this works. Your heart agrees. 💛",
  "Three more reasons the world is worth it. 🌸",
  "You noticed beauty. That is a superpower. 🦋",
];

function loadEntries(): GratitudeEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveEntries(entries: GratitudeEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function loadStreak(): number {
  try { return parseInt(localStorage.getItem(STREAK_KEY) || "0", 10); }
  catch { return 0; }
}

function saveStreak(n: number) {
  localStorage.setItem(STREAK_KEY, String(n));
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function groupByWeek(entries: GratitudeEntry[]): { label: string; entries: GratitudeEntry[] }[] {
  const groups: Record<string, GratitudeEntry[]> = {};
  entries.forEach((e) => {
    const d = new Date(e.date);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().split("T")[0];
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, entries]) => ({
      label: `Week of ${new Date(key).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      entries,
    }));
}

// Confetti particle
function ConfettiParticle({ delay }: { delay: number }) {
  const colors = ["#f472b6", "#fb7185", "#fbbf24", "#34d399", "#60a5fa"];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const x = Math.random() * 300 - 150;
  return (
    <motion.div
      initial={{ opacity: 1, y: 0, x: 0, rotate: 0, scale: 1 }}
      animate={{ opacity: 0, y: -200, x, rotate: 360, scale: 0.5 }}
      transition={{ duration: 1.2, delay, ease: "easeOut" }}
      className="absolute left-1/2 top-1/2 h-3 w-3 rounded-sm"
      style={{ backgroundColor: color }}
    />
  );
}

export default function Gratitude() {
  const navigate = useNavigate();
  const [items, setItems] = useState<[string, string, string]>(["", "", ""]);
  const [entries, setEntries] = useState<GratitudeEntry[]>(loadEntries);
  const [streak, setStreak] = useState(loadStreak);
  const [showConfetti, setShowConfetti] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const confettiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  const canSave = items.some((i) => i.trim().length > 0);

  const handleSave = () => {
    const entry: GratitudeEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      items: [items[0].trim() || "—", items[1].trim() || "—", items[2].trim() || "—"],
    };
    const updated = [entry, ...entries];
    setEntries(updated);
    saveEntries(updated);
    const newStreak = streak + 1;
    setStreak(newStreak);
    saveStreak(newStreak);
    setItems(["", "", ""]);
    setShowConfetti(true);
    const msg = AFFIRMATIONS_AFTER_SAVE[Math.floor(Math.random() * AFFIRMATIONS_AFTER_SAVE.length)];
    setSavedMessage(msg);
    if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
    confettiTimeoutRef.current = setTimeout(() => { setShowConfetti(false); setSavedMessage(null); }, 3500);
  };

  const weekGroups = useMemo(() => groupByWeek(entries), [entries]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-rose-50 to-background dark:from-[#1a0a10] dark:via-[#1a0810] dark:to-background">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-safe pt-5 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 dark:bg-white/10 shadow-sm transition-transform hover:scale-105 active:scale-95"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="text-center">
          <h1 className="text-[17px] font-semibold text-foreground">Gratitude</h1>
          <p className="text-xs text-muted-foreground">{today}</p>
        </div>
        <div className="flex h-10 items-center gap-1 rounded-full bg-white/80 dark:bg-white/10 px-3 shadow-sm">
          <span className="text-sm">🔥</span>
          <span className="text-sm font-semibold text-foreground">{streak}</span>
        </div>
      </div>

      <div className="px-5 pb-20 space-y-5">
        {/* Intro */}
        <div className="text-center pt-2 pb-1">
          <Heart className="mx-auto h-8 w-8 text-pink-400 mb-2" />
          <h2 className="text-xl font-bold text-foreground">What are you grateful for?</h2>
          <p className="mt-1 text-sm text-muted-foreground">Three small things. Big shifts.</p>
        </div>

        {/* 3 input cards */}
        {items.map((item, i) => (
          <div
            key={i}
            className={`relative rounded-[22px] border p-5 ${CARD_COLORS[i]}`}
          >
            <div className="flex items-start gap-3">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${BADGE_COLORS[i]}`}>
                {i + 1}
              </span>
              <textarea
                value={item}
                onChange={(e) => {
                  const updated = [...items] as [string, string, string];
                  updated[i] = e.target.value;
                  setItems(updated);
                }}
                placeholder={PLACEHOLDERS[i]}
                rows={2}
                className="flex-1 resize-none bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60"
              />
            </div>
          </div>
        ))}

        {/* Confetti overlay */}
        <AnimatePresence>
          {showConfetti && (
            <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
              {Array.from({ length: 18 }).map((_, i) => (
                <ConfettiParticle key={i} delay={i * 0.04} />
              ))}
              <motion.div
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="rounded-[28px] bg-white dark:bg-zinc-900 px-8 py-6 shadow-2xl text-center"
              >
                <span className="text-4xl">💖</span>
                <p className="mt-3 text-sm font-semibold text-foreground max-w-[220px]">
                  {savedMessage}
                </p>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Save button */}
        <motion.button
          onClick={handleSave}
          disabled={!canSave}
          whileTap={{ scale: 0.97 }}
          className="flex w-full items-center justify-center gap-2 rounded-[22px] bg-pink-500 py-4 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(236,72,153,0.3)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Heart className="h-4 w-4" />
          Save & Reflect
        </motion.button>

        {/* Past entries */}
        {weekGroups.length > 0 && (
          <section className="space-y-3 pt-2">
            <h2 className="text-[15px] font-semibold text-foreground">Past Entries</h2>
            {weekGroups.map((group) => (
              <div key={group.label} className="rounded-[22px] border border-border bg-card shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedWeek(expandedWeek === group.label ? null : group.label)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                >
                  <span className="text-sm font-medium text-foreground">{group.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{group.entries.length} entries</span>
                    {expandedWeek === group.label
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    }
                  </div>
                </button>
                <AnimatePresence>
                  {expandedWeek === group.label && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="divide-y divide-border border-t border-border">
                        {group.entries.map((entry) => (
                          <div key={entry.id} className="px-5 py-4 space-y-2">
                            <p className="text-[11px] text-muted-foreground font-medium">{formatDate(entry.date)}</p>
                            {entry.items.map((item, j) => (
                              <div key={j} className="flex items-start gap-2.5">
                                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${BADGE_COLORS[j]}`}>
                                  {j + 1}
                                </span>
                                <p className="text-sm text-foreground leading-relaxed">{item}</p>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
