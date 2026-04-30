import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Compass,
  Dumbbell,
  MessageCircle,
  Stethoscope,
  Wind,
} from "lucide-react";

import Header from "@/components/layout/Header";
import HillsFooter from "@/components/layout/HillsFooter";
import PageShell from "@/components/layout/PageShell";
import { WatercolorScene } from "@/components/layout/WatercolorScene";
import { PeachBlush } from "@/components/layout/PeachBlush";
import Pulse from "@/components/identity/Pulse";
import { useAuth } from "@/hooks/useAuth";
import { DashboardSkeleton } from "@/components/layout/DashboardSkeleton";
import PublicLanding from "./PublicLanding";
import { DURATION, EASE } from "@/lib/redesign/tokens";
import SEO from "@/components/system/SEO";
import { ROUND_THE_CLOCK_HELPLINE, helplineHref } from "@/lib/helplines";

/**
 * Logged-in dashboard — Quiet Companion language.
 *
 * Three calm bands:
 *   1. Now      — greeting + Pulse + 1-tap mood + Open conversation
 *   2. Continue — return to the conversation + a single suggested ritual
 *   3. Library  — Resources / Mind Gym / Therapist Bridge (low key)
 *
 * Backdrop is a watercolor scene (not a stock photo) and an ambient
 * peach-blush wash. No gradient overlays, no shadows on the CTA.
 */

type MoodChip = {
  emoji: string;
  label: string;
};

const moods: MoodChip[] = [
  { emoji: "🌧", label: "Heavy" },
  { emoji: "🌫", label: "Foggy" },
  { emoji: "🌤", label: "Steady" },
  { emoji: "☀️", label: "Bright" },
  { emoji: "✨", label: "Light" },
];

const MOOD_STORAGE_KEY = "mm.dashboard.mood.today";

const dailyRituals = [
  {
    icon: Wind,
    title: "Two-minute breath",
    body: "Resonant breathing — six cycles. Best done sitting up.",
    route: "/breathe",
  },
  {
    icon: BookOpen,
    title: "One-line journal",
    body: "Name the loudest feeling. That's the whole exercise.",
    route: "/journal",
  },
  {
    icon: Dumbbell,
    title: "Thought detective",
    body: "A short reframe for one anxious thought you can't shake.",
    route: "/mindgym/thought-detective",
  },
];

