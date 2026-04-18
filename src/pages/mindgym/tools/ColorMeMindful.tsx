import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ArrowLeft,
    Clock,
    Download,
    Eraser,
    Heart,
    Image as ImageIcon,
    Keyboard,
    Palette,
    Printer,
    Redo2,
    RotateCcw,
    Share2,
    Sparkles,
    Undo2,
    Wand2,
    Wind,
} from "lucide-react";
import { toast } from "sonner";
import ToolShell from "@/components/mindgym/ToolShell";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
    artworks,
    categories,
    getArtwork,
    type Artwork,
    type ArtworkCategory,
} from "./color-me-mindful/artworks";
import { ArtworkSVG } from "./color-me-mindful/ArtworkSVG";

type Swatch = {
    name: string;
    value: string;
};

type PaletteRow = {
    label: string;
    swatches: Swatch[];
};

const PALETTE_ROWS: PaletteRow[] = [
    {
        label: "Soft",
        swatches: [
            { name: "Sage", value: "#7D9B76" },
            { name: "Mist", value: "#A8C0A0" },
            { name: "Lavender", value: "#C8B5E8" },
            { name: "Sand", value: "#E4C79A" },
            { name: "Clay", value: "#D79E8F" },
            { name: "Sky", value: "#A9CBE6" },
            { name: "Honey", value: "#EBCB80" },
            { name: "Blush", value: "#E6BAC8" },
            { name: "White", value: "#F8F8F8" },
        ],
    },
    {
        label: "Vivid",
        swatches: [
            { name: "Teal", value: "#3BAE92" },
            { name: "Indigo", value: "#5980D6" },
            { name: "Plum", value: "#8D5BB7" },
            { name: "Coral", value: "#E45E72" },
            { name: "Tangerine", value: "#EA8A3A" },
            { name: "Gold", value: "#D9A423" },
            { name: "Leaf", value: "#70A04A" },
            { name: "Coffee", value: "#6A4D3E" },
            { name: "Charcoal", value: "#3B4250" },
        ],
    },
];

const SVG_ID = "mindgym-color-canvas";
const DRAFT_STORAGE_PREFIX = "color-me-mindful:draft:";
const FAVORITES_STORAGE_KEY = "color-me-mindful:favorites";
const isStrokeOnly = (d: string) => !/[zZ]/.test(d);

function suggestedArtworkForToday(): Artwork {
    const index = new Date().getDate() % artworks.length;
    return artworks[index] ?? artworks[0];
}

function formatElapsed(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function loadFavorites(): Set<string> {
    if (typeof window === "undefined") return new Set();
    try {
        const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? new Set(parsed.filter((x): x is string => typeof x === "string")) : new Set();
    } catch {
        return new Set();
    }
}

function loadDraft(artworkId: string): Record<string, string> | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(DRAFT_STORAGE_PREFIX + artworkId);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed as Record<string, string>;
        }
        return null;
    } catch {
        return null;
    }
}

function saveDraft(artworkId: string, fills: Record<string, string>) {
    if (typeof window === "undefined") return;
    try {
        if (Object.keys(fills).length === 0) {
            window.localStorage.removeItem(DRAFT_STORAGE_PREFIX + artworkId);
        } else {
            window.localStorage.setItem(DRAFT_STORAGE_PREFIX + artworkId, JSON.stringify(fills));
        }
    } catch {
        // Quota or private mode — silently skip.
    }
}

function createExportFileName(name: string, extension: string) {
    const safeName = name
        .trim()
        .replace(/[\\/:*?"<>|]+/g, "-")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

    return `${safeName || "artwork"}.${extension}`;
}

function flattenSvgForExport(svg: SVGSVGElement) {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const originalElements = Array.from(svg.querySelectorAll("rect, path"));
    const clonedElements = Array.from(clone.querySelectorAll("rect, path"));

    originalElements.forEach((originalElement, index) => {
        const cloneElement = clonedElements[index];
        if (!(originalElement instanceof SVGElement) || !(cloneElement instanceof SVGElement)) {
            return;
        }

        const computedStyle = window.getComputedStyle(originalElement);
        if (computedStyle.fill) {
            cloneElement.setAttribute("fill", computedStyle.fill);
        }
        if (computedStyle.stroke) {
            cloneElement.setAttribute("stroke", computedStyle.stroke);
        }
    });

    const { width, height } = svg.viewBox.baseVal;
    if (width > 0 && height > 0) {
        clone.setAttribute("width", String(width));
        clone.setAttribute("height", String(height));
    }

    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    return new XMLSerializer().serializeToString(clone);
}

function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function loadImage(url: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Unable to load exported artwork."));
        image.src = url;
    });
}

