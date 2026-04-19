import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronRight, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TherapistFilters, defaultFilters } from "@/lib/types/therapist-bridge";
import { DURATION, EASE } from "@/lib/redesign/tokens";

/**
 * Structured intake — four short questions to set the directory filters.
 *
 * We deliberately avoid:
 *   - Multi-select on every step (decision fatigue, not what a person in
 *     distress can do well).
 *   - Pre-filling answers (a primed default biases them).
 *   - "Required" labels (this is voluntary; partial intake still helps).
 *
 * The result is converted into TherapistFilters and pushed to the directory.
 */

type IntakeAnswers = {
    need: string | null;
    language: string | null;
    modality: "online" | "in-person" | "either" | null;
    budget: "≤1200" | "≤1500" | "≤2000" | "no-limit" | null;
};

const NEED_OPTIONS: { id: string; label: string; spec: string[] }[] = [
    { id: "anxiety", label: "Anxiety or panic", spec: ["Anxiety", "Panic"] },
    { id: "low-mood", label: "Low mood or depression", spec: ["Depression"] },
    { id: "academic", label: "Academic / career stress", spec: ["Academic Stress", "Career Counseling", "Career Anxiety", "Work Stress"] },
    { id: "relationships", label: "Relationships or family", spec: ["Relationships", "Relationship Issues", "Family Issues", "Family Conflict"] },
    { id: "loneliness", label: "Loneliness or identity", spec: ["Loneliness", "Identity", "Self-Esteem"] },
    { id: "burnout", label: "Burnout or exhaustion", spec: ["Burnout", "Work Stress"] },
    { id: "trauma", label: "Past trauma", spec: ["Trauma-Informed Care"] },
    { id: "not-sure", label: "Not sure yet", spec: [] },
];

const LANGUAGE_OPTIONS = [
    "Hindi",
    "English",
    "Tamil",
    "Bengali",
    "Punjabi",
    "Urdu",
    "Malayalam",
] as const;

const MODALITY_OPTIONS: { id: NonNullable<IntakeAnswers["modality"]>; label: string; sub: string }[] = [
    { id: "online", label: "Online", sub: "Video session from home" },
    { id: "in-person", label: "In-person", sub: "Meet in their clinic" },
    { id: "either", label: "Either is fine", sub: "Show me both" },
];

const BUDGET_OPTIONS: { id: NonNullable<IntakeAnswers["budget"]>; label: string; sub: string; max: number }[] = [
    { id: "≤1200", label: "Up to ₹1,200", sub: "per session", max: 1200 },
    { id: "≤1500", label: "Up to ₹1,500", sub: "per session", max: 1500 },
    { id: "≤2000", label: "Up to ₹2,000", sub: "per session", max: 2000 },
    { id: "no-limit", label: "No limit", sub: "show me everyone", max: 5000 },
];

const STORAGE_KEY = "mm-therapist-intake";

const loadAnswers = (): IntakeAnswers => {
    if (typeof window === "undefined") return { need: null, language: null, modality: null, budget: null };
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { need: null, language: null, modality: null, budget: null };
        return JSON.parse(raw);
    } catch {
        return { need: null, language: null, modality: null, budget: null };
    }
};

const saveAnswers = (answers: IntakeAnswers) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
};

export const intakeToFilters = (answers: IntakeAnswers): TherapistFilters => {
    const need = NEED_OPTIONS.find((n) => n.id === answers.need);
    const budget = BUDGET_OPTIONS.find((b) => b.id === answers.budget);
    const location: string[] =
        answers.modality === "online" ? ["Online"] : answers.modality === "in-person" ? [] : [];

    return {
        languages: answers.language ? [answers.language] : [],
        specializations: need?.spec ?? [],
        location,
        availability: [],
        priceRange: {
            min: defaultFilters.priceRange.min,
            max: budget?.max ?? defaultFilters.priceRange.max,
        },
    };
};

const eyebrow = "text-[11px] font-medium uppercase tracking-[0.2em] text-ink-5";

