import { ReactNode } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Sparkles, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
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
    heroAccent?: string; // emoji shown in the hero corner when no image is provided
    tocItems: ArticleTocItem[];
    sidebar?: ReactNode;
    children: ReactNode;
}

const eyebrowChip =
    "inline-flex items-center gap-2 rounded-full border border-ink-3/25 bg-[hsl(var(--card))]/85 px-3.5 py-1 text-[12px] font-medium text-ink-7 shadow-sm dark:border-ink-3/20";

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
        <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
            <Header />
            <ArticleScrollProgress />

            <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
                {/* Hero — calmer panel: soft warm wash, lighter chrome, no heavy gradient frame */}
                <section className="relative overflow-hidden rounded-[1.75rem] border border-ink-3/25 bg-[hsl(var(--card))] shadow-dashboard-soft dark:border-ink-3/20">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0"
                        style={{
                            backgroundImage:
                                "radial-gradient(620px 320px at 8% -10%, hsl(var(--warmth-50) / 0.85) 0%, transparent 55%), radial-gradient(520px 300px at 100% 0%, hsl(var(--accent-50) / 0.55) 0%, transparent 55%)",
                        }}
                    />
                    <div
                        className={cn(
                            "relative grid gap-8 px-6 py-8 sm:px-8 sm:py-10 md:px-10",
                            heroImage ? "md:grid-cols-[1.25fr_0.75fr]" : "md:grid-cols-[1fr]",
                        )}
                    >
                        <div className="min-w-0">
                            <button
                                type="button"
                                onClick={() => navigate(-1)}
                                className="inline-flex items-center gap-2 rounded-full border border-ink-3/25 bg-[hsl(var(--card))]/90 px-3.5 py-1.5 text-[13px] font-medium text-ink-6 shadow-sm transition-colors hover:text-ink-8 dark:border-ink-3/20"
                            >
                                <ArrowLeft className="h-3.5 w-3.5" />
                                Back
                            </button>

                            <div className={cn(eyebrowChip, "mt-6")}>
                                <Eyebrow className="h-3.5 w-3.5 text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]" />
                                <span>{eyebrow.label}</span>
                            </div>

                            <h1 className="mt-4 text-balance font-display text-[clamp(1.75rem,3.6vw,2.5rem)] font-light leading-[1.15] tracking-tight text-ink-8">
                                {title}
                            </h1>

                            <p className="mt-4 max-w-2xl text-[15.5px] leading-[1.7] text-ink-6 sm:text-base">{intro}</p>

                            {chips.length > 0 ? (
                                <div className="mt-6 flex flex-wrap items-center gap-2.5 text-[12.5px] text-ink-5">
                                    {chips.map(({ icon: Icon, label }, i) => (
                                        <span
                                            key={`${label}-${i}`}
                                            className="inline-flex items-center gap-1.5 rounded-full border border-ink-3/20 bg-[hsl(var(--card))]/80 px-3 py-1"
                                        >
                                            {Icon ? (
                                                <Icon className="h-3.5 w-3.5 text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]" />
                                            ) : (
                                                <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]" />
                                            )}
                                            {label}
                                        </span>
                                    ))}
                                </div>
                            ) : null}
                        </div>

                        {heroImage ? (
                            <div className="flex items-center justify-center rounded-[1.5rem] bg-[hsl(var(--card))]/70 p-4">
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
                                    className="flex h-32 w-32 items-center justify-center rounded-full bg-[hsl(var(--accent-100))]/50 text-5xl shadow-inner dark:bg-[hsl(var(--accent-100))]/15 sm:h-40 sm:w-40 sm:text-6xl"
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

                    <article className="rounded-[1.5rem] border border-ink-3/25 bg-[hsl(var(--card))] p-6 shadow-dashboard-soft dark:border-ink-3/20 sm:p-8">
                        {children}
                    </article>

                    <aside className="space-y-5">
                        {tocItems.length > 0 ? (
                            <div className="hidden md:block">
                                <ArticleOnThisPageNav items={tocItems} />
                            </div>
                        ) : null}

                        {sidebar}

                        <section className="rounded-[1.5rem] border border-ink-3/25 bg-[hsl(var(--ink-8))] p-6 text-white shadow-dashboard-soft">
                            <h2 className="text-base font-semibold">More from the library</h2>
                            <p className="mt-2 text-[13.5px] leading-6 text-white/75">
                                Browse short reads, audio, and exercises in MindMitra’s resource library.
                            </p>
                            <button
                                type="button"
                                onClick={() => navigate("/psychological-content")}
                                className="mt-4 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--card))] px-4 py-2 text-[13px] font-semibold text-ink-8 transition-colors hover:bg-[hsl(var(--ink-1))]"
                            >
                                Open resources
                                <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                        </section>
                    </aside>
                </section>
            </main>

            <Footer />
        </div>
    );
}

export default ArticleLayout;

/**
 * Convenience subcomponent used inside <ArticleLayout> children for a simple
 * lead-in paragraph (Quiet Companion typography).
 */
export function ArticleLead({ children }: { children: ReactNode }) {
    return <p className="text-[15px] leading-[1.75] text-ink-6">{children}</p>;
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
            className={cn(
                "scroll-mt-28 rounded-[1.25rem] border border-ink-3/25 p-5",
                "bg-[hsl(var(--ink-1))]/55 dark:border-ink-3/20 dark:bg-[hsl(var(--ink-2))]/35",
            )}
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--accent-100))]/55 text-[hsl(var(--accent-600))] dark:bg-[hsl(var(--accent-100))]/15 dark:text-[hsl(var(--accent-400))]">
                        <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]">
                            {eyebrow} {index + 1}
                        </p>
                        <h2 className="mt-1 font-display text-[1.1rem] font-medium leading-snug text-ink-8">{title}</h2>
                    </div>
                </div>

                {time ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--card))] px-3 py-1 text-[12px] font-medium text-ink-6">
                        <Clock className="h-3.5 w-3.5 text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]" />
                        {time}
                    </span>
                ) : null}
            </div>

            <ul className="mt-4 space-y-2.5">
                {steps.map((step) => (
                    <li key={step} className="flex items-start gap-3 text-[14px] leading-[1.7] text-ink-6">
                        <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]" strokeWidth={1.8} />
                        <span>{step}</span>
                    </li>
                ))}
            </ul>

            {whyItWorks ? (
                <div className="mt-4 rounded-2xl bg-[hsl(var(--card))] p-4">
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-ink-5">Why it helps</p>
                    <p className="mt-1.5 text-[13.5px] leading-[1.7] text-ink-6">{whyItWorks}</p>
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
                "rounded-[1.5rem] border p-5 shadow-dashboard-soft",
                tone === "warm"
                    ? "border-[hsl(var(--accent-400))]/25 bg-gradient-to-br from-[hsl(var(--warmth-50))]/65 to-[hsl(var(--accent-50))]/40 dark:border-[hsl(var(--accent-500))]/20"
                    : "border-ink-3/25 bg-[hsl(var(--card))] dark:border-ink-3/20",
            )}
        >
            <h2 className="text-[15px] font-semibold text-ink-8">{title}</h2>
            <div className="mt-3 text-[13.5px] leading-[1.7] text-ink-6">{children}</div>
        </section>
    );
}
