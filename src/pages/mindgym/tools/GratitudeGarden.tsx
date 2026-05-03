import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Flame, Flower2, Plus, Sparkles, Star, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ToolShell from "@/components/mindgym/ToolShell";
import { cn } from "@/lib/utils";
import { incrementMindGymCounter } from "@/lib/mindgym/analytics";

interface GratitudeGardenProps {
    onAvatarCue?: (text: string, emotion: string) => void;
}

type GardenTag = "people" | "moments" | "health" | "growth" | "simple things";

interface GardenEntry {
    id: string;
    text: string;
    createdAt: string;
    plantType: number;
    tags: GardenTag[];
}

interface GardenData {
    entries: GardenEntry[];
}

const STORAGE_KEY = "mindmitra_gratitude_garden_v1";
const DAILY_BLOOMS = 3;
const STREAK_DOTS = 7;
const GARDEN_TAGS: GardenTag[] = ["people", "moments", "health", "growth", "simple things"];

const CLINICAL_LEAD = "Gratitude journaling helps strengthen positive emotion, reduce depressive symptoms, and improve sleep quality.";
const CLINICAL_CITATION = "(Emmons & McCullough, 2003)";
const CLINICAL_BASIS = `${CLINICAL_LEAD} ${CLINICAL_CITATION}`;

const BLOOM_TONES = [
    { stem: "#5e7a4a", bloom: "#E8938A", glow: "rgba(232, 147, 138, 0.42)" },
    { stem: "#4f6b3f", bloom: "#9CAF88", glow: "rgba(156, 175, 136, 0.42)" },
    { stem: "#7c6a3a", bloom: "#E8C97A", glow: "rgba(232, 201, 122, 0.42)" },
] as const;

const BLOOM_POSITIONS = [
    { x: 180, baseY: 352, stemHeight: 124 },
    { x: 400, baseY: 360, stemHeight: 146 },
    { x: 620, baseY: 354, stemHeight: 130 },
] as const;

const STARFIELD = Array.from({ length: 28 }, (_, index) => ({
    cx: 22 + (index * 41) % 748,
    cy: 16 + (index * 59) % 118,
    r: 0.7 + (index % 4) * 0.22,
    opacity: 0.24 + (index % 5) * 0.11,
    duration: 2.1 + (index % 4) * 0.65,
    delay: (index % 7) * 0.17,
}));

function isGardenTag(value: unknown): value is GardenTag {
    return typeof value === "string" && GARDEN_TAGS.includes(value as GardenTag);
}