async function exportRasterArtwork(svg: SVGSVGElement, mimeType: "image/png" | "image/jpeg", quality?: number) {
    const source = flattenSvgForExport(svg);
    const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);

    try {
        const image = await loadImage(svgUrl);
        const exportSize = 1200;
        const canvas = document.createElement("canvas");
        canvas.width = exportSize;
        canvas.height = exportSize;

        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("Canvas export is unavailable.");
        }

        context.drawImage(image, 0, 0, exportSize, exportSize);

        const blob = await new Promise<Blob | null>((resolve) => {
            if (mimeType === "image/jpeg") {
                canvas.toBlob(resolve, mimeType, quality ?? 0.92);
            } else {
                canvas.toBlob(resolve, mimeType);
            }
        });

        if (!blob) {
            throw new Error("Unable to create export file.");
        }

        return blob;
    } finally {
        URL.revokeObjectURL(svgUrl);
    }
}

export default function ColorMeMindful() {
    const [activeCategory, setActiveCategory] = useState<ArtworkCategory>("all");
    const [selectedArtworkId, setSelectedArtworkId] = useState<string | null>(null);
    const [history, setHistory] = useState<Record<string, string>[]>([{}]);
    const [step, setStep] = useState(0);
    const [selectedColor, setSelectedColor] = useState<string>(
        PALETTE_ROWS[0].swatches[0].value,
    );
    const [erasing, setErasing] = useState(false);
    const [fillMatching, setFillMatching] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [showCompletion, setShowCompletion] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites());
    const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
    const [breathingEnabled, setBreathingEnabled] = useState(false);
    const [breathPhase, setBreathPhase] = useState<"inhale" | "hold" | "exhale">("inhale");
    const [sessionStart, setSessionStart] = useState<number | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [showShortcuts, setShowShortcuts] = useState(false);

    const lastDraftIdRef = useRef<string | null>(null);

    const filteredArtworks = useMemo(() => {
        const base = activeCategory === "all"
            ? artworks
            : artworks.filter((item) => item.category === activeCategory);
        const favFiltered = showOnlyFavorites ? base.filter((a) => favorites.has(a.id)) : base;
        const term = searchTerm.trim().toLowerCase();
        if (!term) return favFiltered;
        return favFiltered.filter((a) =>
            a.name.toLowerCase().includes(term) || a.category.toLowerCase().includes(term),
        );
    }, [activeCategory, favorites, searchTerm, showOnlyFavorites]);

    const selectedArtwork = useMemo(
        () => (selectedArtworkId ? getArtwork(selectedArtworkId) : undefined),
        [selectedArtworkId],
    );

    const suggested = useMemo(() => suggestedArtworkForToday(), []);
    const fills = useMemo(() => history[step] ?? {}, [history, step]);
    const regionsColored = Object.keys(fills).length;
    const fillableTotal = useMemo(
        () => selectedArtwork?.paths.filter((p) => !isStrokeOnly(p.d)).length ?? 0,
        [selectedArtwork],
    );
    const progress = fillableTotal > 0 ? Math.min(100, Math.round((regionsColored / fillableTotal) * 100)) : 0;
    const activeSwatchName = useMemo(() => {
        for (const row of PALETTE_ROWS) {
            const match = row.swatches.find((s) => s.value === selectedColor);
            if (match) return match.name;
        }
        return "Custom";
    }, [selectedColor]);

    const resetPainter = useCallback(() => {
        setHistory([{}]);
        setStep(0);
        setSelectedColor(PALETTE_ROWS[0].swatches[0].value);
        setErasing(false);
        setFillMatching(false);
    }, []);

    const resetTool = () => {
        setCompleted(false);
        setShowCompletion(false);
        setSelectedArtworkId(null);
        setActiveCategory("all");
        setSearchTerm("");
        setShowOnlyFavorites(false);
        setSessionStart(null);
        setElapsedSeconds(0);
        setBreathingEnabled(false);
        resetPainter();
    };

    const openArtwork = useCallback((artworkId: string) => {
        setSelectedArtworkId(artworkId);
        const draft = loadDraft(artworkId);
        if (draft && Object.keys(draft).length > 0) {
            setHistory([{}, draft]);
            setStep(1);
            toast("Draft restored", { description: "Picked up where you left off." });
        } else {
            setHistory([{}]);
            setStep(0);
        }
        setSelectedColor(PALETTE_ROWS[0].swatches[0].value);
        setErasing(false);
        setFillMatching(false);
        setSessionStart(Date.now());
        setElapsedSeconds(0);
    }, []);

    const apply = (next: Record<string, string>) => {
        const trimmed = history.slice(0, step + 1);
        trimmed.push(next);
        setHistory(trimmed);
        setStep(trimmed.length - 1);
    };

    const paintRegion = (regionId: string, replaceMatching = false) => {
        const next = { ...fills };
        const currentFill = fills[regionId];
        const nextColor = erasing ? undefined : selectedColor;

        if (replaceMatching && currentFill) {
            Object.keys(next).forEach((key) => {
                if (next[key] !== currentFill) return;
                if (nextColor) next[key] = nextColor;
                else delete next[key];
            });
        }

        if (nextColor) next[regionId] = nextColor;
        else delete next[regionId];

        apply(next);
    };

    const handleRegionPaint = (regionId: string) => {
        const current = history[step] ?? {};
        if (erasing && !current[regionId]) return;
        if (!erasing && current[regionId] === selectedColor) return;

        const next = { ...current };
        if (erasing) delete next[regionId];
        else next[regionId] = selectedColor;

        const trimmed = history.slice(0, step + 1);
        trimmed[trimmed.length - 1] = next;
        setHistory(trimmed);
    };

    const handleUndo = useCallback(() => setStep((value) => Math.max(0, value - 1)), []);
    const handleRedo = useCallback(
        () => setStep((value) => Math.min(history.length - 1, value + 1)),
        [history.length],
    );

    const handleResetCanvas = () => {
        apply({});
        toast("Canvas cleared", { description: "Fresh start. Breathe in." });
    };

    const toggleFavorite = useCallback((artworkId: string) => {
        setFavorites((prev) => {
            const next = new Set(prev);
            if (next.has(artworkId)) next.delete(artworkId);
            else next.add(artworkId);
            try {
                window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(next)));
            } catch {
                // ignore
            }
            return next;
        });
    }, []);

    // Timer tick while a canvas is open.
    useEffect(() => {
        if (!selectedArtwork || !sessionStart) return;
        const id = window.setInterval(() => {
            setElapsedSeconds(Math.floor((Date.now() - sessionStart) / 1000));
        }, 1000);
        return () => window.clearInterval(id);
    }, [selectedArtwork, sessionStart]);

    // Breathing cue: 4s inhale, 4s hold, 6s exhale (box-ish, gentler on exhale).
    useEffect(() => {
        if (!breathingEnabled) return;
        const cycle: { phase: "inhale" | "hold" | "exhale"; ms: number }[] = [
            { phase: "inhale", ms: 4000 },
            { phase: "hold", ms: 4000 },
            { phase: "exhale", ms: 6000 },
        ];
        let index = 0;
        setBreathPhase(cycle[0].phase);
        const run = () => {
            index = (index + 1) % cycle.length;
            setBreathPhase(cycle[index].phase);
        };
        let timerId = window.setTimeout(function tick() {
            run();
            timerId = window.setTimeout(tick, cycle[index].ms);
        }, cycle[0].ms);
        return () => window.clearTimeout(timerId);
    }, [breathingEnabled]);

    // Persist fills to localStorage whenever they change for the active artwork.
    useEffect(() => {
        if (!selectedArtworkId) {
            lastDraftIdRef.current = null;
            return;
        }
        lastDraftIdRef.current = selectedArtworkId;
        saveDraft(selectedArtworkId, fills);
    }, [fills, selectedArtworkId]);

    // Keyboard shortcuts on the canvas.
    useEffect(() => {
        if (!selectedArtwork) return;
        const handler = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
                return;
            }
            const isCtrl = event.ctrlKey || event.metaKey;
            const key = event.key;

            if (isCtrl && (key === "z" || key === "Z") && !event.shiftKey) {
                event.preventDefault();
                handleUndo();
                return;
            }
            if ((isCtrl && ((key === "z" || key === "Z") && event.shiftKey)) || (isCtrl && (key === "y" || key === "Y"))) {
                event.preventDefault();
                handleRedo();
                return;
            }
            if (event.shiftKey || event.altKey) {
                if (event.shiftKey && /^[1-9]$/.test(key)) {
                    const index = Number(key) - 1;
                    const swatch = PALETTE_ROWS[1]?.swatches[index];
                    if (swatch) {
                        setSelectedColor(swatch.value);
                        setErasing(false);
                    }
                    return;
                }
                return;
            }
            if (/^[1-9]$/.test(key)) {
                const index = Number(key) - 1;
                const swatch = PALETTE_ROWS[0]?.swatches[index];
                if (swatch) {
                    setSelectedColor(swatch.value);
                    setErasing(false);
                }
                return;
            }
            if (key === "z" || key === "Z" || key === "u" || key === "U") {
                handleUndo();
            } else if (key === "y" || key === "Y" || key === "r" || key === "R") {
                handleRedo();
            } else if (key === "e" || key === "E") {
                setErasing((value) => !value);
            } else if (key === "f" || key === "F") {
                setFillMatching((value) => !value);
            } else if (key === "b" || key === "B") {
                setBreathingEnabled((value) => !value);
            } else if (key === "?") {
                setShowShortcuts((value) => !value);
            } else if (key === "Escape") {
                setSelectedArtworkId(null);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [handleRedo, handleUndo, selectedArtwork]);

    const handleDownloadSvg = () => {
        const svg = document.querySelector<SVGSVGElement>(`#${SVG_ID}`);
        if (!svg || !selectedArtwork) return;

        const source = flattenSvgForExport(svg);
        const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
        downloadBlob(blob, createExportFileName(selectedArtwork.name, "svg"));
        toast("Saved as SVG");
    };

    const handleDownloadPng = async () => {
        const svg = document.querySelector<SVGSVGElement>(`#${SVG_ID}`);
        if (!svg || !selectedArtwork) return;

        try {
            const blob = await exportRasterArtwork(svg, "image/png");
            downloadBlob(blob, createExportFileName(selectedArtwork.name, "png"));
            toast("Saved as PNG");
        } catch {
            toast("Unable to save PNG", { description: "Try SVG if your browser blocks raster export." });
        }
    };

    const handleDownloadJpeg = async () => {
        const svg = document.querySelector<SVGSVGElement>(`#${SVG_ID}`);
        if (!svg || !selectedArtwork) return;

        try {
            const blob = await exportRasterArtwork(svg, "image/jpeg", 0.92);
            downloadBlob(blob, createExportFileName(selectedArtwork.name, "jpg"));
            toast("Saved as JPEG");
        } catch {
            toast("Unable to save JPEG", { description: "Try SVG if your browser blocks raster export." });
        }
    };

    const handlePrint = () => {
        const svg = document.querySelector<SVGSVGElement>(`#${SVG_ID}`);
        if (!svg || !selectedArtwork) return;
        const source = flattenSvgForExport(svg);
        const printWindow = window.open("", "_blank", "width=800,height=900");
        if (!printWindow) {
            toast("Pop-up blocked", { description: "Allow pop-ups to print your artwork." });
            return;
        }
        const title = selectedArtwork.name;
        printWindow.document.write(`<!doctype html><html><head><title>${title} — MindMitra</title><style>
            body{margin:0;font-family:Georgia,serif;background:#f8f3ea;color:#3b2f18;display:flex;flex-direction:column;align-items:center;padding:32px;}
            h1{font-weight:300;font-size:28px;margin:0 0 4px;}
            p{margin:4px 0;color:#6b5a37;font-size:13px;}
            .art{width:min(640px,90vw);aspect-ratio:1/1;background:white;border:1px solid #e6dcc6;border-radius:16px;padding:18px;margin-top:18px;}
            @media print{body{background:white;padding:12px;}.art{border:none;}}
        </style></head><body>
            <h1>${title}</h1>
            <p>A mindful pause · MindMitra</p>
            <div class="art">${source}</div>
            <script>window.onload=()=>{window.focus();window.print();};</script>
        </body></html>`);
        printWindow.document.close();
    };

    const handleShare = async () => {
        const shareText = `I colored a mindful moment on MindMitra — a small pause for calm. 🌿`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: "Color Me Mindful",
                    text: shareText,
                    url: window.location.href,
                });
            } catch {
                // Ignore user cancelled share.
            }
            return;
        }

        try {
            await navigator.clipboard.writeText(`${shareText} ${window.location.href}`);
            toast("Link copied", { description: "Share your mindful moment." });
        } catch {
            toast("Unable to copy link", { description: "Please copy the URL manually." });
        }
    };

    const handleFinishSession = () => {
        setShowCompletion(true);
    };

    const handleConfirmCompletion = () => {
        setShowCompletion(false);
        setCompleted(true);
        if (selectedArtworkId) {
            try {
                window.localStorage.removeItem(DRAFT_STORAGE_PREFIX + selectedArtworkId);
            } catch {
                // ignore
            }
        }
        toast("Pause complete", { description: "Well done for taking the time." });
    };

    const breathLabel = breathPhase === "inhale" ? "Breathe in" : breathPhase === "hold" ? "Hold" : "Breathe out";
    const breathScale = breathPhase === "inhale" ? 1 : breathPhase === "hold" ? 1 : 0.6;
    const breathDuration = breathPhase === "inhale" ? "4s" : breathPhase === "hold" ? "4s" : "6s";

    const galleryContent = (
        <div className="mx-auto w-full max-w-6xl px-4 pb-16">
            <div className="rounded-[28px] border border-white/60 bg-white/75 p-6 shadow-[0_26px_80px_-60px_rgba(81,58,22,0.65)] sm:p-8">
                <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-amber-800">
                    <Sparkles className="h-3.5 w-3.5" /> A mindful pause
                </p>
                <h2 className="mt-4 font-display text-3xl font-light tracking-tight text-ink-8 sm:text-4xl">
                    Relax and express yourself
                    <br />
                    <span className="italic text-amber-800">one stroke at a time.</span>
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-6 sm:text-base">
                    Color animals, mandalas, and nature. No pressure, no rules. Choose a drawing and settle into a short creative pause.
                </p>

                <div className="mt-6 grid gap-4 rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4 sm:grid-cols-2">
                    <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-5">Suggested for today</p>
                        <p className="mt-1 text-lg font-medium text-ink-8">{suggested.name}</p>
                        <p className="mt-1 text-sm text-ink-6">A 7 minute pause</p>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/80 px-4 py-3">
                        <span className="text-3xl">{suggested.emoji ?? "🌿"}</span>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openArtwork(suggested.id)}
                            className="rounded-full"
                        >
                            Start with this
                        </Button>
                    </div>
                </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-ink-5">
                <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Suggested for today — a 7 minute pause</span>
                </div>
                <Input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search drawings…"
                    aria-label="Search drawings"
                    className="h-9 w-full max-w-xs rounded-full bg-white/80 text-sm sm:ml-auto sm:w-56"
                />
                <button
                    type="button"
                    onClick={() => setShowOnlyFavorites((value) => !value)}
                    className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-base",
                        showOnlyFavorites
                            ? "border-amber-300 bg-amber-100 text-amber-800"
                            : "border-border/60 bg-white/70 text-ink-6 hover:bg-white",
                    )}
                    aria-pressed={showOnlyFavorites}
                >
                    <Heart className={cn("h-3.5 w-3.5", showOnlyFavorites && "fill-current")} />
                    Favorites {favorites.size > 0 ? `· ${favorites.size}` : ""}
                </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
                {categories.map((category) => (
                    <button
                        key={category.id}
                        type="button"
                        onClick={() => setActiveCategory(category.id)}
                        className={cn(
                            "rounded-full border px-4 py-1.5 text-xs font-medium transition-colors duration-base",
                            activeCategory === category.id
                                ? "border-amber-300 bg-amber-100 text-amber-800"
                                : "border-border/60 bg-white/70 text-ink-6 hover:bg-white",
                        )}
                    >
                        {category.label}
                    </button>
                ))}
            </div>

            <section className="mt-5">
                <div className="mb-3 flex items-end justify-between px-1">
                    <h3 className="font-display text-xl font-normal text-ink-8">Choose a drawing</h3>
                    <span className="text-xs text-ink-5">{filteredArtworks.length} designs</span>
                </div>

                {filteredArtworks.length === 0 ? (
                    <div className="rounded-2xl border border-border/50 bg-white/70 p-8 text-center text-sm text-ink-5">
                        No drawings match. Try clearing the search or favorites filter.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredArtworks.map((artwork) => {
                            const isFavorite = favorites.has(artwork.id);
                            const hasDraft = typeof window !== "undefined" && !!window.localStorage.getItem(DRAFT_STORAGE_PREFIX + artwork.id);
                            return (
                                <div
                                    key={artwork.id}
                                    className="group relative overflow-hidden rounded-[24px] border border-white/60 bg-white/80 p-3 text-left shadow-[0_20px_50px_-45px_rgba(51,39,18,0.7)] transition-all duration-base hover:-translate-y-0.5 hover:bg-white"
                                >
                                    <button
                                        type="button"
                                        onClick={() => openArtwork(artwork.id)}
                                        className="block w-full text-left"
                                        aria-label={`Open ${artwork.name}`}
                                    >
                                        <div className="aspect-square overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-amber-50 to-white p-2">
                                            <ArtworkSVG
                                                artwork={artwork}
                                                className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between px-1 pb-1 pt-3">
                                            <span className="font-display text-sm font-medium text-ink-8">
                                                {artwork.emoji ? <span className="mr-1">{artwork.emoji}</span> : null}
                                                {artwork.name}
                                            </span>
                                            <span className="text-[10px] uppercase tracking-wide text-ink-5">{artwork.category}</span>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            toggleFavorite(artwork.id);
                                        }}
                                        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm transition-colors hover:bg-white"
                                        aria-label={isFavorite ? `Remove ${artwork.name} from favorites` : `Add ${artwork.name} to favorites`}
                                        aria-pressed={isFavorite}
                                    >
                                        <Heart className={cn("h-4 w-4", isFavorite ? "fill-amber-500 text-amber-500" : "text-ink-5")} />
                                    </button>
                                    {hasDraft ? (
                                        <span className="absolute left-4 top-4 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800">
                                            In progress
                                        </span>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            <p className="mt-8 text-center font-display text-xs italic text-ink-5">
                "In the middle of difficulty lies opportunity to color."
            </p>
        </div>
    );

    // All swatches in a flat list for the mobile horizontal strip.
    const allSwatches = PALETTE_ROWS.flatMap((row) => row.swatches);

    const canvasContent = selectedArtwork ? (
        // Bounded to remaining viewport — prevents the page from ever needing to scroll.
        <div className="flex h-[calc(100dvh-118px)] w-full flex-col gap-2 overflow-hidden px-2 sm:px-3">

            {/* ── Top bar ── shrink-0 */}
            <div className="flex shrink-0 items-center justify-between gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedArtworkId(null)} className="rounded-full">
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
                </Button>
                <div className="flex items-center gap-2">
                    <span className="max-w-[140px] truncate font-display text-[13px] text-ink-6 sm:max-w-none">{selectedArtwork.name}</span>
                    <div className="flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 font-mono text-[11px] text-ink-6" aria-live="polite" aria-label={`Session time ${formatElapsed(elapsedSeconds)}`}>
                        <Clock className="h-3 w-3" aria-hidden />
                        <span>{formatElapsed(elapsedSeconds)}</span>
                    </div>
                </div>
            </div>

            {/* ── Main workspace ── fills all remaining height */}
            <div className="flex min-h-0 flex-1 flex-col gap-2 lg:flex-row lg:gap-3">

                {/* ═══ Canvas column ═══ */}
                <div className="flex min-h-0 flex-1 flex-col rounded-[20px] border border-white/60 bg-white/80 p-2 shadow-[0_20px_50px_-45px_rgba(51,39,18,0.7)]">

                    {/* Toolbar — shrink-0 */}
                    <div className="mb-1.5 flex shrink-0 flex-wrap items-center justify-between gap-1 px-0.5">
                        <div className="flex items-center gap-0.5">
                            <Button type="button" size="icon" variant="ghost" onClick={handleUndo} disabled={step === 0} aria-label="Undo" title="Undo (Ctrl+Z)" className="h-7 w-7 rounded-full">
                                <Undo2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" onClick={handleRedo} disabled={step === history.length - 1} aria-label="Redo" title="Redo (Ctrl+Shift+Z)" className="h-7 w-7 rounded-full">
                                <Redo2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" onClick={handleResetCanvas} aria-label="Reset canvas" title="Clear canvas" className="h-7 w-7 rounded-full">
                                <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                            <Button type="button" size="sm" variant={fillMatching ? "default" : "ghost"} onClick={() => setFillMatching((v) => !v)} className="h-7 rounded-full px-2 text-[11px]" aria-pressed={fillMatching} title="Fill alike (F)">
                                <Wand2 className="mr-1 h-3 w-3" /> Fill
                            </Button>
                            <Button type="button" size="sm" variant={breathingEnabled ? "default" : "ghost"} onClick={() => setBreathingEnabled((v) => !v)} className="h-7 rounded-full px-2 text-[11px]" aria-pressed={breathingEnabled} title="Breathing cue (B)">
                                <Wind className="mr-1 h-3 w-3" /> Breath
                            </Button>
                        </div>
                        <div className="flex items-center gap-0.5">
                            <Button type="button" size="icon" variant="ghost" onClick={() => setShowShortcuts(true)} aria-label="Keyboard shortcuts" title="Shortcuts (?)" className="h-7 w-7 rounded-full">
                                <Keyboard className="h-3.5 w-3.5" />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" onClick={handleShare} aria-label="Share" title="Share" className="h-7 w-7 rounded-full">
                                <Share2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" onClick={handlePrint} aria-label="Print" title="Print" className="h-7 w-7 rounded-full">
                                <Printer className="h-3.5 w-3.5" />
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button type="button" size="icon" variant="ghost" aria-label="Download artwork" title="Download" className="h-7 w-7 rounded-full">
                                        <Download className="h-3.5 w-3.5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-36">
                                    <DropdownMenuLabel className="text-xs">Download as</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleDownloadPng}><ImageIcon className="mr-2 h-3.5 w-3.5" /> PNG</DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleDownloadJpeg}><ImageIcon className="mr-2 h-3.5 w-3.5" /> JPEG</DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleDownloadSvg}><Download className="mr-2 h-3.5 w-3.5" /> SVG</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    {/* SVG — takes all remaining height in column */}
                    <div className="relative min-h-0 flex-1 overflow-hidden rounded-[16px] border border-border/50 bg-white">
                        <ArtworkSVG
                            artwork={selectedArtwork}
                            svgId={SVG_ID}
                            fills={fills}
                            interactive
                            onRegionClick={(regionId) => paintRegion(regionId, fillMatching)}
                            onRegionPaint={handleRegionPaint}
                            className="h-full w-full select-none"
                            strokeWidth={1.5}
                        />
                        {breathingEnabled ? (
                            <div className="pointer-events-none absolute left-1/2 top-2 flex -translate-x-1/2 flex-col items-center gap-0.5" aria-live="polite">
                                <div className="h-5 w-5 rounded-full bg-amber-400/70 shadow-[0_0_20px_rgba(245,158,11,0.45)]" style={{ transform: `scale(${breathScale})`, transition: `transform ${breathDuration} ease-in-out` }} aria-hidden />
                                <span className="rounded-full bg-white/85 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-800">{breathLabel}</span>
                            </div>
                        ) : null}
                    </div>

                    {/* Progress bar — shrink-0 */}
                    <div className="mt-1.5 shrink-0 px-0.5">
                        <div className="flex items-center justify-between text-[10px] text-ink-5">
                            <span>Progress</span>
                            <span>{regionsColored}{fillableTotal > 0 ? ` / ${fillableTotal}` : ""} · {progress}%</span>
                        </div>
                        <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-amber-100/70">
                            <div className="h-full rounded-full bg-amber-400 transition-[width] duration-500" style={{ width: `${progress}%` }} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} />
                        </div>
                    </div>
                </div>

                {/* ═══ Palette column ═══ — fixed width on lg+, compact strip on mobile */}

                {/* MOBILE: horizontal strip below canvas */}
                <div className="flex shrink-0 flex-col gap-2 lg:hidden">
                    <div className="rounded-[18px] border border-white/60 bg-white/80 px-3 py-2.5 shadow-[0_20px_50px_-45px_rgba(51,39,18,0.7)]">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                                <span className="font-display text-[10px] font-medium uppercase tracking-[0.14em] text-ink-5">Palette</span>
                                <span className="text-[10px] text-ink-6">· {erasing ? "Eraser" : activeSwatchName}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button type="button" size="sm" variant={erasing ? "default" : "outline"} onClick={() => setErasing((v) => !v)} className="h-6 rounded-full px-2 text-[10px]" aria-pressed={erasing} title="Eraser (E)">
                                    <Eraser className="mr-0.5 h-3 w-3" />{erasing ? "Erasing" : "Erase"}
                                </Button>
                                <Button type="button" variant="warmth" size="sm" onClick={handleFinishSession} className="h-6 rounded-full px-2.5 text-[10px]">
                                    <Palette className="mr-0.5 h-3 w-3" /> Done
                                </Button>
                            </div>
                        </div>
                        {/* All swatches in one scrollable row */}
                        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                            {allSwatches.map((swatch, i) => {
                                const active = !erasing && selectedColor === swatch.value;
                                return (
                                    <button
                                        key={swatch.name}
                                        type="button"
                                        aria-label={swatch.name}
                                        title={swatch.name}
                                        onClick={() => { setSelectedColor(swatch.value); setErasing(false); }}
                                        className={cn(
                                            "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform duration-base",
                                            active ? "scale-110" : "hover:scale-105",
                                            i === 9 && "ml-2 border-l border-border/40 pl-2",
                                        )}
                                    >
                                        <span className={cn("absolute inset-0 rounded-full ring-offset-1 ring-offset-white", active ? "ring-2 ring-foreground/70" : "ring-1 ring-border")} />
                                        <span className="h-5 w-5 rounded-full" style={{ backgroundColor: swatch.value }} />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* DESKTOP lg+: right column */}
                <div className="hidden w-56 shrink-0 flex-col gap-2 lg:flex xl:w-60">
                    <div className="flex flex-1 flex-col rounded-[20px] border border-white/60 bg-white/80 p-3 shadow-[0_20px_50px_-45px_rgba(51,39,18,0.7)]">
                        <div className="mb-2.5 flex shrink-0 items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                                <span className="font-display text-[11px] font-medium uppercase tracking-[0.16em] text-ink-5">Palette</span>
                                <span className="text-[10px] text-ink-6">· {erasing ? "Eraser" : activeSwatchName}</span>
                            </div>
                            <Button type="button" size="sm" variant={erasing ? "default" : "outline"} onClick={() => setErasing((v) => !v)} className="h-6 rounded-full px-2 text-[11px]" aria-pressed={erasing} title="Eraser (E)">
                                <Eraser className="mr-1 h-3 w-3" />{erasing ? "Erasing" : "Erase"}
                            </Button>
                        </div>

                        {/* Two rows, 5 cols each — fits without scroll */}
                        <div className="shrink-0 space-y-3">
                            {PALETTE_ROWS.map((row, rowIndex) => (
                                <div key={row.label}>
                                    <div className="mb-1.5 flex items-center justify-between">
                                        <span className="text-[9px] uppercase tracking-wide text-ink-5">{row.label}</span>
                                        <span className="text-[9px] text-ink-5/60">{rowIndex === 0 ? "1–9" : "Shift+1–9"}</span>
                                    </div>
                                    <div className="grid grid-cols-5 gap-1.5">
                                        {row.swatches.map((swatch, swatchIndex) => {
                                            const active = !erasing && selectedColor === swatch.value;
                                            const shortcut = `${rowIndex === 0 ? "" : "Shift+"}${swatchIndex + 1}`;
                                            return (
                                                <button
                                                    key={swatch.name}
                                                    type="button"
                                                    aria-label={swatch.name}
                                                    title={`${swatch.name} · ${shortcut}`}
                                                    onClick={() => { setSelectedColor(swatch.value); setErasing(false); }}
                                                    className={cn(
                                                        "relative flex aspect-square w-full items-center justify-center rounded-full transition-transform duration-base",
                                                        active ? "scale-110" : "hover:scale-105",
                                                    )}
                                                >
                                                    <span className={cn("absolute inset-0 rounded-full ring-offset-1 ring-offset-white", active ? "ring-2 ring-foreground/70" : "ring-1 ring-border")} />
                                                    <span className="h-[68%] w-[68%] rounded-full" style={{ backgroundColor: swatch.value }} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <p className="mt-auto pt-3 text-[10px] italic text-ink-5">
                            Drag to paint · <span className="font-mono">?</span> for shortcuts
                        </p>
                    </div>

                    <Button type="button" variant="warmth" onClick={handleFinishSession} className="h-9 w-full shrink-0 rounded-full text-xs">
                        <Palette className="mr-2 h-3.5 w-3.5" /> I finished my pause
                    </Button>
                </div>
            </div>
        </div>
    ) : null;

    return (
        <>
            <ToolShell
                toolId="color-me-mindful"
                title="Color Me Mindful"
                clinicalBasis="Creative coloring can lower cognitive load, regulate breath rhythm, and support present-moment attention through repetitive, low-pressure action."
                xp={30}
                completed={completed}
                onReset={resetTool}
                themeColor="from-[#f6eee1] via-[#fdf7ef] to-[#ecdecb]"
                themeAccent="amber"
                surfaceTone="warm"
                contentPlacement="top"
            >
                {selectedArtwork ? canvasContent : galleryContent}
            </ToolShell>

            <Dialog open={showCompletion} onOpenChange={setShowCompletion}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-display text-2xl font-light">A pause, completed.</DialogTitle>
                        <DialogDescription>
                            Thank you for giving yourself this time. Here's what your session looked like.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-3 py-2">
                        <div className="rounded-xl border border-amber-200/70 bg-amber-50/70 p-3">
                            <p className="text-[10px] uppercase tracking-wide text-ink-5">Time spent</p>
                            <p className="mt-1 font-mono text-lg text-ink-8">{formatElapsed(elapsedSeconds)}</p>
                        </div>
                        <div className="rounded-xl border border-amber-200/70 bg-amber-50/70 p-3">
                            <p className="text-[10px] uppercase tracking-wide text-ink-5">Regions colored</p>
                            <p className="mt-1 font-mono text-lg text-ink-8">
                                {regionsColored}
                                {fillableTotal > 0 ? <span className="text-ink-5"> / {fillableTotal}</span> : null}
                            </p>
                        </div>
                    </div>
                    <p className="rounded-xl bg-amber-50/50 p-3 text-xs italic text-ink-6">
                        Consider saving a screenshot of your artwork for your reflection journal — a small visual trace of this moment.
                    </p>
                    <DialogFooter className="flex-col gap-2 sm:flex-row">
                        <Button type="button" variant="outline" onClick={handleDownloadPng} className="rounded-full">
                            <ImageIcon className="mr-2 h-4 w-4" /> Save image
                        </Button>
                        <Button type="button" variant="warmth" onClick={handleConfirmCompletion} className="rounded-full">
                            Complete pause
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Keyboard shortcuts</DialogTitle>
                        <DialogDescription>Flow faster without leaving the canvas.</DialogDescription>
                    </DialogHeader>
                    <ul className="space-y-1.5 text-sm text-ink-7">
                        <li className="flex justify-between"><span>Soft swatch</span><kbd className="font-mono text-xs">1 – 9</kbd></li>
                        <li className="flex justify-between"><span>Vivid swatch</span><kbd className="font-mono text-xs">Shift + 1 – 9</kbd></li>
                        <li className="flex justify-between"><span>Undo</span><kbd className="font-mono text-xs">Z · Ctrl+Z</kbd></li>
                        <li className="flex justify-between"><span>Redo</span><kbd className="font-mono text-xs">Y · Ctrl+Shift+Z</kbd></li>
                        <li className="flex justify-between"><span>Eraser</span><kbd className="font-mono text-xs">E</kbd></li>
                        <li className="flex justify-between"><span>Fill alike</span><kbd className="font-mono text-xs">F</kbd></li>
                        <li className="flex justify-between"><span>Breath cue</span><kbd className="font-mono text-xs">B</kbd></li>
                        <li className="flex justify-between"><span>Back to gallery</span><kbd className="font-mono text-xs">Esc</kbd></li>
                        <li className="flex justify-between"><span>Toggle this panel</span><kbd className="font-mono text-xs">?</kbd></li>
                    </ul>
                </DialogContent>
            </Dialog>
        </>
    );
}
