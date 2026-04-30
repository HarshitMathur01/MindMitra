import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Header from "@/components/layout/Header";
import HillsFooter from "@/components/layout/HillsFooter";
import PageShell from "@/components/layout/PageShell";
import { WatercolorScene } from "@/components/layout/WatercolorScene";
import { PeachBlush } from "@/components/layout/PeachBlush";
import {
    Bookmark,
    BookmarkCheck,
    Search,
    Sparkles,
    ArrowRight,
    ShieldCheck,
    Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePersistedSet } from "@/hooks/usePersistedSet";
import {
    allContent,
    collections,
    deriveCollection,
    formatCount,
    typeFilters,
    type CollectionId,
    type ContentItem,
    type ContentType,
} from "@/data/psychologicalContent";
import { ContentCard } from "@/components/psych/ContentCard";

const ResourceReaderDialog = lazy(() => import("@/components/psych/ResourceReaderDialog"));

const SAVED_KEY = "mm-psych-resources-saved";

const PsychologicalContent = () => {
    const { toast } = useToast();
    const [searchInput, setSearchInput] = useState("");
    const debouncedSearch = useDebouncedValue(searchInput, 200);
    const [activeCollection, setActiveCollection] = useState<CollectionId>("all");
    const [typeFilter, setTypeFilter] = useState<ContentType | "all">("all");
    const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
    const [showBookmarks, setShowBookmarks] = useState(false);

    const saved = usePersistedSet(SAVED_KEY);

    // Pre-derive collection per item once
    const itemsWithCollection = useMemo(
        () => allContent.map((c) => ({ ...c, collection: deriveCollection(c) })),
        [],
    );

    const collectionCounts = useMemo(() => {
        const counts: Record<Exclude<CollectionId, "all">, number> = {
            "calm-now": 0,
            understand: 0,
            "live-well": 0,
        };
        for (const item of itemsWithCollection) counts[item.collection] += 1;
        return counts;
    }, [itemsWithCollection]);

    const filteredContent = useMemo(() => {
        const q = debouncedSearch.trim().toLowerCase();
        return itemsWithCollection.filter((item) => {
            if (showBookmarks && !saved.has(item.id)) return false;
            if (activeCollection !== "all" && item.collection !== activeCollection) return false;
            if (typeFilter !== "all" && item.type !== typeFilter) return false;
            if (!q) return true;
            return (
                item.title.toLowerCase().includes(q) ||
                item.description.toLowerCase().includes(q) ||
                item.tags.some((t) => t.toLowerCase().includes(q))
            );
        });
    }, [itemsWithCollection, debouncedSearch, activeCollection, typeFilter, showBookmarks, saved]);

    const spotlightItem = useMemo(() => {
        if (showBookmarks || debouncedSearch.trim() || activeCollection !== "all" || typeFilter !== "all")
            return null;
        return allContent.find((c) => c.featured) ?? allContent[0] ?? null;
    }, [showBookmarks, debouncedSearch, activeCollection, typeFilter]);

    const gridItems = useMemo(() => {
        if (!spotlightItem) return filteredContent;
        const rest = filteredContent.filter((i) => i.id !== spotlightItem.id);
        return rest.length === 0 && filteredContent.length > 0 ? filteredContent : rest;
    }, [filteredContent, spotlightItem]);

    const handleToggleBookmark = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const added = saved.toggle(id);
        toast({
            title: added ? "Saved" : "Removed",
            description: added
                ? "We'll keep this on your list in this browser."
                : "Taken off your saved list.",
        });
    };

    const resetFilters = () => {
        setSearchInput("");
        setActiveCollection("all");
        setTypeFilter("all");
        setShowBookmarks(false);
    };

    // SEO: keep title in sync with active collection
    useEffect(() => {
        const base = "Mind Library — Calm reads & practices";
        const active = collections.find((c) => c.id === activeCollection);
        document.title =
            activeCollection === "all" || !active ? base : `${active.label} · ${base}`;
    }, [activeCollection]);

    return (
        <>
            <Header />
            <PageShell width="page" as="main">
                {/* Hero */}
                <section className="relative isolate overflow-hidden pt-12 sm:pt-20">
                    <PeachBlush position="top-right" size="lg" className="-z-10" />
                    <div
                        aria-hidden
                        className="pointer-events-none absolute right-0 top-0 -z-10 hidden w-[480px] opacity-30 lg:block"
                    >
                        <WatercolorScene name="companions" maxRenderedWidth={960} loading="eager" />
                    </div>

                    <Link
                        to="/"
                        className="mb-8 inline-flex items-center gap-1.5 text-sm text-[color:var(--qc-ink-muted)] transition-colors hover:text-[color:var(--qc-ink)]"
                    >
                        ← Back home
                    </Link>

                    <p className="qc-eyebrow">Mind library</p>
                    <h1 className="qc-display mt-4 max-w-3xl text-[clamp(2.25rem,5vw,3.5rem)]">
                        Short reads & quiet practices,{" "}
                        <span className="mitra-voice text-[color:var(--qc-forest)]">
                            for the days that feel loud.
                        </span>
                    </h1>

                    <p className="mt-5 max-w-2xl text-base leading-relaxed text-[color:var(--qc-ink-soft)] md:text-lg">
                        A small library of grounding exercises, CBT tools, and gentle reads. Open anything to read
                        slowly, save what helps, return when you need it.
                    </p>

                    {/* Search + saved */}
                    <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:max-w-2xl">
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--qc-ink-muted)]" />
                            <Input
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Search by topic, technique, or feeling…"
                                aria-label="Search resources"
                                className="h-12 rounded-full pl-11 text-sm"
                            />
                        </div>
                        <Button
                            type="button"
                            variant={showBookmarks ? "default" : "outline"}
                            onClick={() => setShowBookmarks((v) => !v)}
                            className="h-12 rounded-full px-5"
                        >
                            {showBookmarks ? (
                                <BookmarkCheck className="mr-2 h-4 w-4" />
                            ) : (
                                <Bookmark className="mr-2 h-4 w-4" />
                            )}
                            Saved {saved.values.length > 0 ? `(${saved.values.length})` : ""}
                        </Button>
                    </div>
                </section>

                <div className="py-16 md:py-24">
                {/* Collections */}
                <section aria-labelledby="collections-heading" className="mb-12">
                    <div className="mb-5 flex items-end justify-between gap-4">
                        <div>
                            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                Collections
                            </p>
                            <h2 id="collections-heading" className="mt-1 qc-display text-2xl font-semibold tracking-tight">
                                Where would you like to start?
                            </h2>
                        </div>
                        {activeCollection !== "all" ? (
                            <button
                                type="button"
                                onClick={() => setActiveCollection("all")}
                                className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                            >
                                ← All resources
                            </button>
                        ) : null}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                        {collections
                            .filter((c) => c.id !== "all")
                            .map((c) => {
                                const Icon = c.icon;
                                const active = activeCollection === c.id;
                                const count = collectionCounts[c.id as Exclude<CollectionId, "all">];
                                return (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => setActiveCollection(active ? "all" : c.id)}
                                        aria-pressed={active}
                                        className={cn(
                                            "group flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition-all",
                                            active
                                                ? "border-primary/40 bg-accent-soft/40 shadow-lift"
                                                : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft",
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                                                active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground/70",
                                            )}
                                        >
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h3 className="qc-display text-base font-semibold tracking-tight">{c.label}</h3>
                                            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.description}</p>
                                        </div>
                                        <span className="mt-auto text-[11px] font-medium text-muted-foreground">
                                            {count} {count === 1 ? "item" : "items"}
                                        </span>
                                    </button>
                                );
                            })}
                    </div>
                </section>

                {/* Format filters */}
                <section className="mb-10" aria-label="Filter by format">
                    <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                        Format
                    </p>
                    <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
                        {typeFilters.map((tf) => {
                            const Icon = tf.icon;
                            const active = typeFilter === tf.id;
                            return (
                                <button
                                    key={tf.id}
                                    type="button"
                                    onClick={() => setTypeFilter(tf.id)}
                                    className={cn(
                                        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors",
                                        active
                                            ? "bg-primary text-primary-foreground"
                                            : "border border-border bg-card text-foreground/70 hover:border-primary/30 hover:text-foreground",
                                    )}
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                    {tf.label}
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* Spotlight */}
                {spotlightItem ? (
                    <section className="mb-12 animate-fade-in-up" aria-label="Featured resource">
                        <button
                            type="button"
                            onClick={() => setSelectedItem(spotlightItem)}
                            className={cn(
                                "group block w-full overflow-hidden rounded-[2rem] border border-primary/20 bg-card text-left",
                                "shadow-lift transition-all hover:shadow-glow",
                            )}
                        >
                            <div className="grid gap-0 md:grid-cols-[1.1fr_1fr]">
                                <div className="relative aspect-[4/3] overflow-hidden md:aspect-auto md:min-h-[320px]">
                                    <img
                                        src={spotlightItem.image}
                                        alt=""
                                        loading="eager"
                                        decoding="async"
                                        className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-card/40 to-transparent md:bg-gradient-to-r md:from-transparent md:to-card/30" />
                                    <span className="absolute left-4 top-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-card/85 text-2xl shadow-soft backdrop-blur-sm animate-breathe" aria-hidden>
                                        {spotlightItem.imageEmoji}
                                    </span>
                                </div>
                                <div className="space-y-3 p-6 md:p-10">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-accent">
                                        <Sparkles className="h-3 w-3" /> Start here
                                    </span>
                                    <h2 className="qc-display text-2xl font-semibold leading-tight tracking-tight md:text-4xl">
                                        {spotlightItem.title}
                                    </h2>
                                    <p className="text-base text-muted-foreground md:text-lg">
                                        {spotlightItem.description}
                                    </p>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        <span>{spotlightItem.duration}</span>
                                        <span aria-hidden>·</span>
                                        <span>{formatCount(spotlightItem.readCount)} reads</span>
                                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                                    </div>
                                </div>
                            </div>
                        </button>
                    </section>
                ) : null}

                {/* Library grid */}
                <section aria-labelledby="library-heading">
                    <div className="mb-5">
                        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                            Library
                        </p>
                        <h2 id="library-heading" className="mt-1 qc-display text-2xl font-semibold tracking-tight">
                            Short reads & practices
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {gridItems.length} {gridItems.length === 1 ? "item" : "items"} · open anything to read slowly, or save it for later.
                        </p>
                    </div>

                    {gridItems.length > 0 ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {gridItems.map((item) => (
                                <ContentCard
                                    key={item.id}
                                    item={item}
                                    bookmarked={saved.has(item.id)}
                                    onOpen={setSelectedItem}
                                    onToggleBookmark={handleToggleBookmark}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-3xl border border-dashed border-border bg-card/50 p-10 text-center">
                            <h3 className="qc-display text-xl font-semibold tracking-tight">Nothing matches yet</h3>
                            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                                Try another word, topic, or format — or clear filters to see everything again.
                            </p>
                            <Button onClick={resetFilters} variant="outline" className="mt-5 rounded-full">
                                Reset filters
                            </Button>
                        </div>
                    )}
                </section>

                {/* Crisis band */}
                <section
                    aria-label="Crisis support"
                    className="mt-16 rounded-3xl border border-[color:var(--qc-border)] bg-[color:var(--qc-surface)] p-6 md:p-10"
                >
                    <div className="flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between">
                        <div className="max-w-xl">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                <ShieldCheck className="h-3 w-3" /> When reading isn't enough
                            </span>
                            <h2 className="mt-3 qc-display text-2xl font-semibold tracking-tight md:text-3xl">
                                Prefer to sit with someone gentle?
                            </h2>
                            <p className="mt-2 text-sm text-muted-foreground md:text-base">
                                If you or someone you know is struggling, support is one call away. iCall (India): 9152987821 ·
                                Vandrevala Foundation: 9999666555.
                            </p>
                        </div>
                        <a
                            href="tel:9152987821"
                            className={cn(
                                "inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground",
                                "shadow-soft transition-transform hover:-translate-y-0.5",
                            )}
                        >
                            <Phone className="h-4 w-4" /> Call iCall
                        </a>
                    </div>
                </section>
                </div>

                <Suspense fallback={null}>
                    <ResourceReaderDialog
                        item={selectedItem}
                        open={!!selectedItem}
                        onClose={() => setSelectedItem(null)}
                    />
                </Suspense>
            </PageShell>
            <HillsFooter scene="hills" />
        </>
    );
};

export default PsychologicalContent;