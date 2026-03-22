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

const categoryStyles: Record<
    HabitCategory,
    { soft: string; strong: string; bar: string; icon: JSX.Element }
> = {
    Mindfulness: {
        soft: "bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300",
        strong: "bg-teal-500",
        bar: "bg-teal-500",
        icon: <Leaf className="h-4 w-4" />,
    },
    Movement: {
        soft: "bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-300",
        strong: "bg-green-500",
        bar: "bg-green-500",
        icon: <Dumbbell className="h-4 w-4" />,
    },
    Reflection: {
        soft: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
        strong: "bg-amber-500",
        bar: "bg-amber-500",
        icon: <Heart className="h-4 w-4" />,
    },
    Sleep: {
        soft: "bg-indigo-50 text-indigo-500 dark:bg-indigo-500/15 dark:text-indigo-300",
        strong: "bg-indigo-400",
        bar: "bg-indigo-400",
        icon: <MoonStar className="h-4 w-4" />,
    },
    Social: {
        soft: "bg-pink-50 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300",
        strong: "bg-pink-500",
        bar: "bg-pink-500",
        icon: <Users className="h-4 w-4" />,
    },
    Nutrition: {
        soft: "bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300",
        strong: "bg-orange-500",
        bar: "bg-orange-500",
        icon: <Footprints className="h-4 w-4" />,
    },
};

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
        <div className="relative min-h-screen text-foreground"
            style={{
                backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0.92) 100%), url('https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1800&auto=format&fit=crop&q=80')",
                backgroundSize: "cover",
                backgroundPosition: "center top",
                backgroundAttachment: "fixed",
            }}
        >
            {/* Milestone toast */}
            <AnimatePresence>
                {showMilestone && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.92 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -16, scale: 0.96 }}
                        className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-[24px] bg-card px-6 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.18)] text-center"
                    >
                        <p className="text-2xl">🎊</p>
                        <p className="mt-1 text-sm font-bold text-foreground">7-day streak unlocked!</p>
                        <p className="text-xs text-muted-foreground">This rhythm is your new normal.</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Sticky header */}
            <div className="sticky top-0 z-20 flex items-center gap-3 bg-white/80 dark:bg-background/80 px-5 py-3 backdrop-blur">
                <button
                    onClick={() => navigate(-1)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card shadow-sm transition-transform hover:scale-105 active:scale-95"
                    aria-label="Go back"
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="flex-1">
                    <h1 className="text-[17px] font-bold leading-tight">Healthy Habits</h1>
                    <p className="text-[11px] text-muted-foreground">Small steps, big shifts</p>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-500/15 px-3 py-1.5">
                    <Flame className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-300">{bestStreak}d</span>
                </div>
            </div>

            <div className="px-5 pb-16 space-y-5">

                {/* ── Hero stats ── */}
                <div className="rounded-[28px] bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-amber-500/10 dark:via-orange-500/10 dark:to-rose-500/10 p-5 shadow-sm border border-amber-200/60 dark:border-amber-500/20">
                    <div className="flex items-center gap-4">
                        {/* Ring */}
                        <div className="relative shrink-0">
                            <svg className="-rotate-90" width={circleSize} height={circleSize} viewBox={`0 0 ${circleSize} ${circleSize}`}>
                                <circle cx={circleSize / 2} cy={circleSize / 2} r={circleRadius} className="fill-none stroke-white/60 dark:stroke-white/10" strokeWidth="7" />
                                <motion.circle
                                    cx={circleSize / 2} cy={circleSize / 2} r={circleRadius}
                                    className="fill-none stroke-amber-500"
                                    strokeWidth="7" strokeLinecap="round"
                                    strokeDasharray={circleCircumference}
                                    animate={{ strokeDashoffset: circleCircumference - (completionPercent / 100) * circleCircumference }}
                                    transition={{ duration: 0.6, ease: "easeOut" }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-lg font-bold leading-none">{completionPercent}%</span>
                                <span className="text-[9px] text-muted-foreground">today</span>
                            </div>
                        </div>
                        {/* Stats */}
                        <div className="flex-1">
                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                                <Sparkles className="h-3 w-3" /> Daily focus
                            </p>
                            <p className="mt-1 text-base font-bold text-foreground leading-snug">
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
                                    "shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-150",
                                    activeCategory === cat
                                        ? "bg-foreground text-background"
                                        : "bg-card border border-border text-muted-foreground hover:bg-accent"
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
                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-semibold">Today&apos;s Habits</h2>
                        {allDone && (
                            <span className="rounded-full bg-green-100 dark:bg-green-500/15 px-3 py-1 text-[11px] font-medium text-green-700 dark:text-green-300">
                                All done! 🎉
                            </span>
                        )}
                    </div>

                    {visibleHabits.length === 0 ? (
                        <div className="rounded-[24px] border border-dashed border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
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
                                            "rounded-[24px] border border-border bg-card shadow-sm overflow-hidden transition-colors",
                                            habit.completedToday && "bg-green-50/60 dark:bg-green-500/10 border-green-200/60 dark:border-green-500/20"
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
                                                    {habit.streak > 0 && <span className="ml-2 text-amber-600 dark:text-amber-400">🔥 {habit.streak}d</span>}
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
                                                            ? "border-green-500 bg-green-500 text-white"
                                                            : "border-border bg-background"
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
                <section className="rounded-[24px] bg-card p-5 shadow-sm border border-border">
                    <h2 className="mb-4 text-base font-semibold">Streak Calendar</h2>
                    <div className="grid grid-cols-7 gap-2">
                        {weekData.map((day) => (
                            <button
                                key={day.id}
                                type="button"
                                onClick={() => setSelectedDay(selectedDay?.id === day.id ? null : day)}
                                className={cn(
                                    "h-10 rounded-full text-xs font-semibold transition-all duration-150",
                                    day.isToday && "ring-2 ring-amber-400 ring-offset-2 ring-offset-background",
                                    day.status === "completed" && "bg-green-500 text-white",
                                    day.status === "missed" && "bg-muted text-muted-foreground",
                                    day.status === "future" && "border border-border bg-background text-foreground",
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
                                                <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
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
                <section className="rounded-[24px] bg-card p-5 shadow-sm border border-border">
                    <p className="mb-4 flex items-center gap-2 text-sm font-semibold">
                        <BarChart3 className="h-4 w-4 text-emerald-500" />
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
                                        transition={{ duration: 0.6, ease: "easeOut" }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── Streak nudge ── */}
                <div className={cn(
                    "rounded-[24px] p-5 border",
                    streakBroken
                        ? "bg-rose-50 dark:bg-rose-500/10 border-rose-200/60 dark:border-rose-500/20"
                        : "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200/60 dark:border-emerald-500/20"
                )}>
                    <p className={cn("text-xs font-semibold mb-1", streakBroken ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400")}>
                        {streakBroken ? "Streak reminder" : "No broken streaks 🌱"}
                    </p>
                    <p className="text-sm text-foreground">
                        {streakBroken
                            ? "It's okay. Every day is a fresh start. Tap a habit to check it off."
                            : "No broken streaks right now. Keep this momentum going."}
                    </p>
                </div>

                {/* ── Daily quote ── */}
                <section className="rounded-[24px] bg-gradient-to-br from-emerald-100 via-amber-50 to-white p-5 border border-emerald-100 dark:from-emerald-500/20 dark:via-amber-500/15 dark:to-card dark:border-emerald-500/20">
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Daily note</p>
                    <p className="mt-2 text-base font-semibold text-foreground">"{quoteOfTheDay}"</p>
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
                            className="flex w-full items-center justify-center gap-2 rounded-[24px] border-2 border-dashed border-border py-5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
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
                                <div className="grid grid-cols-3 gap-2">
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
                                className="flex h-11 w-full items-center justify-center rounded-2xl bg-foreground text-sm font-semibold text-background disabled:opacity-40 disabled:cursor-not-allowed transition-transform hover:scale-[1.02] active:scale-[0.98]"
                            >
                                Save habit
                            </button>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
}
