import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    ArrowLeft,
    BarChart3,
    Check,
    ChevronDown,
    Clock3,
    Dumbbell,
    Flame,
    Footprints,
    Heart,
    Leaf,
    MoonStar,
    Plus,
    Sparkles,
    Users,
    X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type HabitCategory =
    | "Mindfulness"
    | "Movement"
    | "Reflection"
    | "Sleep"
    | "Social"
    | "Nutrition";

type HabitItem = {
    id: string;
    emoji: string;
    name: string;
    category: HabitCategory;
    duration?: string;
    weeklyDone: number;
    streak: number;
    completedToday: boolean;
};

type WeekDay = {
    id: string;
    short: string;
    status: "completed" | "missed" | "future";
    isToday: boolean;
    doneHabits: string[];
};

type HabitSort = "manual" | "streak" | "weekly";

const categoryStyles: Record<HabitCategory, { soft: string; bar: string; icon: JSX.Element }> = {
    Mindfulness: {
        soft: "bg-[hsl(var(--accent-100))] text-[hsl(var(--accent-600))] dark:bg-[hsl(var(--accent-100))]/25 dark:text-[hsl(var(--accent-300))]",
        bar: "bg-[hsl(var(--accent-500))]",
        icon: <Leaf className="h-4 w-4 text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-300))]" />,
    },
    Movement: {
        soft: "bg-[hsl(var(--warmth-100))] text-[hsl(var(--warmth-500))] dark:bg-[hsl(var(--warmth-100))]/22 dark:text-[hsl(var(--warmth-400))]",
        bar: "bg-[hsl(var(--warmth-500))]",
        icon: <Dumbbell className="h-4 w-4 text-[hsl(var(--warmth-500))] dark:text-[hsl(var(--warmth-400))]" />,
    },
    Reflection: {
        soft: "bg-[hsl(var(--ink-1))] text-ink-7 dark:bg-[hsl(var(--ink-2))] dark:text-ink-8",
        bar: "bg-[hsl(var(--accent-400))]",
        icon: <Heart className="h-4 w-4 text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]" />,
    },
    Sleep: {
        soft: "bg-[hsl(var(--accent-50))] text-[hsl(var(--accent-700))] dark:bg-[hsl(var(--ink-2))] dark:text-ink-8",
        bar: "bg-[hsl(var(--accent-600))]",
        icon: <MoonStar className="h-4 w-4 text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]" />,
    },
    Social: {
        soft: "bg-[hsl(var(--warmth-50))] text-[hsl(var(--warmth-500))] dark:bg-[hsl(var(--warmth-50))]/15 dark:text-[hsl(var(--warmth-400))]",
        bar: "bg-[hsl(var(--warmth-400))]",
        icon: <Users className="h-4 w-4 text-[hsl(var(--warmth-500))] dark:text-[hsl(var(--warmth-400))]" />,
    },
    Nutrition: {
        soft: "bg-[hsl(var(--accent-100))]/80 text-[hsl(var(--accent-700))] dark:bg-[hsl(var(--accent-100))]/20 dark:text-[hsl(var(--accent-300))]",
        bar: "bg-[hsl(var(--accent-500))]",
        icon: <Footprints className="h-4 w-4 text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-300))]" />,
    },
};

const pageEyebrowClass = "text-[11px] font-medium uppercase tracking-[0.2em] text-ink-5";

const initialHabits: HabitItem[] = [
    { id: "breathing", emoji: "🌬️", name: "Breathing exercise", category: "Mindfulness", duration: "3 min", weeklyDone: 4, streak: 5, completedToday: false },
    { id: "meditation", emoji: "🧘", name: "Morning meditation", category: "Mindfulness", duration: "10 min", weeklyDone: 5, streak: 6, completedToday: false },
    { id: "journal", emoji: "📖", name: "Gratitude journal", category: "Reflection", duration: "5 min", weeklyDone: 3, streak: 1, completedToday: true },
    { id: "walk", emoji: "🚶", name: "Evening walk", category: "Movement", duration: "20 min", weeklyDone: 4, streak: 0, completedToday: true },
    { id: "sleep", emoji: "💤", name: "Sleep by 11pm", category: "Sleep", weeklyDone: 2, streak: 2, completedToday: false },
];

const quotePool = [
    "Consistency is a quiet form of self-respect.",
    "Tiny routines become the architecture of calm.",
    "A habit kept today is confidence borrowed from tomorrow.",
];

const weekdayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const confettiParticles = [
    { x: -14, y: -10, delay: 0, color: "bg-amber-400" },
    { x: 10, y: -14, delay: 0.04, color: "bg-teal-400" },
    { x: -6, y: -18, delay: 0.08, color: "bg-green-400" },
    { x: 16, y: -6, delay: 0.12, color: "bg-pink-400" },
    { x: 2, y: -22, delay: 0.16, color: "bg-indigo-400" },
];

const circleRadius = 36;
const circleSize = 80;
const circleCircumference = 2 * Math.PI * circleRadius;

const categoryOptions: HabitCategory[] = ["Mindfulness", "Movement", "Reflection", "Sleep", "Social", "Nutrition"];
const durationOptions = ["3 min", "5 min", "10 min", "20 min", "30 min"];

const getTodayIndexMondayFirst = () => {
    const jsDay = new Date().getDay();
    return jsDay === 0 ? 6 : jsDay - 1;
};

const buildWeekData = (habits: HabitItem[]): WeekDay[] => {
    const todayIndex = getTodayIndexMondayFirst();
    return weekdayNames.map((day, index) => {
        const isToday = index === todayIndex;
        const status: WeekDay["status"] =
            index > todayIndex ? "future" : index % 3 === 0 || isToday ? "completed" : "missed";
        const doneHabits =
            status === "future"
                ? []
                : habits
                    .filter((h) => (isToday ? h.completedToday : h.weeklyDone > index % 4))
                    .map((h) => h.name);
        return { id: `${day.toLowerCase()}-${index}`, short: day, status, isToday, doneHabits };
    });
};

