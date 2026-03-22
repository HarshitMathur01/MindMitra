import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, BookOpen, ChevronDown, ChevronUp, RefreshCw, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";

type MoodTag = { emoji: string; label: string };

type JournalEntry = {
  id: string;
  date: string; // ISO string
  text: string;
  mood: MoodTag | null;
  promptUsed: string | null;
  wordCount: number;
};

const MOODS: MoodTag[] = [
  { emoji: "😰", label: "Anxious" },
  { emoji: "😢", label: "Sad" },
  { emoji: "😐", label: "Neutral" },
  { emoji: "😊", label: "Happy" },
  { emoji: "🤩", label: "Excited" },
];

const PROMPTS = [
  "What felt heavy today, and what felt light?",
  "One small thing you're proud of this week.",
  "If today had a color, it would be... because...",
  "What is your mind returning to, over and over?",
  "Write about a moment today when you felt most like yourself.",
  "What are you avoiding thinking about? Why might that be?",
  "Describe something that surprised you lately.",
  "What would you tell yourself from one year ago?",
  "What does rest look like for you right now?",
  "Write about a relationship that is teaching you something.",
  "What are three things that felt good in your body today?",
  "What boundary did you hold (or wish you had)?",
  "Finish this sentence: 'I feel safe when...'",
  "What is your nervous system telling you today?",
  "If your mood were weather right now, what would it be?",
  "What do you need to let go of before you sleep?",
  "Describe a moment of unexpected beauty or kindness.",
  "What would you do if you weren't afraid?",
  "Write a letter to the person who hurt you — you don't have to send it.",
  "What is one thing you want to remember about today?",
];

const STORAGE_KEY = "mm_journal_entries";

function loadEntries(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEntries(entries: JournalEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function formatDate(isoString: string) {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function getWordCount(text: string) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export default function Journal() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [selectedMood, setSelectedMood] = useState<MoodTag | null>(null);
  const [promptIdx, setPromptIdx] = useState(() => Math.floor(Math.random() * PROMPTS.length));
  const [promptVisible, setPromptVisible] = useState(true);
  const [entries, setEntries] = useState<JournalEntry[]>(loadEntries);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const today = useMemo(() => new Date().toISOString(), []);
  const wordCount = getWordCount(text);

  const rotatePrompt = () => {
    setPromptIdx((i) => (i + 1) % PROMPTS.length);
    setPromptVisible(true);
  };

  const handleSave = () => {
    if (!text.trim()) return;
    const entry: JournalEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      text: text.trim(),
      mood: selectedMood,
      promptUsed: promptVisible ? PROMPTS[promptIdx] : null,
      wordCount,
    };
    const updated = [entry, ...entries];
    setEntries(updated);
    saveEntries(updated);
    setText("");
    setSelectedMood(null);
    setSaved(true);
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    savedTimeoutRef.current = setTimeout(() => setSaved(false), 2500);
  };

  useEffect(() => () => {
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
  }, []);

  // auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [text]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-background/95 px-5 pt-safe pt-5 pb-4 backdrop-blur">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-sm transition-transform hover:scale-105 active:scale-95"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="text-center">
          <h1 className="text-[17px] font-semibold text-foreground">Journal</h1>
          <p className="text-xs text-muted-foreground">{formatDate(today)}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-sm">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      <div className="px-5 pb-20 space-y-5">
        {/* Prompt card */}
        <AnimatePresence>
          {promptVisible && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-[22px] bg-yellow-50 dark:bg-yellow-500/10 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-yellow-700 dark:text-yellow-400 mb-2">
                    Today's Prompt
                  </p>
                  <p className="text-sm font-medium text-foreground leading-relaxed">
                    {PROMPTS[promptIdx]}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={rotatePrompt}
                  className="flex items-center gap-1.5 text-xs text-yellow-700 dark:text-yellow-400 font-medium"
                >
                  <RefreshCw className="h-3 w-3" />
                  New prompt
                </button>
                <span className="text-muted-foreground/40">·</span>
                <button
                  onClick={() => setPromptVisible(false)}
                  className="text-xs text-muted-foreground"
                >
                  Skip
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Writing area */}
        <div className="relative rounded-[22px] border border-border bg-card p-5 shadow-sm">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Start writing... let your thoughts flow freely."
            className="w-full min-h-[160px] resize-none bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60"
            rows={8}
          />
          {wordCount > 0 && (
            <span className="absolute bottom-4 right-5 text-[11px] text-muted-foreground/60">
              {wordCount} {wordCount === 1 ? "word" : "words"}
            </span>
          )}
        </div>

        {/* Mood selector */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">How are you feeling? (optional)</p>
          <div className="flex gap-2">
            {MOODS.map((m) => (
              <button
                key={m.label}
                onClick={() => setSelectedMood(selectedMood?.label === m.label ? null : m)}
                className={`flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-medium transition-all duration-150 ${
                  selectedMood?.label === m.label
                    ? "bg-primary/10 ring-2 ring-primary text-foreground scale-105"
                    : "bg-card border border-border text-muted-foreground hover:bg-card/80"
                }`}
              >
                <span className="text-xl">{m.emoji}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Save button */}
        <motion.button
          onClick={handleSave}
          disabled={!text.trim()}
          whileTap={{ scale: 0.97 }}
          className="flex w-full items-center justify-center gap-2 rounded-[22px] bg-primary py-4 text-sm font-semibold text-primary-foreground shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <AnimatePresence mode="wait">
            {saved ? (
              <motion.span
                key="saved"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                ✓ Saved
              </motion.span>
            ) : (
              <motion.span key="save" className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Save Entry
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Past entries */}
        {entries.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[15px] font-semibold text-foreground">Past Entries</h2>
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-[22px] border border-border bg-card p-4 shadow-sm"
              >
                <button
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  className="flex w-full items-start justify-between gap-3 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {entry.mood && <span className="text-base">{entry.mood.emoji}</span>}
                      <span className="text-[11px] text-muted-foreground">{formatDate(entry.date)}</span>
                      <span className="text-[11px] text-muted-foreground/60">· {entry.wordCount}w</span>
                    </div>
                    <p className="text-sm text-foreground line-clamp-2 leading-relaxed">
                      {entry.text}
                    </p>
                  </div>
                  {expandedId === entry.id ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  )}
                </button>
                <AnimatePresence>
                  {expandedId === entry.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t border-border">
                        {entry.promptUsed && (
                          <p className="mb-2 text-[11px] italic text-muted-foreground">
                            Prompt: "{entry.promptUsed}"
                          </p>
                        )}
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                          {entry.text}
                        </p>
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
