import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Flower2, Sparkles, Wind } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const rituals = [
    {
        title: "The 60-second sensory check-in",
        icon: Flower2,
        time: "1 minute",
        steps: [
            "Look around and name one thing you can see in each direction.",
            "Notice two sounds without judging them as good or bad.",
            "Touch one nearby surface and describe its texture to yourself.",
        ],
        whyItWorks:
            "This interrupts autopilot and reminds your nervous system that you are in the present moment, not inside the stress story in your head.",
    },
    {
        title: "Breath + body reset before you rush out",
        icon: Wind,
        time: "90 seconds",
        steps: [
            "Plant both feet on the floor before checking your phone again.",
            "Inhale for 4 counts, exhale for 6 counts, and repeat 5 times.",
            "Drop your shoulders, unclench your jaw, and soften your forehead.",
        ],
        whyItWorks:
            "A longer exhale signals safety to the body, while relaxing your muscles reduces the physical tension that can make mornings feel more chaotic than they are.",
    },
    {
        title: "One-line intention for the day",
        icon: Sparkles,
        time: "30 seconds",
        steps: [
            "Choose one sentence that feels kind and realistic.",
            "Try: ‘Today I will move steadily, not perfectly.’",
            "Repeat it once while picking up your bag, keys, or water bottle.",
        ],
        whyItWorks:
            "A short intention gives your mind a stable anchor before the demands of the day start competing for your attention.",
    },
];

const GroundingRitualsArticle = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
            <Header />

            <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
                <section className="overflow-hidden rounded-[32px] border border-border/50 bg-gradient-to-br from-[#EFF6FF] via-white to-[#FFF7ED] shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
                    <div className="grid gap-8 px-6 py-8 md:grid-cols-[1.2fr_0.8fr] md:px-10 md:py-10">
                        <div>
                            <button
                                type="button"
                                onClick={() => navigate(-1)}
                                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-white px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </button>

                            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                                <Flower2 className="h-4 w-4" />
                                Morning grounding article
                            </div>

                            <h1 className="mt-4 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
                                3 grounding rituals for busy mornings
                            </h1>

                            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                                If your mornings feel like a sprint before your mind has even fully arrived, these tiny rituals can help you feel calmer, clearer, and more present in under three minutes.
                            </p>

                            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5">
                                    <Clock className="h-4 w-4 text-primary" />
                                    4 min read
                                </span>
                                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                    Gentle, practical, beginner-friendly
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center justify-center rounded-[28px] bg-white/80 p-6">
                            <img
                                src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80"
                                alt="A calm sunrise scene for grounding"
                                className="h-full max-h-[320px] w-full rounded-[24px] object-cover"
                            />
                        </div>
                    </div>
                </section>

                <section className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
                    <article className="rounded-[28px] border border-border/50 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)] sm:p-8">
                        <p className="text-sm leading-7 text-slate-600">
                            Busy mornings often push the body into urgency before the day has properly begun. You wake up, check notifications, think about unfinished tasks, and suddenly your breathing gets shallow and your attention scatters. Grounding rituals work because they bring you back into the body and into the current moment.
                        </p>

                        <p className="mt-4 text-sm leading-7 text-slate-600">
                            The goal is not to create a perfect wellness routine. The goal is to create a brief pause between waking up and reacting. Even one grounded minute can change the emotional tone of the next hour.
                        </p>

                        <div className="mt-8 space-y-6">
                            {rituals.map((ritual, index) => {
                                const Icon = ritual.icon;

                                return (
                                    <section
                                        key={ritual.title}
                                        className="rounded-[24px] border border-border/50 bg-slate-50 p-5"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-4">
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                                    <Icon className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">
                                                        Ritual {index + 1}
                                                    </p>
                                                    <h2 className="mt-1 text-xl font-semibold text-slate-900">{ritual.title}</h2>
                                                </div>
                                            </div>

                                            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-600">
                                                <Clock className="h-4 w-4 text-primary" />
                                                {ritual.time}
                                            </span>
                                        </div>

                                        <ul className="mt-5 space-y-3">
                                            {ritual.steps.map((step) => (
                                                <li key={step} className="flex items-start gap-3 text-sm leading-7 text-slate-600">
                                                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                                                    <span>{step}</span>
                                                </li>
                                            ))}
                                        </ul>

                                        <div className="mt-5 rounded-2xl bg-white p-4">
                                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                                                Why it helps
                                            </p>
                                            <p className="mt-2 text-sm leading-7 text-slate-600">{ritual.whyItWorks}</p>
                                        </div>
                                    </section>
                                );
                            })}
                        </div>
                    </article>

                    <aside className="space-y-5">
                        <section className="rounded-[28px] border border-border/50 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                            <h2 className="text-lg font-semibold text-slate-900">Try the 2-minute version</h2>
                            <ol className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                                <li>1. Name 3 things you can see.</li>
                                <li>2. Take 5 slow breaths with a longer exhale.</li>
                                <li>3. Repeat one kind sentence to yourself.</li>
                            </ol>
                        </section>

                        <section className="rounded-[28px] border border-border/50 bg-gradient-to-br from-primary/8 to-orange-50 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                            <h2 className="text-lg font-semibold text-slate-900">A helpful reminder</h2>
                            <p className="mt-3 text-sm leading-7 text-slate-600">
                                Grounding is not about doing more before work, study, or caregiving. It is about meeting yourself kindly before the world asks things from you.
                            </p>
                        </section>

                        <section className="rounded-[28px] border border-border/50 bg-slate-900 p-6 text-white shadow-[0_18px_40px_rgba(15,23,42,0.14)]">
                            <h2 className="text-lg font-semibold">Explore more resources</h2>
                            <p className="mt-3 text-sm leading-7 text-slate-300">
                                Find more psychology-backed tools, exercises, and calming guides inside MindMitra's resource library.
                            </p>
                            <button
                                type="button"
                                onClick={() => navigate("/psychological-content")}
                                className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition-transform hover:scale-[1.02]"
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

export default GroundingRitualsArticle;