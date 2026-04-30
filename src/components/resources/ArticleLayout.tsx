import { ReactNode } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Sparkles, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import HillsFooter from "@/components/layout/HillsFooter";
import PageShell from "@/components/layout/PageShell";
import { PeachBlush } from "@/components/layout/PeachBlush";
import {
    ArticleOnThisPageNav,
    ArticleScrollProgress,
    type ArticleTocItem,
} from "@/components/resources/ArticleReadingEnhancements";
import { cn } from "@/lib/utils";

export interface ArticleMetaChip {
    icon?: LucideIcon;
    label: string;
}

export interface ArticleLayoutProps {
    eyebrow: { icon: LucideIcon; label: string };
    title: string;
    intro: string;
    readLabel?: string;
    meta?: ArticleMetaChip[];
    heroImage?: { src: string; alt: string };
    heroAccent?: string;
    tocItems: ArticleTocItem[];
    sidebar?: ReactNode;
    children: ReactNode;
}

const eyebrowChip =
    "inline-flex items-center gap-2 rounded-full border border-[color:var(--qc-border-stronger)] bg-[color:var(--qc-surface)] px-3.5 py-1 text-[12px] font-medium text-[color:var(--qc-ink-soft)]";

export function ArticleLayout({
    eyebrow,
    title,
    intro,
    readLabel,
    meta,
    heroImage,
    heroAccent,
    tocItems,
    sidebar,
    children,
}: ArticleLayoutProps) {
    const navigate = useNavigate();
    const Eyebrow = eyebrow.icon;

    const chips: ArticleMetaChip[] = [
        ...(readLabel ? [{ icon: Clock, label: readLabel }] : []),
        ...(meta ?? []),
    ];

    return (
        <>
            <Header />
            <ArticleScrollProgress />
            <PageShell width="wide" as="main">
                <div className="flex flex-col gap-10 py-10 sm:py-14">
                    {/* Hero — quiet panel: warm cream surface, peach blush, no
                        heavy chrome, no gradient frame. */}
                    <section className="relative isolate overflow-hidden rounded-[1.75rem] border border-[color:var(--qc-border)] bg-[color:var(--qc-surface)]">
                        <PeachBlush position="top-right" size="md" className="-z-10" />

                        <div
                            className={cn(
                                "relative grid gap-8 px-6 py-10 sm:px-10 sm:py-12 md:px-12",
                                heroImage ? "md:grid-cols-[1.25fr_0.75fr]" : "md:grid-cols-[1fr]",
                            )}
                        >
                            <div className="min-w-0">
                                <button
                                    type="button"
                                    onClick={() => navigate(-1)}
                                    className="inline-flex items-center gap-2 rounded-full border border-[color:var(--qc-border-stronger)] bg-[color:var(--qc-canvas)] px-3.5 py-1.5 text-[13px] text-[color:var(--qc-ink-muted)] transition-colors hover:text-[color:var(--qc-ink)]"
                                >
                                    <ArrowLeft className="h-3.5 w-3.5" />
                                    Back
                                </button>

                                <div className={cn(eyebrowChip, "mt-6")}>
                                    <Eyebrow className="h-3.5 w-3.5 text-[color:var(--qc-forest)]" />
                                    <span>{eyebrow.label}</span>
                                </div>

                                <h1 className="qc-display mt-5 text-balance text-[clamp(1.85rem,3.8vw,2.75rem)]">
                                    {title}
                                </h1>

                                <p className="mt-5 max-w-[60ch] text-base leading-[1.7] text-[color:var(--qc-ink-soft)]">
                                    {intro}
                                </p>

                                {chips.length > 0 ? (
                                    <div className="mt-6 flex flex-wrap items-center gap-2.5 text-[12.5px] text-[color:var(--qc-ink-muted)]">
                                        {chips.map(({ icon: Icon, label }, i) => (
                                            <span
                                                key={`${label}-${i}`}
                                                className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--qc-border)] bg-[color:var(--qc-canvas)] px-3 py-1"
                                            >
                                                {Icon ? (
                                                    <Icon className="h-3.5 w-3.5 text-[color:var(--qc-forest)]" />
                                                ) : (
                                                    <Sparkles className="h-3.5 w-3.5 text-[color:var(--qc-forest)]" />
                                                )}
                                                {label}
                                            </span>
                                        ))}
                                    </div>
                                ) : null}
                            </div>

                            {heroImage ? (
                                <div className="flex items-center justify-center rounded-[1.5rem] bg-[color:var(--qc-canvas)] p-4">
                                    <img
                                        src={heroImage.src}
                                        alt={heroImage.alt}
                                        loading="lazy"
                                        className="h-full max-h-[280px] w-full rounded-[1.15rem] object-cover"
                                    />
                                </div>
                            ) : heroAccent ? (
                                <div className="flex items-center justify-center">
                                    <div
                                        aria-hidden
                                        className="flex h-32 w-32 items-center justify-center rounded-full bg-[color:var(--qc-sage)]/30 text-5xl sm:h-40 sm:w-40 sm:text-6xl"
                                    >
                                        {heroAccent}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </section>

                    <section className="grid gap-6 md:grid-cols-[1.25fr_0.75fr]">
                        {tocItems.length > 0 ? (
                            <div className="col-span-full md:hidden">
                                <ArticleOnThisPageNav items={tocItems} variant="bar" />
                            </div>
                        ) : null}

                        <article className="rounded-[1.5rem] border border-[color:var(--qc-border)] bg-[color:var(--qc-surface)] p-6 sm:p-10">
                            {children}
                        </article>

                        <aside className="space-y-5">
                            {tocItems.length > 0 ? (
                                <div className="hidden md:block">
                                    <ArticleOnThisPageNav items={tocItems} />
                                </div>
                            ) : null}

                            {sidebar}

                            <section className="rounded-[1.5rem] border border-[color:var(--qc-border)] bg-[color:var(--qc-canvas)] p-6">
                                <h2 className="qc-display text-lg">More from the library</h2>
                                <p className="mt-2 text-[13.5px] leading-6 text-[color:var(--qc-ink-muted)]">
                                    Browse short reads, audio, and exercises in MindMitra's resource library.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => navigate("/psychological-content")}
                                    className="qc-pill-outline mt-4"
                                >
                                    Open resources
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </button>
                            </section>
                        </aside>
                    </section>
                </div>
            </PageShell>
            <HillsFooter />
        </>
    );
}