function getGreeting(date: Date): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function todayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());
  const [mood, setMood] = useState<MoodChip | null>(null);

  useEffect(() => {
    const syncNow = () => setNow(new Date());
    const intervalId = window.setInterval(syncNow, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const currentDayKey = todayKey(now);
  const currentUtcDayKey = now.toISOString().slice(0, 10);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(MOOD_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { date: string; mood: MoodChip };
      if (parsed?.date === currentDayKey || parsed?.date === currentUtcDayKey) {
        setMood(parsed.mood);
      }
    } catch {
      /* ignore corrupted storage */
    }
  }, [currentDayKey, currentUtcDayKey]);

  const displayName = useMemo(() => {
    const raw =
      user?.user_metadata?.full_name ??
      user?.user_metadata?.name ??
      user?.email?.split("@")[0] ??
      "friend";
    return String(raw)
      .trim()
      .split(/[\s_-]+/)[0]
      .replace(/^./, (c) => c.toUpperCase());
  }, [user]);

  const ritual = dailyRituals[(now.getDate() + now.getMonth()) % dailyRituals.length];
  const RitualIcon = ritual.icon;

  const handleMoodSelect = (next: MoodChip) => {
    setMood(next);
    try {
      window.localStorage.setItem(
        MOOD_STORAGE_KEY,
        JSON.stringify({ date: currentDayKey, mood: next }),
      );
    } catch {
      /* ignore */
    }
  };

  if (loading) return <DashboardSkeleton />;
  if (!user) return <PublicLanding />;

  return (
    <>
      <SEO
        title="Your quiet companion"
        description="Pick up where you left off with Mitra. A calm, memory-driven AI companion for daily mental wellness — and a bridge to professional care when you need it."
        path="/"
      />
      <Header />
      <PageShell width="page" as="main" id="main-content">
        {/* ── Band 1 — Now ───────────────────────────────── */}
        <section className="relative isolate flex min-h-[68vh] flex-col items-center overflow-hidden pt-16 text-center sm:min-h-[72vh] sm:pt-24 lg:min-h-[78vh]">
          {/* Watercolor backdrop — soft, decorative, low contrast so
              the Pulse and copy stay primary. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 -z-20 mx-auto max-w-[1400px] opacity-55"
          >
            <WatercolorScene name="hills" loading="eager" maxRenderedWidth={1600} />
          </div>
          <PeachBlush position="top-center" size="lg" className="-z-10" />

          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: DURATION.long, ease: EASE.outExpo }}
          >
            <Pulse size={1} state={mood ? "warm" : "idle"} intensity={0.8} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: DURATION.long,
              delay: 0.08,
              ease: EASE.outExpo,
            }}
            className="mt-8 max-w-2xl"
          >
            <p className="qc-eyebrow">{getGreeting(now)}</p>
            <h1 className="qc-display mt-4 text-[clamp(2rem,4.5vw,3rem)]">
              Hello, {displayName}.
            </h1>
            <p className="mt-3 text-base leading-relaxed text-[color:var(--qc-ink-soft)]">
              {mood
                ? `Noted that today feels ${mood.label.toLowerCase()}. We'll go from there.`
                : "Tell Mitra one true thing about today."}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: DURATION.long,
              delay: 0.16,
              ease: EASE.outExpo,
            }}
            className="mt-8 flex w-full max-w-xl flex-col items-center gap-6"
          >
            <div className="flex flex-wrap justify-center gap-2">
              {moods.map((m) => {
                const isActive = mood?.label === m.label;
                return (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => handleMoodSelect(m)}
                    className={`group inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors ${
                      isActive
                        ? "border-[color:var(--qc-forest)] bg-[color:var(--qc-surface)] text-[color:var(--qc-forest)]"
                        : "border-[color:var(--qc-border-stronger)] bg-transparent text-[color:var(--qc-ink-muted)] hover:border-[color:var(--qc-ink-soft)] hover:text-[color:var(--qc-ink)]"
                    }`}
                  >
                    <span className="text-base leading-none">{m.emoji}</span>
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => navigate("/chat")}
              className="qc-pill-primary mt-2"
            >
              Open conversation
            </button>
          </motion.div>
        </section>

        {/* ── Band 2 — Continue ──────────────────────────── */}
        <section className="mt-24 sm:mt-32">
          <header className="flex items-end justify-between gap-4">
            <div>
              <p className="qc-eyebrow">Continue</p>
              <h2 className="qc-display mt-3 text-2xl sm:text-3xl">
                Pick up where you left off.
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigate("/chat")}
              className="hidden items-center gap-1 text-sm font-medium text-[color:var(--qc-ink-muted)] transition-colors hover:text-[color:var(--qc-ink)] sm:inline-flex"
            >
              All conversations
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </header>

          <div className="mt-8 grid gap-4 lg:grid-cols-5">
            <motion.button
              type="button"
              onClick={() => navigate("/chat")}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: DURATION.long, ease: EASE.outExpo }}
              className="group flex flex-col justify-between rounded-3xl border border-[color:var(--qc-border)] bg-[color:var(--qc-surface)] p-6 text-left transition-colors hover:border-[color:var(--qc-border-stronger)] sm:p-8 lg:col-span-3"
            >
              <div>
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--qc-sage)]/30 text-[color:var(--qc-forest)]">
                    <MessageCircle className="h-4 w-4" />
                  </span>
                  <span className="qc-eyebrow">Today's conversation</span>
                </div>
                <p className="qc-display mt-6 text-xl leading-snug sm:text-2xl">
                  Return to Mitra. The thread is still open.
                </p>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-[color:var(--qc-ink-muted)]">
                  <span className="mitra-voice">
                    Mitra remembers what we talked about — no need to recap.
                  </span>{" "}
                  Sit down and start anywhere.
                </p>
              </div>
              <span className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-[color:var(--qc-forest)]">
                Open chat
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </motion.button>

            <motion.button
              type="button"
              onClick={() => navigate(ritual.route)}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                duration: DURATION.long,
                delay: 0.06,
                ease: EASE.outExpo,
              }}
              className="group flex flex-col justify-between rounded-3xl border border-[color:var(--qc-border)] bg-transparent p-6 text-left transition-colors hover:border-[color:var(--qc-border-stronger)] sm:p-8 lg:col-span-2"
            >
              <div>
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--qc-sage)]/30 text-[color:var(--qc-forest)]">
                    <RitualIcon className="h-4 w-4" />
                  </span>
                  <span className="qc-eyebrow">Suggested ritual</span>
                </div>
                <p className="qc-display mt-6 text-xl leading-snug sm:text-2xl">
                  {ritual.title}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-[color:var(--qc-ink-muted)]">
                  {ritual.body}
                </p>
              </div>
              <span className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-[color:var(--qc-forest)]">
                Begin
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </motion.button>
          </div>

          {/* Calm professional-care disclaimer. Reads as a gentle
              reminder, not an alert. */}
          <p className="mt-8 max-w-2xl text-sm leading-relaxed text-[color:var(--qc-ink-muted)]">
            <span className="mitra-voice">
              Mitra is a companion, not a clinician — a bridge to professional
              care, not a replacement.
            </span>{" "}
            <Link
              to="/therapy"
              className="font-medium text-[color:var(--qc-ink)] underline decoration-[color:var(--qc-sage)] underline-offset-4 transition-colors hover:decoration-[color:var(--qc-forest)]"
            >
              Find a therapist
            </Link>
            {", or call "}
            <a
              href={helplineHref(ROUND_THE_CLOCK_HELPLINE)}
              className="font-medium text-[color:var(--qc-ink)] underline decoration-[color:var(--qc-sage)] underline-offset-4 transition-colors hover:decoration-[color:var(--qc-forest)]"
            >
              {ROUND_THE_CLOCK_HELPLINE.name} ({ROUND_THE_CLOCK_HELPLINE.display})
            </a>
            {" — 24/7, free."}
          </p>
        </section>

        {/* ── Band 3 — Library shortcuts ─────────────────── */}
        <section className="mt-24 pb-24 sm:mt-32 sm:pb-32">
          <header>
            <p className="qc-eyebrow">Library</p>
            <h2 className="qc-display mt-3 text-2xl sm:text-3xl">
              When you need something else.
            </h2>
          </header>

          <ul className="mt-8 grid gap-px overflow-hidden rounded-3xl border border-[color:var(--qc-border)] bg-[color:var(--qc-border-stronger)] sm:grid-cols-2">
            <motion.li
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: DURATION.long, ease: EASE.outExpo }}
              className="bg-[color:var(--qc-surface)]"
            >
              <button
                type="button"
                onClick={() => navigate("/psychological-content")}
                className="group flex h-full w-full flex-col items-start gap-4 p-7 text-left sm:p-8"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--qc-sage)]/30 text-[color:var(--qc-forest)]">
                  <Compass className="h-4 w-4" />
                </span>
                <div>
                  <p className="qc-display text-lg">Resources</p>
                  <p className="mt-1.5 max-w-md text-sm leading-relaxed text-[color:var(--qc-ink-muted)]">
                    Short, evidence-based reads. Categorized by what you might
                    actually be looking for at 1am.
                  </p>
                </div>
                <span className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-[color:var(--qc-forest)]">
                  Browse the shelf
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            </motion.li>

            <motion.li
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                duration: DURATION.long,
                delay: 0.06,
                ease: EASE.outExpo,
              }}
              className="bg-[color:var(--qc-surface)]"
            >
              <button
                type="button"
                onClick={() => navigate("/mindgym")}
                className="group flex h-full w-full flex-col items-start gap-4 p-7 text-left sm:p-8"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--qc-sage)]/30 text-[color:var(--qc-forest)]">
                  <Dumbbell className="h-4 w-4" />
                </span>
                <div>
                  <p className="qc-display text-lg">Mind Gym</p>
                  <p className="mt-1.5 max-w-md text-sm leading-relaxed text-[color:var(--qc-ink-muted)]">
                    Two-minute exercises. Pick one when sitting still feels too
                    big.
                  </p>
                </div>
                <span className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-[color:var(--qc-forest)]">
                  Open Mind Gym
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            </motion.li>
          </ul>

          <div className="mt-6 flex flex-col items-start justify-between gap-3 rounded-2xl border border-[color:var(--qc-border)] bg-[color:var(--qc-surface)] p-5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--qc-canvas)] text-[color:var(--qc-ink-soft)]">
                <Stethoscope className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-[color:var(--qc-ink)]">
                  Talk to a real person
                </p>
                <p className="text-sm text-[color:var(--qc-ink-muted)]">
                  Vetted therapists. Your context goes with you — never raw chat.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/therapist-bridge")}
              className="qc-pill-outline"
            >
              Therapist Bridge
              <ArrowRight className="ml-1 h-4 w-4" />
            </button>
          </div>
        </section>
      </PageShell>
      <HillsFooter />
    </>
  );
};

export default Index;
