import { useMemo } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, MoonStar, Sparkles, Stars, Wind } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import {
    ArticleOnThisPageNav,
    ArticleScrollProgress,
    makeArticleStepId,
} from "@/components/resources/ArticleReadingEnhancements";

const bedtimeSteps = [
    {
        title: "Create a soft landing from the day",
        icon: MoonStar,
        time: "5 minutes",
        steps: [
            "Dim the lights in your room if you can.",
            "Put your phone on charge away from your pillow.",
            "Let your body know that stimulation is winding down.",
        ],
        whyItWorks:
            "Your brain needs cues that daytime is ending. Lower light and fewer alerts help the body shift toward rest instead of staying alert.",
    },
    {
        title: "Clear the mind with a short brain-dump",
        icon: Sparkles,
        time: "3 minutes",
        steps: [
            "Write down what is unfinished, worrying, or easy to forget.",
            "Add one tiny first step for tomorrow.",
            "Tell yourself: I do not need to solve this tonight.",
        ],
        whyItWorks:
            "Racing thoughts often continue because the brain is trying not to lose track of important things. Writing them down reduces that mental holding pattern.",
    },
    {
        title: "Settle the body before sleep",
        icon: Wind,
        time: "2 minutes",
        steps: [
            "Take slow breaths with a slightly longer exhale.",
            "Relax your jaw, shoulders, and belly.",
            "Let your attention rest on the feeling of the bed supporting you.",
        ],
        whyItWorks:
            "Deep rest becomes easier when the body stops bracing. A calm body gives the mind permission to release the day.",
    },
];