export default ArticleLayout;

/**
 * Convenience subcomponent used inside <ArticleLayout> children for a simple
 * lead-in paragraph (Quiet Companion typography).
 */
export function ArticleLead({ children }: { children: ReactNode }) {
    return (
        <p className="text-[15.5px] leading-[1.75] text-[color:var(--qc-ink-soft)]">
            {children}
        </p>
    );
}

export interface ArticleStepCardProps {
    id?: string;
    index: number;
    eyebrow: string;
    title: string;
    time?: string;
    icon: LucideIcon;
    steps: string[];
    whyItWorks?: string;
}

/**
 * Numbered step card used in the body of all 5 article pages. Replaces the
 * repeated step-card markup so each article only carries its data.
 */
export function ArticleStepCard({ id, index, eyebrow, title, time, icon, steps, whyItWorks }: ArticleStepCardProps) {
    const Icon = icon;

    return (
        <section
            id={id}
            className="scroll-mt-28 rounded-[1.25rem] border border-[color:var(--qc-border)] bg-[color:var(--qc-canvas)] p-5"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--qc-sage)]/30 text-[color:var(--qc-forest)]">
                        <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0">
                        <p className="qc-eyebrow text-[color:var(--qc-forest)]">
                            {eyebrow} {index + 1}
                        </p>
                        <h2 className="qc-display mt-1.5 text-[1.15rem] leading-snug">{title}</h2>
                    </div>
                </div>

                {time ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--qc-surface)] px-3 py-1 text-[12px] text-[color:var(--qc-ink-muted)]">
                        <Clock className="h-3.5 w-3.5 text-[color:var(--qc-forest)]" />
                        {time}
                    </span>
                ) : null}
            </div>

            <ul className="mt-4 space-y-2.5">
                {steps.map((step) => (
                    <li
                        key={step}
                        className="flex items-start gap-3 text-[14.5px] leading-[1.7] text-[color:var(--qc-ink-soft)]"
                    >
                        <CheckCircle2
                            className="mt-1 h-4 w-4 shrink-0 text-[color:var(--qc-forest)]"
                            strokeWidth={1.8}
                        />
                        <span>{step}</span>
                    </li>
                ))}
            </ul>

            {whyItWorks ? (
                <div className="mt-5 rounded-2xl bg-[color:var(--qc-surface)] p-4">
                    <p className="qc-eyebrow">Why it helps</p>
                    <p className="mt-2 text-[13.5px] leading-[1.7] text-[color:var(--qc-ink-soft)]">
                        {whyItWorks}
                    </p>
                </div>
            ) : null}
        </section>
    );
}

/**
 * Compact aside card used inside the `sidebar` prop.
 */
export function ArticleSideCard({
    title,
    children,
    tone = "default",
}: {
    title: string;
    children: ReactNode;
    tone?: "default" | "warm";
}) {
    return (
        <section
            className={cn(
                "rounded-[1.5rem] border p-5",
                tone === "warm"
                    ? "border-[color:var(--qc-sage)] bg-[color:var(--qc-surface)]"
                    : "border-[color:var(--qc-border)] bg-[color:var(--qc-surface)]",
            )}
        >
            <h2 className="qc-display text-base">{title}</h2>
            <div className="mt-3 text-[13.5px] leading-[1.7] text-[color:var(--qc-ink-soft)]">
                {children}
            </div>
        </section>
    );
}
