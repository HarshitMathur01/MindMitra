import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import Footer from "@/components/layout/Footer";
import PageShell from "@/components/layout/PageShell";
import Pulse from "@/components/identity/Pulse";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { DashboardSkeleton } from "@/components/layout/DashboardSkeleton";
import PublicLanding from "./PublicLanding";
import { DURATION, EASE } from "@/lib/redesign/tokens";

/**
 * Logged-in dashboard — "Quiet Companion" reset.
 *
 * Three calm bands instead of the previous photo-hero collage:
 *   1. Now           — greeting + Pulse + 1-tap mood + Open conversation
 *   2. Continue      — return to the conversation + a single suggested ritual
 *   3. Library       — Resources / Mind Gym pick / Therapist Bridge (low key)
 *
 * Keeps:
 *   - Refresh-aware nature backdrop behind the Now band
 *   - useAuth gating + DashboardSkeleton + PublicLanding fallback
 *   - Mood selection persisted in localStorage so chat empty-state can read it
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

type HeroScene = {
  image: string;
  overlay: string;
  glow: string;
  copy: string;
  copyColor: string;
};

const heroScenes: HeroScene[] = [
  {
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&auto=format&fit=crop&q=85",
    overlay:
      "linear-gradient(180deg, hsl(var(--background) / 0.10) 0%, hsl(var(--background) / 0.30) 56%, hsl(var(--background) / 0.86) 100%)",
    glow:
      "radial-gradient(ellipse 72% 60% at 50% 8%, hsl(var(--accent-100) / 0.38) 0%, transparent 66%)",
    copy: "Ease into the morning. Tell Mitra one true thing about today.",
    copyColor: "hsl(var(--accent-700))",
  },
  {
    image: "https://images.unsplash.com/photo-1511497584788-876760111969?w=1600&auto=format&fit=crop&q=85",
    overlay:
      "linear-gradient(180deg, hsl(var(--background) / 0.14) 0%, hsl(var(--background) / 0.36) 56%, hsl(var(--background) / 0.88) 100%)",
    glow:
      "radial-gradient(ellipse 72% 60% at 50% 8%, hsl(var(--accent-100) / 0.32) 0%, transparent 66%)",
    copy: "Hold this afternoon gently. Tell Mitra one true thing about today.",
    copyColor: "hsl(var(--accent-600))",
  },
  {
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&auto=format&fit=crop&q=85",
    overlay:
      "linear-gradient(180deg, hsl(var(--background) / 0.18) 0%, hsl(var(--background) / 0.44) 56%, hsl(var(--background) / 0.90) 100%)",
    glow:
      "radial-gradient(ellipse 72% 60% at 50% 8%, hsl(var(--warmth-100) / 0.30) 0%, transparent 66%)",
    copy: "Let the evening soften. Tell Mitra one true thing about today.",
    copyColor: "hsl(var(--warmth-500))",
  },
  {
    image: "https://images.unsplash.com/photo-1519692933481-e162a57d6721?w=1600&auto=format&fit=crop&q=85",
    overlay:
      "linear-gradient(180deg, hsl(var(--background) / 0.26) 0%, hsl(var(--background) / 0.50) 56%, hsl(var(--background) / 0.94) 100%)",
    glow:
      "radial-gradient(ellipse 72% 60% at 50% 8%, hsl(var(--accent-100) / 0.24) 0%, transparent 66%)",
    copy: "Set the night down softly. Tell Mitra one true thing before you rest.",
    copyColor: "hsl(var(--accent-100))",
  },
];

function pickHeroScene(): HeroScene {
  const index = Math.floor(Math.random() * heroScenes.length);
  return heroScenes[index];
}

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());
  const [mood, setMood] = useState<MoodChip | null>(null);
  const [heroScene] = useState<HeroScene>(() => pickHeroScene());

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
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <PageShell tone="page" width="page" as="main">
        {/* ── Band 1 — Now ───────────────────────────────── */}
        <section className="relative isolate flex min-h-[68vh] flex-col items-center overflow-hidden pt-16 text-center sm:min-h-[72vh] sm:pt-24 lg:min-h-[78vh]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-20"
          >
            <img
              src={heroScene.image}
              alt=""
              aria-hidden
              className="h-full w-full scale-[1.08] object-cover object-center"
            />
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              backgroundImage: heroScene.overlay,
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px]"
            style={{
              backgroundImage: heroScene.glow,
            }}
          />

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
            <p className="quiet-label justify-center">{getGreeting(now)}</p>
            <h1 className="mt-4 font-display text-[clamp(2rem,4.5vw,3rem)] leading-[1.1] tracking-tight text-foreground">
              Hello, {displayName}.
            </h1>
            <p
              className="mt-3 text-base leading-relaxed transition-colors duration-300"
              style={{ color: heroScene.copyColor }}
            >
              {mood
                ? `Noted that today feels ${mood.label.toLowerCase()}. We'll go from there.`
                : heroScene.copy}
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
            className="mt-8 flex w-full max-w-xl flex-col items-center gap-4"
          >
            <div className="flex flex-wrap justify-center gap-2">
              {moods.map((m) => {
                const isActive = mood?.label === m.label;
                return (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => handleMoodSelect(m)}
                    className={`group inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors ${isActive
                      ? "border-[hsl(var(--accent-300))] bg-[hsl(var(--accent-50))] text-[hsl(var(--accent-700))]"
                      : "border-border/60 bg-background text-muted-foreground hover:border-border hover:text-foreground"
                      }`}
                  >
                    <span className="text-base leading-none">{m.emoji}</span>
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            <Button
              size="lg"
              onClick={() => navigate("/chat")}
              className="mt-2 gap-2 rounded-full bg-primary px-8 text-base font-medium text-primary-foreground shadow-[var(--shadow-dashboard-warm)] hover:bg-[hsl(var(--accent-600))]"
            >
              Open conversation
              <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.div>
        </section>

        {/* ── Band 2 — Continue ──────────────────────────── */}
        <section className="mt-24 sm:mt-32">
          <header className="flex items-end justify-between gap-4">
            <div>
              <p className="quiet-label">Continue</p>
              <h2 className="mt-3 font-display text-2xl tracking-tight text-foreground sm:text-3xl">
                Pick up where you left off.
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigate("/chat")}
              className="hidden items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
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
              className="group flex flex-col justify-between rounded-3xl border border-border/40 bg-[hsl(var(--ink-1))] p-6 text-left transition-colors hover:border-border sm:p-8 lg:col-span-3"
            >
              <div>
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--accent-100))] text-[hsl(var(--accent-700))]">
                    <MessageCircle className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Today's conversation
                  </span>
                </div>
                <p className="mt-6 font-display text-xl leading-snug text-foreground sm:text-2xl">
                  Return to Mitra. The thread is still open.
                </p>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Mitra remembers what we talked about — no need to recap. Sit
                  down and start anywhere.
                </p>
              </div>
              <span className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-[hsl(var(--accent-600))]">
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
              className="group flex flex-col justify-between rounded-3xl border border-border/40 bg-background p-6 text-left transition-colors hover:border-border sm:p-8 lg:col-span-2"
            >
              <div>
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--warmth-100))] text-[hsl(var(--warmth-500))]">
                    <ritual.icon className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Suggested ritual
                  </span>
                </div>
                <p className="mt-6 font-display text-xl leading-snug text-foreground sm:text-2xl">
                  {ritual.title}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {ritual.body}
                </p>
              </div>
              <span className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-[hsl(var(--warmth-500))]">
                Begin
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </motion.button>
          </div>
        </section>

        {/* ── Band 3 — Library shortcuts ─────────────────── */}
        <section className="mt-24 pb-24 sm:mt-32 sm:pb-32">
          <header>
            <p className="quiet-label">Library</p>
            <h2 className="mt-3 font-display text-2xl tracking-tight text-foreground sm:text-3xl">
              When you need something else.
            </h2>
          </header>

          <ul className="mt-8 grid gap-px overflow-hidden rounded-3xl border border-border/40 bg-border/40 sm:grid-cols-2">
            <motion.li
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: DURATION.long, ease: EASE.outExpo }}
              className="bg-background"
            >
              <button
                type="button"
                onClick={() => navigate("/psychological-content")}
                className="group flex h-full w-full flex-col items-start gap-4 p-7 text-left sm:p-8"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--accent-100))] text-[hsl(var(--accent-700))]">
                  <Compass className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-display text-lg text-foreground">
                    Resources
                  </p>
                  <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
                    Short, evidence-based reads. Categorized by what you might
                    actually be looking for at 1am.
                  </p>
                </div>
                <span className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-[hsl(var(--accent-600))]">
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
              className="bg-background"
            >
              <button
                type="button"
                onClick={() => navigate("/mindgym")}
                className="group flex h-full w-full flex-col items-start gap-4 p-7 text-left sm:p-8"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--warmth-100))] text-[hsl(var(--warmth-500))]">
                  <Dumbbell className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-display text-lg text-foreground">
                    Mind Gym
                  </p>
                  <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
                    Two-minute exercises. Pick one when sitting still feels too
                    big.
                  </p>
                </div>
                <span className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-[hsl(var(--warmth-500))]">
                  Open Mind Gym
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            </motion.li>
          </ul>

          <div className="mt-6 flex flex-col items-start justify-between gap-3 rounded-2xl border border-border/40 bg-[hsl(var(--ink-1))] p-5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-background text-muted-foreground">
                <Stethoscope className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Talk to a real person
                </p>
                <p className="text-sm text-muted-foreground">
                  Vetted therapists. Your context goes with you — never raw chat.
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => navigate("/therapist-bridge")}
              className="text-foreground hover:text-foreground"
            >
              Therapist Bridge
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </section>
      </PageShell>
      <Footer />
    </div>
  );
};

export default Index;
