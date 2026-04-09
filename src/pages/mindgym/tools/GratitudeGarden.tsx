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
    { stem: "#3a735a", bloom: "#E8938A", glow: "rgba(232, 147, 138, 0.36)" },
    { stem: "#2f8d74", bloom: "#2DD4A0", glow: "rgba(45, 212, 160, 0.34)" },
    { stem: "#7c6a3a", bloom: "#E8C97A", glow: "rgba(232, 201, 122, 0.34)" },
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

const PLAYFAIR_STYLE = {
    fontFamily: "'Playfair Display', serif",
    fontStyle: "italic",
} as const;

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
                fill={hasBloom ? tone.bloom : "rgba(232, 244, 240, 0.16)"}
                stroke={selected && hasBloom ? "rgba(232, 244, 240, 0.8)" : "rgba(232, 244, 240, 0.18)"}
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
        <div className="relative min-h-[300px] overflow-hidden rounded-[32px] border border-white/10 bg-[#0A1628] shadow-[0_30px_80px_rgba(2,6,23,0.42)]">
            <svg viewBox="0 0 800 420" className="block h-auto w-full" aria-hidden="true">
                <defs>
                    <linearGradient id="gardenSky" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0A1628" />
                        <stop offset="100%" stopColor="#0B1A2E" />
                    </linearGradient>
                    <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="rgba(232, 201, 122, 0.28)" />
                        <stop offset="100%" stopColor="rgba(232, 201, 122, 0)" />
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
                        fill="#E8F4F0"
                        initial={{ opacity: star.opacity * 0.7, scale: 0.85 }}
                        animate={{ opacity: [star.opacity * 0.6, star.opacity, star.opacity * 0.6], scale: [0.88, 1, 0.9] }}
                        transition={{ duration: star.duration, repeat: Infinity, delay: star.delay, ease: "easeInOut" }}
                    />
                ))}

                <ellipse cx="220" cy="330" rx="380" ry="120" fill="#183123" opacity="0.9" />
                <ellipse cx="560" cy="342" rx="350" ry="112" fill="#132A1F" opacity="0.92" />
                <ellipse cx="400" cy="384" rx="520" ry="150" fill="#1A3A2A" />
                <path d="M0 362 C150 346, 290 346, 400 358 C518 370, 638 362, 800 348" fill="none" stroke="rgba(45, 212, 160, 0.12)" strokeWidth="1.5" />

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

            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(45,212,160,0.08)_0%,rgba(10,22,40,0)_70%)]" />

            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-5 pb-4">
                <p className="text-[11px] text-[#8FBBAA]">Tap a bloom to revisit</p>
                <div className="rounded-full border border-[#2DD4A0]/20 bg-black/30 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-[#8FBBAA] backdrop-blur-sm">
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
            themeColor="from-[#07111f] via-[#0A1628] to-[#07111f]"
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
                style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}
            >
                <div className="mb-5 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={() => navigate("/mindgym")}
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#E8F4F0] transition hover:border-[#2DD4A0]/30 hover:bg-white/10"
                        aria-label="Back to MindGym"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>

                    <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                        <p className="text-[9px] uppercase tracking-[0.28em] text-[#8FBBAA]">MindGym ritual</p>
                        <h1 className="mt-1 text-[clamp(2rem,4.2vw,2.8rem)] leading-none text-[#E8F4F0]" style={PLAYFAIR_STYLE}>
                            Gratitude Garden
                        </h1>
                    </div>

                    <div className="flex items-center gap-2 rounded-full border border-[#E8C97A]/25 bg-[rgba(255,255,255,0.04)] px-3 py-2">
                        <Flame className="h-4 w-4 text-[#E8C97A]" />
                        <div className="leading-none">
                            <p className="text-[9px] uppercase tracking-[0.22em] text-[#8FBBAA]">Streak</p>
                            <p className="mt-0.5 text-sm text-[#E8F4F0]">{streakDays}-day</p>
                        </div>
                    </div>
                </div>

                <div className="rounded-[24px] border-[0.5px] border-[#2DD4A0]/30 bg-[rgba(26,107,82,0.3)] px-4 py-3 backdrop-blur-sm">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2DD4A0]/12 text-[#E8C97A]">
                            <Star className="h-4 w-4" fill="currentColor" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[9px] uppercase tracking-[0.24em] text-[#2DD4A0]">Clinical basis</p>
                            <p className="mt-1 text-sm leading-6 text-[#E8F4F0]/88">
                                {CLINICAL_LEAD}{" "}
                                <span className="inline-flex rounded-full border border-[#2DD4A0]/20 bg-[#2DD4A0]/10 px-2 py-0.5 text-[#E8F4F0]">
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
                                    index < Math.min(streakDays, STREAK_DOTS) ? "bg-[#E8C97A]" : "bg-[#5A8A76]/30"
                                )}
                            />
                        ))}
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#8FBBAA]">
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
                            className="mt-4 rounded-[22px] border border-white/10 bg-[rgba(255,255,255,0.04)] px-4 py-4"
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/20">
                                    <Flower2 className="h-5 w-5" style={{ color: getTone(selectedEntry.plantType).bloom }} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[9px] uppercase tracking-[0.24em] text-[#2DD4A0]">Bloom revisited</p>
                                    <p className="mt-2 text-sm leading-6 text-[#E8F4F0]">“{selectedEntry.text}”</p>
                                    <p className="mt-2 text-[11px] text-[#5A8A76]">{formatEntryTimestamp()}</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {selectedEntry.tags.map((tag) => (
                                            <span
                                                key={tag}
                                                className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-[#8FBBAA]"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedEntryId(null)}
                                    className="mt-0.5 rounded-full p-1.5 text-[#8FBBAA] transition hover:bg-white/5 hover:text-[#E8F4F0]"
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
                            className="mt-4 rounded-[24px] border border-white/10 bg-[rgba(255,255,255,0.04)] px-4 py-4"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E8C97A]/15 text-[#E8C97A]">
                                    <Sparkles className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-[1.55rem] leading-none text-[#E8F4F0]" style={PLAYFAIR_STYLE}>
                                        Today&apos;s garden is tended
                                    </h2>
                                    <p className="mt-1 text-sm text-[#8FBBAA]">Three gratitude blooms are already in the ground.</p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <section className="mt-5" style={{ opacity: dayComplete ? 0.45 : 1 }}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[9px] uppercase tracking-[0.24em] text-[#2DD4A0]">Tags</p>
                            <p className="mt-1 text-sm text-[#8FBBAA]">Choose one or more tags to filter and plant with intention.</p>
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
                                            ? "border-[#2DD4A0]/45 bg-[#2DD4A0] text-[#07111f] shadow-[0_10px_24px_rgba(45,212,160,0.18)]"
                                            : "border-white/10 bg-white/5 text-[#8FBBAA] hover:border-[#2DD4A0]/25 hover:text-[#E8F4F0]"
                                    )}
                                >
                                    {tag}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-4 rounded-[28px] border border-[#2DD4A0]/20 bg-[rgba(255,255,255,0.03)] px-4 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.16)]">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                                <p className="text-[9px] uppercase tracking-[0.24em] text-[#2DD4A0]">Plant an entry</p>
                                <p className="mt-1 text-sm text-[#8FBBAA]">Write one gratitude note and press Enter to plant it.</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={!draftText.trim() || dayComplete}
                                className={cn(
                                    "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-all",
                                    draftText.trim() && !dayComplete
                                        ? "bg-[#2DD4A0] text-[#07111f] shadow-[0_12px_30px_rgba(45,212,160,0.28)] hover:brightness-105"
                                        : "cursor-not-allowed bg-white/5 text-[#5A8A76]"
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
                                "mt-4 h-28 w-full resize-none rounded-[22px] border bg-transparent px-4 py-3 text-sm leading-7 text-[#E8F4F0] placeholder:text-[#5A8A76]/70 outline-none transition",
                                dayComplete
                                    ? "cursor-not-allowed border-white/10"
                                    : "border-[#2DD4A0]/20 focus:border-[#2DD4A0]/45 focus:ring-2 focus:ring-[#2DD4A0]/35"
                            )}
                            style={{ fontWeight: 300 }}
                        />

                        <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-[#5A8A76]">
                            <span>{draftText.length}/500</span>
                            <span className="uppercase tracking-[0.18em] text-[#8FBBAA]">Enter to plant</span>
                        </div>
                    </div>
                </section>

                <section className="mt-6 pb-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-[9px] uppercase tracking-[0.24em] text-[#8FBBAA]">Planted entries</p>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-[#5A8A76]">{visibleEntries.length} shown</p>
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
                                            "w-full rounded-[22px] border bg-[rgba(255,255,255,0.03)] px-4 py-3.5 text-left transition-all",
                                            isSelected
                                                ? "border-[#2DD4A0]/45 bg-[rgba(255,255,255,0.05)]"
                                                : "border-[#2DD4A0]/20 hover:border-[#2DD4A0]/30 hover:bg-[rgba(255,255,255,0.045)]"
                                        )}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/20">
                                                <Flower2 className="h-4 w-4" style={{ color: tone.bloom }} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start justify-between gap-3">
                                                    <p className="text-sm leading-6 text-[#E8F4F0]">{entry.text}</p>
                                                    <span className="shrink-0 text-[11px] text-[#5A8A76]">{formatEntryTimestamp()}</span>
                                                </div>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {entry.tags.map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-[#8FBBAA]"
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
                            <div className="rounded-[22px] border border-[#2DD4A0]/20 bg-[rgba(255,255,255,0.03)] px-4 py-4 text-sm text-[#8FBBAA]">
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