export default function HealthyHabits() {
    const navigate = useNavigate();
    const addFormRef = useRef<HTMLDivElement>(null);
    const confettiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const milestoneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [habits, setHabits] = useState<HabitItem[]>(initialHabits);
    const [expandedHabitId, setExpandedHabitId] = useState<string | null>(null);
    const [confettiHabitId, setConfettiHabitId] = useState<string | null>(null);
    const [showMilestone, setShowMilestone] = useState(false);
    const [selectedDay, setSelectedDay] = useState<WeekDay | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);

    const [newHabitName, setNewHabitName] = useState("");
    const [newHabitCategory, setNewHabitCategory] = useState<HabitCategory>("Mindfulness");
    const [newHabitDuration, setNewHabitDuration] = useState("10 min");
    const [reminderEnabled, setReminderEnabled] = useState(true);
    const [activeCategory, setActiveCategory] = useState<HabitCategory | "All">("All");
    const [sortBy, setSortBy] = useState<HabitSort>("manual");

    const completedCount = habits.filter((h) => h.completedToday).length;
    const completionPercent = Math.round((completedCount / Math.max(habits.length, 1)) * 100);
    const bestStreak = habits.reduce((best, h) => Math.max(best, h.streak), 0);
    const totalWeeklyDone = habits.reduce((sum, h) => sum + h.weeklyDone, 0);
    const quoteOfTheDay = quotePool[new Date().getDate() % quotePool.length];
    const weekData = useMemo(() => buildWeekData(habits), [habits]);
    const allDone = habits.length > 0 && completedCount === habits.length;
    const streakBroken = habits.some((h) => h.streak === 0);

    const visibleHabits = useMemo(() => {
        const filtered = habits.filter((h) => activeCategory === "All" || h.category === activeCategory);
        if (sortBy === "streak") return [...filtered].sort((a, b) => b.streak - a.streak);
        if (sortBy === "weekly") return [...filtered].sort((a, b) => b.weeklyDone - a.weeklyDone);
        return filtered;
    }, [activeCategory, habits, sortBy]);

    const categoryProgress = useMemo(
        () => categoryOptions.map((cat) => {
            const catHabits = habits.filter((h) => h.category === cat);
            const catDone = catHabits.filter((h) => h.completedToday).length;
            return { category: cat, count: catHabits.length, percent: catHabits.length ? Math.round((catDone / catHabits.length) * 100) : 0 };
        }),
        [habits]
    );

    const triggerCelebration = (habitId: string, nextStreak: number) => {
        setConfettiHabitId(habitId);
        if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
        confettiTimeoutRef.current = setTimeout(() => setConfettiHabitId((c) => (c === habitId ? null : c)), 700);
        if (nextStreak === 7) {
            setShowMilestone(true);
            if (milestoneTimeoutRef.current) clearTimeout(milestoneTimeoutRef.current);
            milestoneTimeoutRef.current = setTimeout(() => setShowMilestone(false), 2200);
        }
    };

    useEffect(() => () => {
        if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
        if (milestoneTimeoutRef.current) clearTimeout(milestoneTimeoutRef.current);
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    }, []);

    const toggleHabitComplete = (id: string) => {
        setHabits((curr) =>
            curr.map((h) => {
                if (h.id !== id) return h;
                const completedToday = !h.completedToday;
                const nextStreak = completedToday ? h.streak + 1 : Math.max(h.streak - 1, 0);
                const nextWeeklyDone = completedToday ? Math.min(h.weeklyDone + 1, 7) : Math.max(h.weeklyDone - 1, 0);
                if (completedToday) triggerCelebration(id, nextStreak);
                return { ...h, completedToday, streak: nextStreak, weeklyDone: nextWeeklyDone };
            })
        );
    };

    const addHabit = () => {
        if (!newHabitName.trim()) return;
        setHabits((curr) => [...curr, {
            id: `${Date.now()}-${newHabitName}`,
            emoji: "✨",
            name: newHabitName.trim(),
            category: newHabitCategory,
            duration: newHabitDuration,
            weeklyDone: 0,
            streak: 0,
            completedToday: false,
        }]);
        setNewHabitName("");
        setNewHabitCategory("Mindfulness");
        setNewHabitDuration("10 min");
        setReminderEnabled(true);
        setShowAddForm(false);
    };

    const handleShowAddForm = () => {
        setShowAddForm(true);
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => addFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    };

    return (
        <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
            {/* Milestone toast */}
            <AnimatePresence>
                {showMilestone && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.92 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -16, scale: 0.96 }}
                        className="fixed bottom-8 left-1/2 z-50 w-[min(100%,20rem)] -translate-x-1/2 rounded-[1.5rem] border border-ink-3/40 bg-[hsl(var(--card))] px-6 py-4 text-center shadow-dashboard-soft dark:border-ink-3/30"
                    >
                        <p className="text-2xl">🎊</p>
                        <p className="mt-1 text-sm font-semibold text-ink-8">7-day streak unlocked!</p>
                        <p className="text-xs text-ink-5">This rhythm is your new normal.</p>
                    </motion.div>
                )}
            </AnimatePresence>

            <main
                className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 pb-24 sm:px-6 md:pb-12 lg:px-8"
            >
                <header className="flex items-start gap-3">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-0.5 shrink-0 rounded-full text-ink-7 hover:bg-[hsl(var(--ink-1))]"
                        onClick={() => navigate(-1)}
                        aria-label="Go back"
                    >
                        <ArrowLeft className="h-5 w-5 stroke-[1.6]" />
                    </Button>
                    <div className="min-w-0 flex-1">
                        <p className={pageEyebrowClass}>Rhythm</p>
                        <h1 className="font-display text-[clamp(1.65rem,4vw,2.25rem)] font-normal tracking-tight text-ink-8">
                            Healthy habits
                        </h1>
                        <p className="mt-1 text-sm leading-relaxed text-ink-5">Small steps, big shifts.</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-ink-3/40 bg-[hsl(var(--card))] px-3 py-1.5 shadow-dashboard-soft">
                        <Flame className="h-3.5 w-3.5 text-[hsl(var(--accent-600))]" strokeWidth={1.6} />
                        <span className="text-xs font-semibold tabular-nums text-ink-7">{bestStreak}d</span>
                    </div>
                </header>

                <div className="flex flex-col gap-8">
                {/* ── Hero stats ── */}
                <div className="rounded-[1.75rem] border border-ink-3/40 bg-[hsl(var(--card))] p-6 shadow-dashboard-soft dark:border-ink-3/30">
                    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-4">
                        {/* Ring */}
                        <div className="relative shrink-0">
                            <svg className="-rotate-90" width={circleSize} height={circleSize} viewBox={`0 0 ${circleSize} ${circleSize}`}>
                                <circle cx={circleSize / 2} cy={circleSize / 2} r={circleRadius} className="fill-none stroke-[hsl(var(--ink-2))]" strokeWidth="7" />
                                <motion.circle
                                    cx={circleSize / 2} cy={circleSize / 2} r={circleRadius}
                                    className="fill-none stroke-[hsl(var(--accent-500))]"
                                    strokeWidth="7" strokeLinecap="round"
                                    strokeDasharray={circleCircumference}
                                    animate={{ strokeDashoffset: circleCircumference - (completionPercent / 100) * circleCircumference }}
                                    transition={{ duration: 0.3, ease: "easeOut" }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-lg font-semibold tabular-nums leading-none text-ink-8">{completionPercent}%</span>
                                <span className="text-[9px] text-ink-5">today</span>
                            </div>
                        </div>
                        {/* Stats */}
                        <div className="flex-1">
                            <p className="flex items-center gap-1 text-xs font-medium text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]">
                                <Sparkles className="h-3 w-3" strokeWidth={1.6} /> Daily focus
                            </p>
                            <p className="mt-1 font-display text-lg font-normal leading-snug text-ink-8">
                                {allDone ? "All done! You crushed today 🎉" : "Your rhythm is taking shape"}
                            </p>
                            <div className="mt-3 flex gap-3">
                                <div className="text-center">
                                    <p className="text-xl font-bold leading-none">{completedCount}</p>
                                    <p className="text-[10px] text-muted-foreground">Done</p>
                                </div>
                                <div className="w-px bg-border" />
                                <div className="text-center">
                                    <p className="text-xl font-bold leading-none">{habits.length}</p>
                                    <p className="text-[10px] text-muted-foreground">Total</p>
                                </div>
                                <div className="w-px bg-border" />
                                <div className="text-center">
                                    <p className="text-xl font-bold leading-none">{totalWeeklyDone}</p>
                                    <p className="text-[10px] text-muted-foreground">This week</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Filters + Sort ── */}
                <div className="space-y-3">
                    {/* Category chips - horizontal scroll */}
                    <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {(["All", ...categoryOptions] as (HabitCategory | "All")[]).map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={cn(
                                    "shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium transition-all duration-150",
                                    activeCategory === cat
                                        ? "border-[hsl(var(--accent-400))] bg-[hsl(var(--accent-100))] text-ink-8 dark:border-[hsl(var(--accent-500))]/50 dark:bg-[hsl(var(--accent-100))]/20 dark:text-ink-8"
                                        : "border-ink-3/40 bg-[hsl(var(--card))] text-ink-5 hover:border-ink-3/60 hover:bg-[hsl(var(--ink-1))]"
                                )}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                    {/* Sort */}
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">Sort:</span>
                        <div className="flex gap-1">
                            {([
                                { label: "Default", value: "manual" },
                                { label: "Streak", value: "streak" },
                                { label: "Weekly", value: "weekly" },
                            ] as { label: string; value: HabitSort }[]).map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => setSortBy(opt.value)}
                                    className={cn(
                                        "rounded-full px-3 py-1 text-[11px] font-medium transition-all",
                                        sortBy === opt.value
                                            ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Today's Habits ── */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="font-display text-xl font-normal tracking-tight text-ink-8">Today&apos;s habits</h2>
                        {allDone && (
                            <span className="rounded-full border border-[hsl(var(--accent-300))]/50 bg-[hsl(var(--accent-100))] px-3 py-1 text-[11px] font-medium text-[hsl(var(--accent-700))] dark:border-[hsl(var(--accent-500))]/30 dark:bg-[hsl(var(--accent-100))]/20 dark:text-[hsl(var(--accent-300))]">
                                All done! 🎉
                            </span>
                        )}
                    </div>

                    {visibleHabits.length === 0 ? (
                        <div className="rounded-[1.5rem] border border-dashed border-ink-3/50 bg-[hsl(var(--card))] px-5 py-10 text-center text-sm text-ink-5 shadow-dashboard-soft">
                            No habits match. Add your first one below.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {visibleHabits.map((habit) => {
                                const style = categoryStyles[habit.category];
                                const isExpanded = expandedHabitId === habit.id;

                                return (
                                    <motion.article layout key={habit.id}
                                        className={cn(
                                            "overflow-hidden rounded-[1.5rem] border border-ink-3/40 bg-[hsl(var(--card))] shadow-dashboard-soft transition-colors dark:border-ink-3/30",
                                            habit.completedToday && "border-[hsl(var(--accent-400))]/45 bg-[hsl(var(--accent-50))] dark:border-[hsl(var(--accent-500))]/35 dark:bg-[hsl(var(--accent-100))]/15"
                                        )}
                                    >
                                        <div className="flex items-center gap-3 p-4">
                                            {/* Emoji badge */}
                                            <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl", style.soft)}>
                                                {habit.emoji}
                                            </div>

                                            {/* Name + meta */}
                                            <div className="flex-1 min-w-0">
                                                <p className="truncate text-sm font-semibold">{habit.name}</p>
                                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                                    {habit.category}{habit.duration ? ` · ${habit.duration}` : ""}
                                                    {habit.streak > 0 && <span className="ml-2 text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]">🔥 {habit.streak}d</span>}
                                                </p>
                                                {/* Weekly progress bar */}
                                                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-border/50">
                                                    <motion.div
                                                        className={cn("h-full rounded-full", style.bar)}
                                                        initial={false}
                                                        animate={{ width: `${(habit.weeklyDone / 7) * 100}%` }}
                                                        transition={{ duration: 0.4, ease: "easeOut" }}
                                                    />
                                                </div>
                                                <p className="mt-0.5 text-[10px] text-muted-foreground">{habit.weeklyDone}/7 this week</p>
                                            </div>

                                            {/* Expand chevron */}
                                            <button
                                                onClick={() => setExpandedHabitId(isExpanded ? null : habit.id)}
                                                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-transform hover:bg-accent"
                                                aria-label="Toggle details"
                                            >
                                                <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                                    <ChevronDown className="h-4 w-4" />
                                                </motion.div>
                                            </button>

                                            {/* Complete button */}
                                            <div className="relative">
                                                <motion.button
                                                    type="button"
                                                    whileTap={{ scale: 0.88 }}
                                                    onClick={() => toggleHabitComplete(habit.id)}
                                                    aria-label={`Mark ${habit.name} as done`}
                                                    className={cn(
                                                        "flex h-10 w-10 items-center justify-center rounded-2xl border-2 transition-colors",
                                                        habit.completedToday
                                                            ? "border-[hsl(var(--accent-500))] bg-[hsl(var(--accent-500))] text-white"
                                                            : "border-ink-3/50 bg-[hsl(var(--ink-1))]"
                                                    )}
                                                >
                                                    <AnimatePresence mode="wait">
                                                        {habit.completedToday ? (
                                                            <motion.span key="checked" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} transition={{ duration: 0.18 }}>
                                                                <Check className="h-4 w-4" />
                                                            </motion.span>
                                                        ) : (
                                                            <motion.span key="empty" initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="h-3 w-3 rounded-sm border border-border/80" />
                                                        )}
                                                    </AnimatePresence>
                                                </motion.button>

                                                {/* Confetti */}
                                                <AnimatePresence>
                                                    {confettiHabitId === habit.id && (
                                                        <motion.div initial={{ opacity: 1 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0">
                                                            {confettiParticles.map((p, i) => (
                                                                <motion.span
                                                                    key={`${habit.id}-p-${i}`}
                                                                    initial={{ x: 0, y: 0, opacity: 0 }}
                                                                    animate={{ x: p.x, y: p.y, opacity: [0, 1, 0], scale: [0.5, 1, 0.8] }}
                                                                    transition={{ duration: 0.45, delay: p.delay }}
                                                                    className={cn("absolute left-4 top-4 h-1.5 w-1.5 rounded-full", p.color)}
                                                                />
                                                            ))}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </div>

                                        {/* Expanded detail — inline */}
                                        <AnimatePresence initial={false}>
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.22 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="mx-4 mb-4 rounded-2xl bg-background p-4 space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">7-day streak</p>
                                                            <p className="text-sm font-bold">{habit.streak} {habit.streak === 1 ? "day" : "days"}</p>
                                                        </div>
                                                        <div className="flex gap-1.5">
                                                            {Array.from({ length: 7 }).map((_, i) => (
                                                                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                                                    <div className={cn("h-2 w-full rounded-full", i < habit.weeklyDone ? style.bar : "bg-border")} />
                                                                    <span className="text-[9px] text-muted-foreground">{weekdayNames[i].charAt(0)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            {habit.streak >= 5
                                                                ? "You're on a roll — don't break the chain."
                                                                : habit.streak === 0
                                                                    ? "Every day is a fresh start."
                                                                    : "Keep going — momentum is building."}
                                                        </p>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.article>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* ── Streak Calendar ── */}
                <section className="rounded-[1.75rem] border border-ink-3/40 bg-[hsl(var(--card))] p-6 shadow-dashboard-soft dark:border-ink-3/30">
                    <h2 className="mb-4 font-display text-xl font-normal tracking-tight text-ink-8">Streak calendar</h2>
                    <div className="grid grid-cols-7 gap-2">
                        {weekData.map((day) => (
                            <button
                                key={day.id}
                                type="button"
                                onClick={() => setSelectedDay(selectedDay?.id === day.id ? null : day)}
                                className={cn(
                                    "h-10 rounded-full text-xs font-semibold transition-all duration-150",
                                    day.isToday && "ring-2 ring-[hsl(var(--accent-400))] ring-offset-2 ring-offset-[hsl(var(--background))]",
                                    day.status === "completed" && "bg-[hsl(var(--accent-500))] text-white",
                                    day.status === "missed" && "bg-[hsl(var(--ink-2))] text-ink-5",
                                    day.status === "future" && "border border-ink-3/50 bg-[hsl(var(--ink-1))] text-ink-7",
                                    selectedDay?.id === day.id && "scale-95"
                                )}
                            >
                                {day.short}
                            </button>
                        ))}
                    </div>

                    {/* Inline day detail */}
                    <AnimatePresence>
                        {selectedDay && (
                            <motion.div
                                key={selectedDay.id}
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.22 }}
                                className="overflow-hidden"
                            >
                                <div className="mt-4 pt-4 border-t border-border space-y-2">
                                    <p className="text-xs font-semibold text-muted-foreground">{selectedDay.short} · {selectedDay.status}</p>
                                    {selectedDay.doneHabits.length > 0 ? (
                                        selectedDay.doneHabits.map((name) => (
                                            <div key={name} className="flex items-center gap-2 rounded-2xl bg-background px-3 py-2 text-sm">
                                                <Check className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--accent-600))]" strokeWidth={1.8} />
                                                {name}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                                            {selectedDay.status === "future" ? "Not yet — this day is ahead of you." : "No habits logged for this day."}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>

                {/* ── Category bars ── */}
                <section className="rounded-[1.75rem] border border-ink-3/40 bg-[hsl(var(--card))] p-6 shadow-dashboard-soft dark:border-ink-3/30">
                    <p className="mb-4 flex items-center gap-2 text-sm font-medium text-ink-8">
                        <BarChart3 className="h-4 w-4 text-[hsl(var(--accent-600))]" strokeWidth={1.6} />
                        Category completion
                    </p>
                    <div className="space-y-3">
                        {categoryProgress.filter((i) => i.count > 0).map((item) => (
                            <div key={item.category}>
                                <div className="mb-1.5 flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1.5 text-muted-foreground">
                                        {categoryStyles[item.category].icon}
                                        {item.category}
                                    </span>
                                    <span className="font-semibold tabular-nums">{item.percent}%</span>
                                </div>
                                <div className="h-2 rounded-full bg-border/60 overflow-hidden">
                                    <motion.div
                                        className={cn("h-full rounded-full", categoryStyles[item.category].bar)}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${item.percent}%` }}
                                        transition={{ duration: 0.3, ease: "easeOut" }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── Streak nudge ── */}
                <div
                    className={cn(
                        "rounded-[1.75rem] border p-6 shadow-dashboard-soft",
                        streakBroken
                            ? "border-[hsl(var(--warmth-300))]/50 bg-[hsl(var(--warmth-50))] dark:border-[hsl(var(--warmth-400))]/25 dark:bg-[hsl(var(--ink-2))]"
                            : "border-ink-3/40 bg-[hsl(var(--accent-50))] dark:border-[hsl(var(--accent-500))]/20 dark:bg-[hsl(var(--accent-100))]/12"
                    )}
                >
                    <p
                        className={cn(
                            "mb-1 text-xs font-semibold uppercase tracking-wide",
                            streakBroken
                                ? "text-[hsl(var(--warmth-500))] dark:text-[hsl(var(--warmth-400))]"
                                : "text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]"
                        )}
                    >
                        {streakBroken ? "Streak reminder" : "No broken streaks 🌱"}
                    </p>
                    <p className="text-sm leading-relaxed text-ink-7">
                        {streakBroken
                            ? "It's okay. Every day is a fresh start. Tap a habit to check it off."
                            : "No broken streaks right now. Keep this momentum going."}
                    </p>
                </div>

                {/* ── Daily quote ── */}
                <section className="rounded-[1.75rem] border border-ink-3/40 bg-[hsl(var(--warmth-50))] p-6 shadow-dashboard-soft dark:border-ink-3/30 dark:bg-[hsl(var(--ink-2))]">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]">Daily note</p>
                    <p className="mt-3 font-display text-lg font-normal leading-snug text-ink-8">&ldquo;{quoteOfTheDay}&rdquo;</p>
                    <div className="mt-4 flex items-center justify-between">
                        <p className="text-[11px] text-muted-foreground">Shared by your companion</p>
                        <Avatar className="h-8 w-8 border border-white/60 shadow-sm">
                            <AvatarImage src="/avatars/mitra.png" alt="Mitra" />
                            <AvatarFallback>MM</AvatarFallback>
                        </Avatar>
                    </div>
                </section>

                {/* ── Add Habit — inline form ── */}
                <div ref={addFormRef}>
                    {!showAddForm ? (
                        <button
                            onClick={handleShowAddForm}
                            className="flex w-full items-center justify-center gap-2 rounded-[1.5rem] border-2 border-dashed border-ink-3/50 py-5 text-sm font-medium text-ink-5 transition-colors hover:border-[hsl(var(--accent-400))] hover:text-[hsl(var(--accent-600))]"
                        >
                            <Plus className="h-4 w-4" />
                            Add new habit
                        </button>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-[24px] border border-border bg-card p-5 shadow-sm space-y-5"
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold">New habit</h3>
                                <button
                                    onClick={() => setShowAddForm(false)}
                                    className="flex h-8 w-8 items-center justify-center rounded-full bg-background text-muted-foreground hover:bg-accent"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Name */}
                            <div>
                                <label htmlFor="habit-name" className="mb-2 block text-xs font-medium text-muted-foreground">
                                    Name
                                </label>
                                <input
                                    id="habit-name"
                                    value={newHabitName}
                                    onChange={(e) => setNewHabitName(e.target.value)}
                                    placeholder="Hydration check-in"
                                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary/30"
                                />
                            </div>

                            {/* Category */}
                            <div>
                                <p className="mb-2 text-xs font-medium text-muted-foreground">Category</p>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                    {categoryOptions.map((cat) => (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => setNewHabitCategory(cat)}
                                            className={cn(
                                                "flex items-center justify-center gap-1.5 rounded-2xl border border-border px-2 py-2 text-xs font-medium transition-all",
                                                newHabitCategory === cat
                                                    ? "border-primary bg-primary/10 text-foreground"
                                                    : "text-muted-foreground hover:bg-accent"
                                            )}
                                        >
                                            {categoryStyles[cat].icon}
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Duration */}
                            <div>
                                <p className="mb-2 text-xs font-medium text-muted-foreground">Duration</p>
                                <div className="flex flex-wrap gap-2">
                                    {durationOptions.map((dur) => (
                                        <button
                                            key={dur}
                                            type="button"
                                            onClick={() => setNewHabitDuration(dur)}
                                            className={cn(
                                                "rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-all",
                                                newHabitDuration === dur
                                                    ? "border-primary bg-primary/10 text-foreground"
                                                    : "text-muted-foreground hover:bg-accent"
                                            )}
                                        >
                                            <Clock3 className="mr-1 inline h-3 w-3" />
                                            {dur}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Reminder toggle */}
                            <div className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3">
                                <div>
                                    <p className="text-sm font-medium">Daily reminder</p>
                                    <p className="text-[11px] text-muted-foreground">Get a nudge at your usual time</p>
                                </div>
                                <Switch checked={reminderEnabled} onCheckedChange={setReminderEnabled} />
                            </div>

                            {/* Save */}
                            <button
                                onClick={addHabit}
                                disabled={!newHabitName.trim()}
                                className="flex h-11 w-full items-center justify-center rounded-2xl bg-[hsl(var(--accent-500))] text-sm font-semibold text-white transition-colors hover:bg-[hsl(var(--accent-600))] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Save habit
                            </button>
                        </motion.div>
                    )}
                </div>
                </div>
            </main>
        </div>
    );
}