function startOfLocalDay(value: string | Date): Date {
    const date = typeof value === "string" ? new Date(value) : value;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayKey(value: string | Date): string {
    const date = typeof value === "string" ? new Date(value) : value;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function normalizeEntry(raw: Partial<GardenEntry> & { date?: string; tags?: unknown[] }): GardenEntry {
    const createdAt = raw.createdAt ?? raw.date ?? new Date().toISOString();
    const tags = Array.isArray(raw.tags) ? raw.tags.filter(isGardenTag) : [];

    return {
        id: raw.id ?? `${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
        text: typeof raw.text === "string" ? raw.text : "",
        createdAt,
        plantType: typeof raw.plantType === "number" ? raw.plantType : 0,
        tags: tags.length > 0 ? tags : ["simple things"],
    };
}

function loadGarden(): GardenData {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return { entries: [] };
        }

        const parsed = JSON.parse(raw) as { entries?: Array<Partial<GardenEntry> & { date?: string; tags?: unknown[] }> };
        if (!Array.isArray(parsed.entries)) {
            return { entries: [] };
        }

        return {
            entries: parsed.entries
                .map(normalizeEntry)
                .filter((entry) => entry.text.trim().length > 0),
        };
    } catch {
        return { entries: [] };
    }
}

function saveGarden(data: GardenData): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function countCurrentStreak(entries: GardenEntry[]): number {
    if (entries.length === 0) {
        return 0;
    }

    const uniqueDays = new Set(entries.map((entry) => dayKey(entry.createdAt)));
    const latestTimestamp = Math.max(...entries.map((entry) => new Date(entry.createdAt).getTime()));
    const latestDay = startOfLocalDay(new Date(latestTimestamp));
    const today = startOfLocalDay(new Date());
    const diffDays = Math.round((today.getTime() - latestDay.getTime()) / 86400000);

    if (diffDays > 1) {
        return 0;
    }

    let streak = 0;
    const cursor = new Date(latestDay);

    while (uniqueDays.has(dayKey(cursor))) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
}

function getTone(plantType: number) {
    return BLOOM_TONES[plantType % BLOOM_TONES.length];
}

function formatEntryTimestamp(): string {
    return "planted just now";
}

function FlowerStemSlot({
    entry,
    index,
    pulseSlot,
    pulseNonce,
    selected,
    onSelect,
}: {
    entry?: GardenEntry;
    index: number;
    pulseSlot: number | null;
    pulseNonce: number;
    selected: boolean;
    onSelect?: () => void;
}) {
    const tone = BLOOM_TONES[index % BLOOM_TONES.length];
    const hasBloom = Boolean(entry);
    const stemHeight = Math.max(94, 110 + index * 6);
    const isPulsing = hasBloom && pulseSlot === index;
    const bloomKey = isPulsing ? `${entry?.id ?? index}-${pulseNonce}` : entry?.id ?? `empty-${index}`;

    return (
        <motion.g
            onClick={hasBloom ? onSelect : undefined}
            className={cn(hasBloom ? "cursor-pointer" : "cursor-default")}
            initial={{ scaleY: 0.35, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 92, damping: 14, delay: index * 0.12 }}
            whileHover={hasBloom ? { y: -4, scale: 1.03 } : undefined}
            style={{ transformOrigin: "50% 100%" }}
        >
            <motion.line
                x1="0"
                y1="0"
                x2="0"
                y2={-stemHeight}
                stroke={tone.stem}
                strokeWidth={2.5}
                strokeLinecap="round"
                opacity={hasBloom ? 1 : 0.5}
            />
            <motion.circle
                key={bloomKey}
                cx={0}
                cy={-stemHeight}
                r={hasBloom ? 13 : 7}
                fill={hasBloom ? tone.bloom : "rgba(80, 60, 40, 0.10)"}
                stroke={selected && hasBloom ? "rgba(63, 107, 71, 0.65)" : "rgba(80, 60, 40, 0.18)"}
                strokeWidth={selected && hasBloom ? 1.4 : 1}
                initial={isPulsing ? { scale: 0.55, opacity: 0 } : { scale: hasBloom ? 1 : 0.9, opacity: hasBloom ? 1 : 0.35 }}
                animate={isPulsing ? { scale: [0.55, 1.22, 1], opacity: [0, 1, 1] } : { scale: hasBloom ? 1 : 0.9, opacity: hasBloom ? 1 : 0.35 }}
                transition={isPulsing ? { duration: 0.75, ease: "easeOut" } : { duration: 0.35 }}
            />
            {hasBloom && (
                <motion.circle
                    cx={0}
                    cy={-stemHeight}
                    r={18}
                    fill="none"
                    stroke={selected ? tone.bloom : tone.glow}
                    strokeWidth={1}
                    opacity={selected ? 0.5 : 0.25}
                    animate={isPulsing ? { scale: [0.8, 1.15, 1], opacity: [0.05, 0.35, 0.2] } : undefined}
                    transition={isPulsing ? { duration: 0.75, ease: "easeOut" } : undefined}
                />
            )}
        </motion.g>
    );
}

function GardenScene({
    entries,
    selectedEntryId,
    pulseSlot,
    pulseNonce,
    onSelectEntry,
}: {
    entries: GardenEntry[];
    selectedEntryId: string | null;
    pulseSlot: number | null;
    pulseNonce: number;
    onSelectEntry: (entryId: string) => void;
}) {
    return (
        <div className="relative min-h-[300px] overflow-hidden rounded-[32px] border border-black/10 bg-[#FBF6EC] shadow-[0_24px_60px_-30px_rgba(80,60,40,0.30)]">
            <svg viewBox="0 0 800 420" className="block h-auto w-full" aria-hidden="true">
                <defs>
                    <linearGradient id="gardenSky" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FBF6EC" />
                        <stop offset="100%" stopColor="#E8DFC8" />
                    </linearGradient>
                    <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="rgba(244, 184, 156, 0.36)" />
                        <stop offset="100%" stopColor="rgba(244, 184, 156, 0)" />
                    </radialGradient>
                </defs>

                <rect width="800" height="420" fill="url(#gardenSky)" />
                <ellipse cx="660" cy="76" rx="74" ry="74" fill="url(#moonGlow)" />

                {STARFIELD.map((star, index) => (
                    <motion.circle
                        key={index}
                        cx={star.cx}
                        cy={star.cy}
                        r={star.r}
                        fill="#E8C97A"
                        initial={{ opacity: star.opacity * 0.5, scale: 0.85 }}
                        animate={{ opacity: [star.opacity * 0.6, star.opacity, star.opacity * 0.6], scale: [0.88, 1, 0.9] }}
                        transition={{ duration: star.duration, repeat: Infinity, delay: star.delay, ease: "easeInOut" }}
                    />
                ))}

                <ellipse cx="220" cy="330" rx="380" ry="120" fill="#9CAF88" opacity="0.55" />
                <ellipse cx="560" cy="342" rx="350" ry="112" fill="#8FB07A" opacity="0.55" />
                <ellipse cx="400" cy="384" rx="520" ry="150" fill="#A8BC9A" opacity="0.70" />
                <path d="M0 362 C150 346, 290 346, 400 358 C518 370, 638 362, 800 348" fill="none" stroke="rgba(63, 107, 71, 0.30)" strokeWidth="1.5" />

                {BLOOM_POSITIONS.map((position, index) => {
                    const entry = entries[index];

                    return (
                        <g key={index} transform={`translate(${position.x}, ${position.baseY})`}>
                            <FlowerStemSlot
                                entry={entry}
                                index={index}
                                pulseSlot={pulseSlot}
                                pulseNonce={pulseNonce}
                                selected={selectedEntryId === entry?.id}
                                onSelect={entry ? () => onSelectEntry(entry.id) : undefined}
                            />
                        </g>
                    );
                })}
            </svg>

            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(244,184,156,0.18)_0%,rgba(251,246,236,0)_70%)]" />

            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-5 pb-4">
                <p className="text-[11px] text-[#5b4a3e]">Tap a bloom to revisit</p>
                <div className="rounded-full border border-[#3F6B47]/30 bg-white/65 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-[#3F6B47] backdrop-blur-sm">
                    {entries.length} of {DAILY_BLOOMS}
                </div>
            </div>
        </div>
    );
}

export default function GratitudeGarden({ onAvatarCue }: GratitudeGardenProps) {
    const navigate = useNavigate();
    const [garden, setGarden] = useState<GardenData>(loadGarden);
    const [draftText, setDraftText] = useState("");
    const [selectedTags, setSelectedTags] = useState<GardenTag[]>([]);
    const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
    const [pulseNonce, setPulseNonce] = useState(0);
    const [pulseSlot, setPulseSlot] = useState<number | null>(null);
    const announcedCueRef = useRef(false);

    const todayKey = dayKey(new Date());

    const todayEntries = useMemo(
        () => garden.entries.filter((entry) => dayKey(entry.createdAt) === todayKey),
        [garden.entries, todayKey]
    );

    const todayEntriesSorted = useMemo(
        () =>
            [...todayEntries].sort(
                (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
            ),
        [todayEntries]
    );

    const streakDays = useMemo(() => countCurrentStreak(garden.entries), [garden.entries]);
    const dayComplete = todayEntries.length >= DAILY_BLOOMS;

    const selectedEntry = useMemo(
        () => todayEntries.find((entry) => entry.id === selectedEntryId) ?? null,
        [selectedEntryId, todayEntries]
    );

    const visibleEntries = useMemo(() => {
        if (selectedTags.length === 0) {
            return todayEntriesSorted;
        }

        return todayEntriesSorted.filter((entry) => entry.tags.some((tag) => selectedTags.includes(tag)));
    }, [selectedTags, todayEntriesSorted]);

    useEffect(() => {
        if (announcedCueRef.current || !onAvatarCue) {
            return;
        }

        announcedCueRef.current = true;

        if (dayComplete) {
            onAvatarCue("Today's garden is tended. Tap a bloom to revisit it.", "proud");
            return;
        }

        if (todayEntries.length === 0) {
            onAvatarCue("Let's grow your gratitude garden. Pick a tag and plant your first bloom.", "warm");
            return;
        }

        onAvatarCue(
            `${DAILY_BLOOMS - todayEntries.length} bloom${DAILY_BLOOMS - todayEntries.length === 1 ? "" : "s"} left to plant today.`,
            "warm"
        );
    }, [dayComplete, onAvatarCue, todayEntries.length]);

    const handleTagToggle = useCallback((tag: GardenTag) => {
        setSelectedTags((current) =>
            current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag]
        );
    }, []);

    const handleSubmit = useCallback(() => {
        const trimmedText = draftText.trim();
        if (!trimmedText || dayComplete) {
            return;
        }

        const slotIndex = todayEntries.length;
        const entry: GardenEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            text: trimmedText,
            createdAt: new Date().toISOString(),
            plantType: slotIndex % BLOOM_TONES.length,
            tags: selectedTags.length > 0 ? selectedTags : ["simple things"],
        };

        const updatedGarden: GardenData = {
            entries: [...garden.entries, entry],
        };

        saveGarden(updatedGarden);
        setGarden(updatedGarden);
        setDraftText("");
        setSelectedEntryId(entry.id);
        setPulseSlot(slotIndex);
        setPulseNonce((value) => value + 1);
        incrementMindGymCounter("gratitude_entries", 1);

        const remaining = DAILY_BLOOMS - (slotIndex + 1);
        if (remaining <= 0) {
            onAvatarCue?.("Today's garden is tended. Tap a bloom to revisit it.", "proud");
        } else {
            onAvatarCue?.(`${remaining} bloom${remaining === 1 ? "" : "s"} left to plant today.`, "encouraging");
        }
    }, [dayComplete, draftText, garden.entries, onAvatarCue, selectedTags, todayEntries.length]);

    const handleReset = useCallback(() => {
        setDraftText("");
        setSelectedTags([]);
        setSelectedEntryId(null);
    }, []);

    return (
        <ToolShell
            toolId="gratitude-garden"
            title="Gratitude Garden"
            clinicalBasis={CLINICAL_BASIS}
            xp={30}
            themeAccent="emerald"
            surfaceTone="warm"
            backdropScene="companions"
            completed={dayComplete}
            onReset={handleReset}
            totalSteps={DAILY_BLOOMS}
            currentStep={todayEntries.length}
            onAvatarCue={onAvatarCue}
            showChrome={false}
            showCompletionScreen={false}
            showParticles={false}
            showSupportButton={false}
            contentPlacement="top"
        >
            <div
                className="mx-auto w-full max-w-4xl px-4 pb-10 pt-4 select-text"
                style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400 }}
            >
                <div className="mb-5 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={() => navigate("/mindgym")}
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/75 text-[#3a2a20] transition hover:border-[#3F6B47]/35 hover:bg-white shadow-sm"
                        aria-label="Back to MindGym"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>

                    <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                        <p className="text-[9px] uppercase tracking-[0.28em] text-[#9a4a2a]">MindGym ritual</p>
                        <h1 className="mt-1 font-serif-display italic text-[clamp(2rem,4.2vw,2.8rem)] font-light leading-none text-[#2a1c14]">
                            Gratitude Garden
                        </h1>
                    </div>

                    <div className="flex items-center gap-2 rounded-full border border-[#E8C97A]/55 bg-white/75 px-3 py-2 backdrop-blur-sm shadow-sm">
                        <Flame className="h-4 w-4 text-[#a06b1f]" />
                        <div className="leading-none">
                            <p className="text-[9px] uppercase tracking-[0.22em] text-[#7a6556]">Streak</p>
                            <p className="mt-0.5 text-sm text-[#2a1c14] font-medium">{streakDays}-day</p>
                        </div>
                    </div>
                </div>

                <div className="rounded-[24px] border border-black/8 bg-white/72 px-4 py-3 backdrop-blur-sm shadow-[0_8px_24px_-14px_rgba(80,60,40,0.20)]">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E8C97A]/35 text-[#a06b1f]">
                            <Star className="h-4 w-4" fill="currentColor" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[9px] uppercase tracking-[0.24em] text-[#3F6B47]">Clinical basis</p>
                            <p className="mt-1 text-sm leading-6 text-[#3a2a20]">
                                {CLINICAL_LEAD}{" "}
                                <span className="inline-flex rounded-full border border-[#3F6B47]/25 bg-[#9CAF88]/22 px-2 py-0.5 text-[#3F6B47]">
                                    {CLINICAL_CITATION}
                                </span>
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-1.5">
                        {Array.from({ length: STREAK_DOTS }, (_, index) => (
                            <span
                                key={index}
                                className={cn(
                                    "h-2.5 w-2.5 rounded-full transition-colors",
                                    index < Math.min(streakDays, STREAK_DOTS) ? "bg-[#E8C97A]" : "bg-[#9a8674]/35"
                                )}
                            />
                        ))}
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#7a6556]">
                        {streakDays}-day streak — keep growing.
                    </p>
                </div>

                <div className="mt-5">
                    <GardenScene
                        entries={todayEntries}
                        selectedEntryId={selectedEntryId}
                        pulseSlot={pulseSlot}
                        pulseNonce={pulseNonce}
                        onSelectEntry={setSelectedEntryId}
                    />
                </div>

                <AnimatePresence mode="wait">
                    {selectedEntry && (
                        <motion.div
                            key={selectedEntry.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                            className="mt-4 rounded-[22px] border border-black/8 bg-white/72 px-4 py-4 backdrop-blur-sm shadow-[0_10px_28px_-16px_rgba(80,60,40,0.22)]"
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/8 bg-[#FBF6EC]">
                                    <Flower2 className="h-5 w-5" style={{ color: getTone(selectedEntry.plantType).bloom }} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[9px] uppercase tracking-[0.24em] text-[#3F6B47]">Bloom revisited</p>
                                    <p className="mt-2 font-serif-display italic text-base leading-6 text-[#2a1c14]">“{selectedEntry.text}”</p>
                                    <p className="mt-2 text-[11px] text-[#9a8674]">{formatEntryTimestamp()}</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {selectedEntry.tags.map((tag) => (
                                            <span
                                                key={tag}
                                                className="rounded-full border border-black/8 bg-white/65 px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-[#5b4a3e]"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedEntryId(null)}
                                    className="mt-0.5 rounded-full p-1.5 text-[#7a6556] transition hover:bg-white/85 hover:text-[#2a1c14]"
                                    aria-label="Close bloom detail"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {dayComplete && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            transition={{ duration: 0.25, ease: "easeOut" }}
                            className="mt-4 rounded-[24px] border border-black/8 bg-white/75 px-4 py-4 backdrop-blur-sm shadow-[0_10px_28px_-16px_rgba(80,60,40,0.22)]"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E8C97A]/35 text-[#a06b1f]">
                                    <Sparkles className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="font-serif-display italic text-[1.55rem] font-light leading-none text-[#2a1c14]">
                                        Today&apos;s garden is tended
                                    </h2>
                                    <p className="mt-1 text-sm text-[#5b4a3e]">Three gratitude blooms are already in the ground.</p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <section className="mt-5" style={{ opacity: dayComplete ? 0.55 : 1 }}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[9px] uppercase tracking-[0.24em] text-[#3F6B47]">Tags</p>
                            <p className="mt-1 text-sm text-[#5b4a3e]">Choose one or more tags to filter and plant with intention.</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {GARDEN_TAGS.map((tag) => {
                            const isActive = selectedTags.includes(tag);

                            return (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => handleTagToggle(tag)}
                                    className={cn(
                                        "rounded-full border px-3.5 py-2 text-sm transition-all",
                                        isActive
                                            ? "border-[#3F6B47]/55 bg-[#3F6B47] text-white shadow-[0_8px_20px_-10px_rgba(63,107,71,0.45)]"
                                            : "border-black/10 bg-white/72 text-[#5b4a3e] hover:border-[#3F6B47]/35 hover:text-[#2a1c14] hover:bg-white/90 backdrop-blur-sm"
                                    )}
                                >
                                    {tag}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-4 rounded-[28px] border border-[#3F6B47]/22 bg-white/75 px-4 py-4 backdrop-blur-sm shadow-[0_18px_44px_-22px_rgba(80,60,40,0.22)]">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                                <p className="text-[9px] uppercase tracking-[0.24em] text-[#3F6B47]">Plant an entry</p>
                                <p className="mt-1 text-sm text-[#5b4a3e]">Write one gratitude note and press Enter to plant it.</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={!draftText.trim() || dayComplete}
                                className={cn(
                                    "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-all",
                                    draftText.trim() && !dayComplete
                                        ? "bg-[#3F6B47] text-white shadow-[0_10px_26px_-12px_rgba(63,107,71,0.45)] hover:bg-[#345a3b]"
                                        : "cursor-not-allowed bg-white/55 text-[#9a8674] border border-black/8"
                                )}
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Plant
                            </button>
                        </div>

                        <textarea
                            value={draftText}
                            onChange={(event) => setDraftText(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
                                    event.preventDefault();
                                    handleSubmit();
                                }
                            }}
                            placeholder="I'm grateful for..."
                            readOnly={dayComplete}
                            maxLength={500}
                            className={cn(
                                "mt-4 h-28 w-full resize-none rounded-[22px] border bg-white/50 px-4 py-3 text-sm leading-7 text-[#2a1c14] placeholder:text-[#9a8674] outline-none transition backdrop-blur-sm",
                                dayComplete
                                    ? "cursor-not-allowed border-black/8"
                                    : "border-[#3F6B47]/22 focus:border-[#3F6B47]/55 focus:ring-2 focus:ring-[#3F6B47]/25"
                            )}
                            style={{ fontWeight: 400 }}
                        />

                        <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-[#9a8674]">
                            <span>{draftText.length}/500</span>
                            <span className="uppercase tracking-[0.18em] text-[#7a6556]">Enter to plant</span>
                        </div>
                    </div>
                </section>

                <section className="mt-6 pb-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-[9px] uppercase tracking-[0.24em] text-[#7a6556]">Planted entries</p>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-[#9a8674]">{visibleEntries.length} shown</p>
                    </div>

                    <div className="space-y-3">
                        {visibleEntries.length > 0 ? (
                            visibleEntries.map((entry) => {
                                const tone = getTone(entry.plantType);
                                const isSelected = selectedEntryId === entry.id;

                                return (
                                    <motion.button
                                        key={entry.id}
                                        type="button"
                                        onClick={() => setSelectedEntryId(entry.id)}
                                        whileTap={{ scale: 0.995 }}
                                        className={cn(
                                            "w-full rounded-[22px] border bg-white/68 px-4 py-3.5 text-left transition-all backdrop-blur-sm shadow-[0_6px_18px_-12px_rgba(80,60,40,0.18)]",
                                            isSelected
                                                ? "border-[#3F6B47]/45 bg-white/85"
                                                : "border-black/8 hover:border-[#3F6B47]/30 hover:bg-white/82"
                                        )}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/8 bg-[#FBF6EC]">
                                                <Flower2 className="h-4 w-4" style={{ color: tone.bloom }} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start justify-between gap-3">
                                                    <p className="text-sm leading-6 text-[#2a1c14]">{entry.text}</p>
                                                    <span className="shrink-0 text-[11px] text-[#9a8674]">{formatEntryTimestamp()}</span>
                                                </div>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {entry.tags.map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className="rounded-full border border-black/8 bg-white/60 px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-[#5b4a3e]"
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.button>
                                );
                            })
                        ) : (
                            <div className="rounded-[22px] border border-black/8 bg-white/68 px-4 py-4 text-sm text-[#5b4a3e] backdrop-blur-sm">
                                {todayEntries.length === 0
                                    ? "Your garden is waiting for the first bloom of the day."
                                    : "No blooms match the current tag filter yet."}
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </ToolShell>
    );
}
