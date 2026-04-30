import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

import Header from "@/components/layout/Header";
import HillsFooter from "@/components/layout/HillsFooter";
import PageShell from "@/components/layout/PageShell";
import { WatercolorScene } from "@/components/layout/WatercolorScene";
import { PeachBlush } from "@/components/layout/PeachBlush";
import { DURATION, EASE } from "@/lib/redesign/tokens";

type MoodTag = { emoji: string; label: string };

type JournalEntry = {
  id: string;
  date: string;
  text: string;
  mood: MoodTag | null;
  promptUsed: string | null;
  wordCount: number;
};

const MOODS: MoodTag[] = [
  { emoji: "🌧", label: "Heavy" },
  { emoji: "🌫", label: "Foggy" },
  { emoji: "🌤", label: "Steady" },
  { emoji: "☀️", label: "Bright" },
  { emoji: "✨", label: "Light" },
];

const PROMPTS = [
  "What felt heavy today, and what felt light?",
  "One small thing you're proud of this week.",
  "If today had a color, it would be… because…",
  "What is your mind returning to, over and over?",
  "Write about a moment today when you felt most like yourself.",
  "What are you avoiding thinking about? Why might that be?",
  "Describe something that surprised you lately.",
  "What would you tell yourself from one year ago?",
  "What does rest look like for you right now?",
  "Write about a relationship that is teaching you something.",
  "What boundary did you hold (or wish you had)?",
  "Finish this sentence: 'I feel safe when…'",
  "If your mood were weather right now, what would it be?",
  "What do you need to let go of before you sleep?",
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

  useEffect(
    () => () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    },
    [],
  );

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [text]);

  return (
    <>
      <Header />
      <PageShell width="page" as="main">
        {/* ── Hero ──────────────────────────────────────────── */}
        <section className="relative isolate pt-12 sm:pt-20">
          <PeachBlush position="top-right" size="md" className="-z-10" />
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-8 -z-10 hidden w-[420px] opacity-40 lg:block"
          >
            <WatercolorScene name="presence" maxRenderedWidth={480} loading="eager" />
          </div>

          <p className="qc-eyebrow">{formatDate(today)}</p>
          <h1 className="qc-display mt-4 max-w-2xl text-[clamp(2rem,4.5vw,3rem)]">
            One page. <span className="mitra-voice">Whatever you bring.</span>
          </h1>
          <p className="mt-4 max-w-prose text-base leading-relaxed text-[color:var(--qc-ink-soft)]">
            No streak. No score. Write a sentence or fill the page — both count.
          </p>
        </section>

        {/* ── Composer ──────────────────────────────────────── */}
        <section className="mt-12 max-w-2xl">
          <AnimatePresence>
            {promptVisible && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: DURATION.base, ease: EASE.outExpo }}
                className="mb-8 rounded-3xl border border-[color:var(--qc-border)] bg-[color:var(--qc-surface)] p-6 sm:p-8"
              >
                <p className="qc-eyebrow">A starting line</p>
                <p className="mitra-voice mt-3 text-lg leading-relaxed text-[color:var(--qc-ink)]">
                  {PROMPTS[promptIdx]}
                </p>
                <div className="mt-5 flex items-center gap-5 text-sm">
                  <button
                    type="button"
                    onClick={rotatePrompt}
                    className="inline-flex items-center gap-1.5 text-[color:var(--qc-forest)] transition-opacity hover:opacity-80"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Another
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromptVisible(false)}
                    className="text-[color:var(--qc-ink-muted)] transition-colors hover:text-[color:var(--qc-ink)]"
                  >
                    No prompt today
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="start anywhere."
              className="qc-display w-full min-h-[220px] resize-none border-0 border-b border-[color:var(--qc-border-stronger)] bg-transparent pb-4 text-xl leading-relaxed text-[color:var(--qc-ink)] outline-none placeholder:text-[color:var(--qc-ink-muted)] placeholder:opacity-60 focus:border-[color:var(--qc-forest)]"
              rows={6}
            />
            {wordCount > 0 && (
              <span className="mt-2 block text-right text-xs text-[color:var(--qc-ink-muted)]">
                {wordCount} {wordCount === 1 ? "word" : "words"}
              </span>
            )}
          </div>

          <div className="mt-8">
            <p className="qc-eyebrow">How does today sit</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {MOODS.map((m) => {
                const isActive = selectedMood?.label === m.label;
                return (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() =>
                      setSelectedMood(isActive ? null : m)
                    }
                    className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors ${
                      isActive
                        ? "border-[color:var(--qc-forest)] bg-[color:var(--qc-surface)] text-[color:var(--qc-forest)]"
                        : "border-[color:var(--qc-border-stronger)] text-[color:var(--qc-ink-muted)] hover:border-[color:var(--qc-ink-soft)] hover:text-[color:var(--qc-ink)]"
                    }`}
                  >
                    <span className="text-base leading-none">{m.emoji}</span>
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-10 flex items-center gap-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={!text.trim()}
              className="qc-pill-primary"
            >
              {saved ? "Kept" : "Keep this entry"}
            </button>
            {saved && (
              <span className="text-sm text-[color:var(--qc-ink-muted)]">
                <span className="mitra-voice">noted.</span>
              </span>
            )}
          </div>
        </section>

        {/* ── Past entries ──────────────────────────────────── */}
        {entries.length > 0 && (
          <section className="mt-24 max-w-2xl pb-24">
            <p className="qc-eyebrow">Earlier pages</p>
            <h2 className="qc-display mt-3 text-2xl sm:text-3xl">What you've written before.</h2>

            <div className="mt-8 space-y-4">
              {entries.map((entry) => {
                const isExpanded = expandedId === entry.id;
                return (
                  <article
                    key={entry.id}
                    className="rounded-3xl border border-[color:var(--qc-border)] bg-[color:var(--qc-surface)] p-5 sm:p-6"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      className="flex w-full items-start justify-between gap-3 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs text-[color:var(--qc-ink-muted)]">
                          {entry.mood && (
                            <span className="text-base leading-none">{entry.mood.emoji}</span>
                          )}
                          <span>{formatDate(entry.date)}</span>
                          <span>·</span>
                          <span>{entry.wordCount} words</span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[color:var(--qc-ink-soft)]">
                          {entry.text}
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-[color:var(--qc-ink-muted)]" />
                      ) : (
                        <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-[color:var(--qc-ink-muted)]" />
                      )}
                    </button>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: DURATION.base }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 border-t border-[color:var(--qc-border)] pt-4">
                            {entry.promptUsed && (
                              <p className="mb-3 text-xs italic text-[color:var(--qc-ink-muted)]">
                                Prompt: "{entry.promptUsed}"
                              </p>
                            )}
                            <p className="whitespace-pre-wrap text-base leading-relaxed text-[color:var(--qc-ink)]">
                              {entry.text}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </PageShell>
      <HillsFooter />
    </>
  );
}