const BedtimeRoutineArticle = () => {
    const navigate = useNavigate();

    const tocItems = useMemo(
        () =>
            bedtimeSteps.map((r, i) => ({
                id: makeArticleStepId("bedtime", i, r.title),
                label: `${i + 1}. ${r.title.length > 40 ? `${r.title.slice(0, 38)}…` : r.title}`,
            })),
        [],
    );

    return (
        <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
            <Header />
            <ArticleScrollProgress />

            <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
                <section className="overflow-hidden rounded-[2rem] border border-ink-3/30 bg-gradient-to-br from-[hsl(var(--warmth-50))]/90 via-[hsl(var(--card))] to-[hsl(var(--accent-50))]/45 shadow-dashboard-soft">
                    <div className="grid gap-8 px-6 py-8 md:grid-cols-[1.2fr_0.8fr] md:px-10 md:py-10">
                        <div>
                            <button
                                type="button"
                                onClick={() => navigate(-1)}
                                className="inline-flex items-center gap-2 rounded-full border border-ink-3/30 bg-[hsl(var(--card))] px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </button>

                            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                                <Stars className="h-4 w-4" />
                                Bedtime routine for deep rest
                            </div>

                            <h1 className="mt-4 font-display text-3xl font-light leading-tight tracking-tight text-ink-8 sm:text-4xl">
                                A calming bedtime routine for deep rest
                            </h1>

                            <p className="mt-4 max-w-2xl text-base leading-7 text-ink-6 sm:text-lg">
                                Rest starts before your head touches the pillow. A gentle night routine can help your body feel safe enough to slow down, so sleep feels more inviting and less like a struggle.
                            </p>

                            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-ink-5">
                                <span className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--card))] px-3 py-1.5">
                                    <Clock className="h-4 w-4 text-primary" />
                                    4 min read
                                </span>
                                <span className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--card))] px-3 py-1.5">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                    Gentle evening reset
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center justify-center rounded-[1.75rem] bg-[hsl(var(--card))]/85 p-6">
                            <img
                                src="https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=900&q=80"
                                alt="A peaceful bedtime routine scene"
                                className="h-full max-h-[320px] w-full rounded-[1.25rem] object-cover"
                            />
                        </div>
                    </div>
                </section>

                <section className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
                    <div className="col-span-full md:hidden">
                        <ArticleOnThisPageNav items={tocItems} variant="bar" />
                    </div>
                    <article className="rounded-[1.75rem] border border-ink-3/30 bg-[hsl(var(--card))] p-6 shadow-dashboard-soft sm:p-8">
                        <p className="text-sm leading-7 text-ink-6">
                            Many people try to fall asleep while their body is still carrying the speed of the day. Notifications, unfinished thoughts, emotional conversations, bright screens, and late-night pressure can all keep the nervous system on alert.
                        </p>

                        <p className="mt-4 text-sm leading-7 text-ink-6">
                            A bedtime routine helps by creating a bridge between activity and rest. It does not need to be elaborate. It just needs to send a clear message: the day is ending, and you are allowed to soften.
                        </p>

                        <div className="mt-8 space-y-6">
                            {bedtimeSteps.map((step, index) => {
                                const Icon = step.icon;
                                const stepId = tocItems[index]?.id ?? makeArticleStepId("bedtime", index, step.title);

                                return (
                                    <section
                                        key={step.title}
                                        id={stepId}
                                        className="scroll-mt-28 rounded-[1.25rem] border border-ink-3/30 bg-[hsl(var(--ink-1))]/55 p-5"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-4">
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                                    <Icon className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">
                                                        Bedtime step {index + 1}
                                                    </p>
                                                    <h2 className="mt-1 text-xl font-semibold text-ink-8">{step.title}</h2>
                                                </div>
                                            </div>

                                            <span className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--card))] px-3 py-1 text-sm font-medium text-ink-6">
                                                <Clock className="h-4 w-4 text-primary" />
                                                {step.time}
                                            </span>
                                        </div>

                                        <ul className="mt-5 space-y-3">
                                            {step.steps.map((item) => (
                                                <li key={item} className="flex items-start gap-3 text-sm leading-7 text-ink-6">
                                                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                                                    <span>{item}</span>
                                                </li>
                                            ))}
                                        </ul>

                                        <div className="mt-5 rounded-2xl bg-[hsl(var(--card))] p-4">
                                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-5">
                                                Why it helps
                                            </p>
                                            <p className="mt-2 text-sm leading-7 text-ink-6">{step.whyItWorks}</p>
                                        </div>
                                    </section>
                                );
                            })}
                        </div>
                    </article>

                    <aside className="space-y-5">
                        <div className="hidden md:block">
                            <ArticleOnThisPageNav items={tocItems} />
                        </div>
                        <section className="rounded-[1.75rem] border border-ink-3/30 bg-[hsl(var(--card))] p-6 shadow-dashboard-soft">
                            <h2 className="text-lg font-semibold text-ink-8">A simple order to follow</h2>
                            <ol className="mt-4 space-y-3 text-sm leading-7 text-ink-6">
                                <li>1. Dim lights and reduce stimulation.</li>
                                <li>2. Write down tomorrow's worries and tasks.</li>
                                <li>3. Relax the body before trying to sleep.</li>
                            </ol>
                        </section>

                        <section className="rounded-[1.75rem] border border-ink-3/30 bg-gradient-to-br from-[hsl(var(--accent-50))]/45 to-[hsl(var(--warmth-50))]/80 p-6 shadow-dashboard-soft">
                            <h2 className="text-lg font-semibold text-ink-8">Be gentle with yourself</h2>
                            <p className="mt-3 text-sm leading-7 text-ink-6">
                                A calming routine is not a performance. If you miss a night or only do one step, it still counts. Consistency grows best in kindness, not pressure.
                            </p>
                        </section>

                        <section className="rounded-[1.75rem] border border-ink-3/30 bg-[hsl(var(--ink-8))] p-6 text-white shadow-dashboard-soft">
                            <h2 className="text-lg font-semibold">Explore more resources</h2>
                            <p className="mt-3 text-sm leading-7 text-white/75">
                                Discover more evidence-based guides, emotional wellness tools, and calming practices in the resource library.
                            </p>
                            <button
                                type="button"
                                onClick={() => navigate("/psychological-content")}
                                className="mt-5 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--card))] px-4 py-2.5 text-sm font-semibold text-ink-8 transition-colors hover:bg-[hsl(var(--ink-1))]"
                            >
                                Open resources
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </section>
                    </aside>
                </section>
            </main>

            <Footer />
        </div>
    );
};

export default BedtimeRoutineArticle;