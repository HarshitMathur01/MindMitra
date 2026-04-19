import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Flame, Sparkles, Trophy, Phone, ArrowRight } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CrisisOverlay from "@/components/mindgym/CrisisOverlay";
import { MINDGYM_TOOLS, BADGES } from "@/lib/mindgym/catalog";
import { loadProgress, getDailyRecommendation, getStreak, isCompletedToday } from "@/lib/mindgym/storage";
import { Button } from "@/components/ui/button";
import { Pulse } from "@/components/identity/Pulse";
import { cn } from "@/lib/utils";

const eyebrow = "text-[11px] font-medium uppercase tracking-[0.2em] text-ink-5";

const containerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
} as const;

const cardVariants = {
    hidden: { opacity: 0, y: 10 },
    show: {
        opacity: 1,
        y: 0,
        transition: { type: "spring" as const, stiffness: 60, damping: 22, mass: 0.9 },
    },
} as const;

export default function MindGymHub() {
    const navigate = useNavigate();
    const [crisisOpen, setCrisisOpen] = useState(false);
    const [showBadges, setShowBadges] = useState(false);

    const progress = useMemo(() => loadProgress(), []);
    const recommended = useMemo(() => getDailyRecommendation(), []);
    const recommendedTool = MINDGYM_TOOLS.find((t) => t.id === recommended);

    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground transition-colors duration-300">
            <Header />

            <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-20 pt-8 sm:px-6">
                {/* Quiet hero — Pulse on the side, no gradient banners */}
                <motion.section
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="grid items-center gap-6 sm:grid-cols-[1fr_auto] sm:gap-10"
                >
                    <div className="min-w-0">
                        <p className={eyebrow}>MindGym</p>
                        <h1 className="mt-2 text-balance font-display text-[clamp(1.85rem,4vw,2.5rem)] font-light leading-[1.1] tracking-tight text-ink-8">
                            Small, gentle practices.{" "}
                            <span className="text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]">
                                Open them on your own pace.
                            </span>
                        </h1>
                        <p className="mt-4 max-w-prose text-[15px] leading-[1.7] text-ink-6">
                            Nothing to prove, no streak that defines you. Each practice works offline — pause whenever you need.
                        </p>
                    </div>
                    <div className="hidden shrink-0 sm:block">
                        <Pulse size={132} state="idle" intensity={0.85} />
                    </div>
                </motion.section>

                {/* Today's gentle suggestion + your pace */}
                <motion.section
                    className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
                >
                    {recommendedTool ? (
                        <button
                            type="button"
                            onClick={() => navigate(`/mindgym/${recommendedTool.id}`)}
                            className={cn(
                                "group flex flex-col gap-4 rounded-[1.5rem] border border-ink-3/25 bg-[hsl(var(--card))] p-6 text-left shadow-dashboard-soft transition-all",
                                "hover:-translate-y-0.5 hover:border-[hsl(var(--accent-400))]/35 hover:shadow-md dark:border-ink-3/20",
                                "border-l-[3px] border-l-[hsl(var(--accent-500))] dark:border-l-[hsl(var(--accent-400))]",
                            )}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className={eyebrow}>One gentle suggestion</p>
                                    <h3 className="mt-2 font-display text-[1.1rem] font-medium leading-snug text-ink-8 transition-colors group-hover:text-[hsl(var(--accent-700))] dark:group-hover:text-[hsl(var(--accent-400))]">
                                        {recommendedTool.title}
                                    </h3>
                                </div>
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent-100))]/55 text-[hsl(var(--accent-600))] dark:bg-[hsl(var(--accent-100))]/15 dark:text-[hsl(var(--accent-400))]">
                                    <recommendedTool.icon className="h-4.5 w-4.5" strokeWidth={1.8} />
                                </div>
                            </div>
                            <p className="text-[13.5px] leading-[1.65] text-ink-6">{recommendedTool.shortDesc}</p>
                            <div className="mt-auto flex items-center justify-between border-t border-ink-3/20 pt-3 text-[12px] text-ink-5">
                                <span className="line-clamp-1">{recommendedTool.clinicalTag}</span>
                                <span className="inline-flex items-center gap-1 font-medium text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]">
                                    Try this
                                    <ArrowRight className="h-3 w-3" strokeWidth={1.8} />
                                </span>
                            </div>
                        </button>
                    ) : null}

                    <div className="flex flex-col gap-4 rounded-[1.5rem] border border-ink-3/25 bg-[hsl(var(--card))] p-6 shadow-dashboard-soft dark:border-ink-3/20">
                        <p className={eyebrow}>Your pace, not a race</p>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--accent-100))]/55 px-3 py-1.5 text-[13px] font-medium text-ink-8 dark:bg-[hsl(var(--accent-100))]/15">
                                <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]" strokeWidth={1.8} />
                                {progress.totalXP}
                                <span className="text-[12px] font-normal text-ink-6">moments</span>
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--warmth-100))]/55 px-3 py-1.5 text-[13px] font-medium text-ink-8 dark:bg-[hsl(var(--warmth-100))]/15">
                                <Flame className="h-3.5 w-3.5 text-[hsl(var(--warmth-500))]" strokeWidth={1.8} />
                                {progress.currentStreak}
                                <span className="text-[12px] font-normal text-ink-6">days</span>
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowBadges((v) => !v)}
                                aria-expanded={showBadges}
                                className="inline-flex items-center gap-2 rounded-full border border-ink-3/25 bg-[hsl(var(--card))] px-3 py-1.5 text-[13px] font-medium text-ink-8 transition-colors hover:border-ink-3/40 dark:border-ink-3/20"
                            >
                                <Trophy className="h-3.5 w-3.5 text-ink-6" strokeWidth={1.8} />
                                {progress.badges.length}
                                <span className="text-[12px] font-normal text-ink-6">small wins</span>
                            </button>
                        </div>

                        <AnimatePresence initial={false}>
                            {showBadges ? (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                                    className="overflow-hidden"
                                >
                                    <div className="flex flex-wrap gap-1.5 border-t border-ink-3/20 pt-3">
                                        {BADGES.map((b) => {
                                            const earned = progress.badges.includes(b.id);
                                            return (
                                                <div
                                                    key={b.id}
                                                    title={b.title}
                                                    className={cn(
                                                        "flex items-center gap-1 rounded-md border px-2 py-1 text-xs",
                                                        earned
                                                            ? "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                                            : "border-transparent bg-ink-1 text-ink-5 grayscale dark:bg-ink-2/40",
                                                    )}
                                                >
                                                    <span className="text-sm leading-none">{earned ? b.icon : "🔒"}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            ) : null}
                        </AnimatePresence>

                        <p className="mt-1 text-[12.5px] leading-[1.6] text-ink-5">
                            Numbers here are quiet — they’re for you, not for us.
                        </p>
                    </div>
                </motion.section>

                {/* Practices grid */}
                <section className="mt-12">
                    <div className="mb-5 flex items-end justify-between gap-4">
                        <div>
                            <p className={eyebrow}>Library</p>
                            <h2 className="mt-1 font-display text-xl font-light tracking-tight text-ink-8 sm:text-2xl">
                                Practices you can open anytime
                            </h2>
                        </div>
                        <p className="hidden max-w-xs text-[13px] leading-[1.6] text-ink-6 sm:block">
                            All practices work offline. Tap one to begin — close it whenever you want.
                        </p>
                    </div>

                    <motion.div
                        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                    >
                        {MINDGYM_TOOLS.map((tool) => {
                            const streak = getStreak(tool.id);
                            const done = isCompletedToday(tool.id);

                            return (
                                <motion.button
                                    key={tool.id}
                                    variants={cardVariants}
                                    onClick={() => navigate(`/mindgym/${tool.id}`)}
                                    className={cn(
                                        "group relative flex flex-col overflow-hidden rounded-[1.25rem] border border-ink-3/25 bg-[hsl(var(--card))] p-5 text-left shadow-dashboard-soft transition-all dark:border-ink-3/20",
                                        "hover:-translate-y-0.5 hover:border-[hsl(var(--accent-400))]/35 hover:shadow-md",
                                    )}
                                >
                                    {done ? (
                                        <span className="absolute right-0 top-0 inline-flex items-center gap-1 rounded-bl-[14px] bg-[hsl(var(--accent-100))]/70 px-2 py-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-[hsl(var(--accent-700))] dark:bg-[hsl(var(--accent-100))]/15 dark:text-[hsl(var(--accent-400))]">
                                            Visited today
                                        </span>
                                    ) : null}

                                    <div className="mb-4 mt-0.5 flex items-start justify-between">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--accent-100))]/55 text-[hsl(var(--accent-600))] dark:bg-[hsl(var(--accent-100))]/15 dark:text-[hsl(var(--accent-400))]">
                                            <tool.icon className="h-5 w-5" strokeWidth={1.8} />
                                        </div>
                                        <span className="rounded-full bg-ink-1 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-6 dark:bg-ink-2/40">
                                            {tool.clinicalTag}
                                        </span>
                                    </div>

                                    <h3 className="font-display text-[1rem] font-medium leading-snug text-ink-8 transition-colors group-hover:text-[hsl(var(--accent-700))] dark:group-hover:text-[hsl(var(--accent-400))]">
                                        {tool.title}
                                    </h3>
                                    <p className="mt-1.5 line-clamp-2 text-[13px] leading-[1.65] text-ink-6">
                                        {tool.shortDesc}
                                    </p>

                                    <div className="mt-5 flex items-center justify-between border-t border-ink-3/20 pt-3">
                                        <div className="flex items-center gap-2 text-[11.5px] text-ink-5">
                                            <span>{tool.minutes} min</span>
                                            <span className="text-ink-3">·</span>
                                            <span>+{tool.xp}</span>
                                        </div>
                                        {streak > 0 ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--warmth-50))] px-2 py-0.5 text-[11px] font-medium text-ink-6 dark:bg-[hsl(var(--warmth-100))]/10">
                                                <Flame className="h-3 w-3 text-[hsl(var(--warmth-500))]" strokeWidth={1.8} />
                                                {streak}
                                            </span>
                                        ) : null}
                                    </div>
                                </motion.button>
                            );
                        })}
                    </motion.div>
                </section>
            </main>

            {/* Crisis path preserved exactly */}
            <div className="fixed bottom-6 right-6 z-40">
                <Button
                    variant="warmth"
                    size="sm"
                    onClick={() => setCrisisOpen(true)}
                    className="flex items-center gap-2 rounded-full shadow-md"
                >
                    <Phone className="h-4 w-4" strokeWidth={1.8} />
                    If you need someone
                </Button>
            </div>

            <CrisisOverlay open={crisisOpen} onClose={() => setCrisisOpen(false)} />
            <Footer />
        </div>
    );
}
