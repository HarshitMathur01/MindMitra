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
  "bg-[hsl(355,38%,96%)] dark:bg-[hsl(355,22%,17%)] border-[hsl(355,32%,88%)] dark:border-[hsl(355,22%,27%)]",
  "bg-[hsl(42,52%,95%)] dark:bg-[hsl(42,25%,17%)] border-[hsl(42,42%,87%)] dark:border-[hsl(42,25%,27%)]",
  "bg-[hsl(22,52%,95%)] dark:bg-[hsl(22,28%,17%)] border-[hsl(22,42%,87%)] dark:border-[hsl(22,28%,27%)]",
];

const CARD_ICONS = ["🌸", "🌿", "🍊"];

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
  const colors = ["#4ab8b8", "#a78bfa", "#fdba74", "#6ee7b7", "#fcd34d", "#67e8f9", "#c084fc"];
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
    <div className="relative isolate min-h-screen overflow-x-hidden bg-gradient-to-b from-[hsl(42,60%,97%)] via-[hsl(22,50%,96%)] to-[hsl(355,35%,96%)] dark:from-[#1c1208] dark:via-[#180e0a] dark:to-[#170b10]">

      {/* Decorative background blobs */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-20 h-80 w-80 rounded-full bg-[hsl(42,80%,78%)] opacity-35 blur-3xl dark:bg-[hsl(42,45%,18%)] dark:opacity-25"
        animate={{ scale: [1, 1.08, 1], opacity: [0.35, 0.50, 0.35] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute top-[40%] -left-28 h-72 w-72 rounded-full bg-[hsl(15,65%,82%)] opacity-30 blur-3xl dark:bg-[hsl(15,40%,18%)] dark:opacity-20"
        animate={{ scale: [1, 1.12, 1], opacity: [0.25, 0.40, 0.25] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 3 }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-[hsl(355,55%,84%)] opacity-30 blur-3xl dark:bg-[hsl(355,35%,17%)] dark:opacity-20"
        animate={{ scale: [1, 1.06, 1], opacity: [0.30, 0.45, 0.30] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-safe pt-5 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/60 backdrop-blur-sm dark:bg-white/8 shadow-sm transition-transform hover:scale-105 active:scale-95"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="text-center">
          <h1 className="text-[17px] font-semibold text-foreground">Gratitude</h1>
          <p className="text-xs text-muted-foreground">{today}</p>
        </div>
        <div className="flex h-10 items-center gap-1 rounded-full bg-white/60 backdrop-blur-sm dark:bg-white/8 px-3 shadow-sm">
          <span className="text-sm">🔥</span>
          <span className="text-sm font-semibold text-foreground">{streak}</span>
        </div>
      </div>

      <div className="px-5 pb-20 space-y-5">
        {/* Hero */}
        <motion.div
          className="text-center pt-2 pb-1"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="serene-float mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/50 backdrop-blur-sm shadow-sm dark:bg-white/10">
            <Heart className="h-7 w-7 text-[hsl(188,51%,38%)] dark:text-[hsl(188,55%,62%)]" />
          </div>
          <h2 className="text-xl font-bold text-foreground">What are you grateful for?</h2>
          <p className="mt-1.5 text-sm text-muted-foreground italic leading-relaxed">
            Notice three small things. Watch the world shift.
          </p>
        </motion.div>

        {/* 3 input cards */}
        {items.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 + i * 0.12, ease: "easeOut" }}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className={`relative rounded-[22px] border p-5 ${CARD_COLORS[i]}`}
          >
            <div className="flex items-start gap-3">
              <span className="shrink-0 text-xl leading-none select-none" aria-hidden>
                {CARD_ICONS[i]}
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
          </motion.div>
        ))}

        {/* Confetti overlay */}
        <AnimatePresence>
          {showConfetti && (
            <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-white/10 dark:bg-black/10">
              {Array.from({ length: 18 }).map((_, i) => (
                <ConfettiParticle key={i} delay={i * 0.04} />
              ))}
              <motion.div
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="rounded-[28px] bg-white/90 dark:bg-[hsl(196,30%,17%)]/90 backdrop-blur-md px-8 py-6 shadow-2xl text-center ring-1 ring-white/30 dark:ring-white/10"
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
          className="gradient-primary breathing-pulse flex w-full items-center justify-center gap-2 rounded-[22px] py-4 text-sm font-semibold text-white shadow-[0_8px_24px_hsl(188_51%_38%/0.28)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Heart className="h-4 w-4" />
          Save & Reflect
        </motion.button>

        {/* Past entries */}
        {weekGroups.length > 0 && (
          <section className="space-y-3 pt-2">
            <h2 className="text-[15px] font-semibold text-gradient">Past Entries</h2>
            {weekGroups.map((group) => (
              <div key={group.label} className="rounded-[22px] border border-border/60 bg-white/60 dark:bg-white/5 backdrop-blur-sm shadow-sm overflow-hidden">
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
                                <span
                                  aria-hidden
                                  className="mt-2 shrink-0 h-1.5 w-1.5 rounded-full bg-primary/50 dark:bg-primary/60"
                                />
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