const Chip = ({
    selected,
    onClick,
    children,
    sub,
}: {
    selected: boolean;
    onClick: () => void;
    children: React.ReactNode;
    sub?: string;
}) => (
    <button
        type="button"
        onClick={onClick}
        className={cn(
            "group inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 py-2 text-left text-[13.5px] transition-all duration-200",
            selected
                ? "border-[hsl(var(--accent-500))] bg-[hsl(var(--accent-100))] text-ink-8 shadow-sm"
                : "border-border/50 bg-background text-ink-7 hover:border-ink-3 hover:bg-[hsl(var(--ink-1))]",
        )}
        aria-pressed={selected}
    >
        <span
            className={cn(
                "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors",
                selected
                    ? "bg-[hsl(var(--accent-500))] text-white"
                    : "bg-[hsl(var(--ink-1))] text-transparent",
            )}
            aria-hidden
        >
            <Check className="h-3 w-3" strokeWidth={2.5} />
        </span>
        <span className="leading-tight">
            <span className="block">{children}</span>
            {sub && <span className="block text-[11px] text-ink-5">{sub}</span>}
        </span>
    </button>
);

interface IntakeFormProps {
    onApply: (filters: TherapistFilters, hasAnyAnswer: boolean) => void;
}

const IntakeForm = ({ onApply }: IntakeFormProps) => {
    const [answers, setAnswers] = useState<IntakeAnswers>({
        need: null,
        language: null,
        modality: null,
        budget: null,
    });
    const [applied, setApplied] = useState(false);

    useEffect(() => {
        const loaded = loadAnswers();
        setAnswers(loaded);
        const hasAny = Boolean(loaded.need || loaded.language || loaded.modality || loaded.budget);
        if (hasAny) {
            onApply(intakeToFilters(loaded), true);
            setApplied(true);
        }
    }, [onApply]);

    const completedCount = useMemo(
        () => Object.values(answers).filter(Boolean).length,
        [answers],
    );

    const update = (patch: Partial<IntakeAnswers>) => {
        const next = { ...answers, ...patch };
        setAnswers(next);
        saveAnswers(next);
        setApplied(false);
    };

    const handleApply = () => {
        const filters = intakeToFilters(answers);
        onApply(filters, completedCount > 0);
        setApplied(true);
        document.getElementById("find-therapist")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const handleReset = () => {
        const cleared: IntakeAnswers = { need: null, language: null, modality: null, budget: null };
        setAnswers(cleared);
        saveAnswers(cleared);
        setApplied(false);
        onApply(defaultFilters, false);
    };

    return (
        <motion.section
            id="intake"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.long, ease: EASE.outExpo, delay: 0.05 }}
            className={cn(
                "relative mb-12 overflow-hidden rounded-[1.75rem] border border-ink-3/40 bg-[hsl(var(--card))] p-6 sm:p-8",
                "dark:border-ink-3/30 dark:bg-[hsl(var(--ink-2))]",
            )}
        >
            <div
                className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-[hsl(var(--accent-100))]/30 blur-3xl dark:bg-[hsl(var(--accent-500))]/10"
                aria-hidden
            />

            <header className="relative mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0 max-w-2xl space-y-2">
                    <p className={eyebrow}>Quick intake · 4 questions</p>
                    <h2 className="font-display text-[22px] font-normal leading-tight tracking-tight text-ink-8 md:text-[26px]">
                        Tell us a little, and we&apos;ll narrow the list for you.
                    </h2>
                    <p className="text-[14px] leading-relaxed text-ink-5">
                        None of this is required. You can change any of it later, or just scroll
                        and pick on instinct.
                    </p>
                </div>
                {completedCount > 0 && (
                    <button
                        type="button"
                        onClick={handleReset}
                        className="inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-[12px] text-ink-5 transition-colors hover:bg-[hsl(var(--ink-1))] hover:text-ink-7 sm:self-end"
                    >
                        <RotateCcw className="h-3 w-3" />
                        Start over
                    </button>
                )}
            </header>

            <div className="relative space-y-7">
                {/* Q1 — Need */}
                <div>
                    <p className="mb-3 text-[13px] font-medium text-ink-7">
                        <span className="mr-2 text-ink-5">01</span>
                        What feels heaviest right now?
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {NEED_OPTIONS.map((opt) => (
                            <Chip
                                key={opt.id}
                                selected={answers.need === opt.id}
                                onClick={() => update({ need: answers.need === opt.id ? null : opt.id })}
                            >
                                {opt.label}
                            </Chip>
                        ))}
                    </div>
                </div>

                {/* Q2 — Language */}
                <div>
                    <p className="mb-3 text-[13px] font-medium text-ink-7">
                        <span className="mr-2 text-ink-5">02</span>
                        Which language feels most natural?
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {LANGUAGE_OPTIONS.map((lang) => (
                            <Chip
                                key={lang}
                                selected={answers.language === lang}
                                onClick={() =>
                                    update({ language: answers.language === lang ? null : lang })
                                }
                            >
                                {lang}
                            </Chip>
                        ))}
                    </div>
                </div>

                {/* Q3 — Modality */}
                <div>
                    <p className="mb-3 text-[13px] font-medium text-ink-7">
                        <span className="mr-2 text-ink-5">03</span>
                        How would you like to meet?
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {MODALITY_OPTIONS.map((opt) => (
                            <Chip
                                key={opt.id}
                                selected={answers.modality === opt.id}
                                onClick={() =>
                                    update({ modality: answers.modality === opt.id ? null : opt.id })
                                }
                                sub={opt.sub}
                            >
                                {opt.label}
                            </Chip>
                        ))}
                    </div>
                </div>

                {/* Q4 — Budget */}
                <div>
                    <p className="mb-3 text-[13px] font-medium text-ink-7">
                        <span className="mr-2 text-ink-5">04</span>
                        What&apos;s comfortable for you per session?
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {BUDGET_OPTIONS.map((opt) => (
                            <Chip
                                key={opt.id}
                                selected={answers.budget === opt.id}
                                onClick={() =>
                                    update({ budget: answers.budget === opt.id ? null : opt.id })
                                }
                                sub={opt.sub}
                            >
                                {opt.label}
                            </Chip>
                        ))}
                    </div>
                    <p className="mt-2 text-[12px] text-ink-5">
                        Sliding-scale and student-rate options exist — you can ask the therapist
                        directly after booking.
                    </p>
                </div>
            </div>

            <div className="relative mt-7 flex flex-col items-start justify-between gap-3 border-t border-border/40 pt-5 sm:flex-row sm:items-center">
                <p className="text-[12.5px] text-ink-5">
                    {completedCount === 0
                        ? "Pick whatever you're sure about, skip the rest."
                        : `${completedCount} of 4 filled — that's plenty to narrow things.`}
                </p>
                <Button
                    type="button"
                    onClick={handleApply}
                    className="h-11 gap-1.5 rounded-full bg-[hsl(var(--accent-500))] px-5 text-white shadow-sm hover:bg-[hsl(var(--accent-600))]"
                >
                    <AnimatePresence mode="wait" initial={false}>
                        {applied ? (
                            <motion.span
                                key="applied"
                                initial={{ opacity: 0, x: -4 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 4 }}
                                transition={{ duration: 0.18 }}
                                className="inline-flex items-center gap-1.5"
                            >
                                <Check className="h-4 w-4" />
                                Filters applied
                            </motion.span>
                        ) : (
                            <motion.span
                                key="apply"
                                initial={{ opacity: 0, x: -4 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 4 }}
                                transition={{ duration: 0.18 }}
                                className="inline-flex items-center gap-1.5"
                            >
                                Show me matches
                                <ChevronRight className="h-4 w-4" />
                            </motion.span>
                        )}
                    </AnimatePresence>
                </Button>
            </div>
        </motion.section>
    );
};

export default IntakeForm;
