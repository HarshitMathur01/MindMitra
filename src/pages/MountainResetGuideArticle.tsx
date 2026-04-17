import {
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    Clock,
    ExternalLink,
    Mountain,
    Sparkles,
    Trees,
    Wind,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const guideSteps = [
    {
        title: "Let your eyes rest on the horizon",
        icon: Mountain,
        time: "60 seconds",
        steps: [
            "Find a mountain image, a far-away landscape, or a view through a window.",
            "Soften your eyes and notice the shape of the horizon instead of scanning for problems.",
            "Stay with one steady point for two or three slow breaths.",
        ],
        whyItWorks:
            "A wide, steady visual focus can help interrupt tunnel vision and signal to the body that it has permission to ease out of urgency.",
    },
    {
        title: "Match your breath to the scene",
        icon: Wind,
        time: "90 seconds",
        steps: [
            "Breathe in through your nose for 4 counts.",
            "Breathe out slowly for 6 counts as if the breath is rolling down a mountain slope.",
            "Repeat 5 times without forcing depth or speed.",
        ],
        whyItWorks:
            "Longer exhales support down-regulation, which can reduce the physical edge of stress and make the mind feel less crowded.",
    },
    {
        title: "Name what feels steady right now",
        icon: Trees,
        time: "90 seconds",
        steps: [
            "Quietly name three things that feel solid, stable, or supportive around you.",
            "Try examples like: the floor, the chair, the wall, the light, or your own feet.",
            "Finish with one sentence: ‘I can slow down for this moment.’",
        ],
        whyItWorks:
            "Naming stable cues around you gently brings attention back to the present and can make the nervous system feel more anchored.",
    },
];

const references = [
    {
        label: "American Psychological Association — How nature can improve your health",
        href: "https://www.apa.org/monitor/2020/04/nurtured-nature",
    },
    {
        label: "Cleveland Clinic — Grounding Techniques",
        href: "https://health.clevelandclinic.org/grounding-techniques",
    },
    {
        label: "National Center for Complementary and Integrative Health — Relaxation Techniques",
        href: "https://www.nccih.nih.gov/health/relaxation-techniques-what-you-need-to-know",
    },
    {
        label: "Mind — Relaxation tips to relieve stress",
        href: "https://www.mind.org.uk/information-support/types-of-mental-health-problems/stress/relaxation/",
    },
];

const MountainResetGuideArticle = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
            <Header />

            <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
                <section className="overflow-hidden rounded-[2rem] border border-ink-3/30 bg-gradient-to-br from-[#ECFEFF] via-white to-[#F0FDF4] shadow-dashboard-soft">
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
                                <Mountain className="h-4 w-4" />
                                Nature grounding guide
                            </div>

                            <h1 className="mt-4 font-display text-3xl font-light leading-tight tracking-tight text-ink-8 sm:text-4xl">
                                Mountain reset for a calmer mind
                            </h1>

                            <p className="mt-4 max-w-2xl text-base leading-7 text-ink-6 sm:text-lg">
                                When your thoughts feel loud or your body feels overstretched, a mountain-based visual reset can help you widen your attention, slow your breathing, and reconnect with a steadier inner pace.
                            </p>

                            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-ink-5">
                                <span className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--card))] px-3 py-1.5">
                                    <Clock className="h-4 w-4 text-primary" />
                                    4 min read
                                </span>
                                <span className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--card))] px-3 py-1.5">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                    Grounding, breath, and visual calm
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center justify-center rounded-[1.75rem] bg-[hsl(var(--card))]/85 p-6">
                            <img
                                src="https://images.unsplash.com/photo-1503614472-8c93d56e92ce?auto=format&fit=crop&w=900&q=80"
                                alt="A mountain landscape for a calming visual reset"
                                className="h-full max-h-[320px] w-full rounded-2xl object-cover"
                            />
                        </div>
                    </div>
                </section>

                <section className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
                    <article className="rounded-[1.75rem] border border-ink-3/30 bg-[hsl(var(--card))] p-6 shadow-dashboard-soft sm:p-8">
                        <p className="text-sm leading-7 text-ink-6">
                            Sometimes the mind settles faster when attention moves away from pressure and toward something wider, quieter, and more stable. Mountains can work well for this because they naturally suggest steadiness. Even if you are indoors, looking at a mountain photo or any distant landscape can create a brief pause from mental overdrive.
                        </p>

                        <p className="mt-4 text-sm leading-7 text-ink-6">
                            This reset is not about forcing yourself to feel better instantly. It is about giving your nervous system a simpler job for a few minutes: look, breathe, and notice what is steady. That combination can help reduce overwhelm and create a small pocket of calm.
                        </p>

                        <div className="mt-8 space-y-6">
                            {guideSteps.map((step, index) => {
                                const Icon = step.icon;

                                return (
                                    <section key={step.title} className="rounded-2xl border border-ink-3/30 bg-[hsl(var(--ink-1))]/55 p-5">
                                        <div className="flex flex-wrap items-start justify-between gap-4">
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                                    <Icon className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">
                                                        Reset step {index + 1}
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

                        <section className="mt-8 rounded-2xl border border-ink-3/30 bg-muted/40 p-5">
                            <h2 className="text-lg font-semibold text-ink-8">References</h2>
                            <p className="mt-2 text-sm leading-7 text-ink-6">
                                These sources support the grounding, relaxation, and nature-based calming ideas used in this guide.
                            </p>
                            <ul className="mt-4 space-y-3">
                                {references.map((reference) => (
                                    <li key={reference.href}>
                                        <a
                                            href={reference.href}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-start gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
                                        >
                                            <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" />
                                            <span>{reference.label}</span>
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </article>

                    <aside className="space-y-5">
                        <section className="rounded-[1.75rem] border border-ink-3/30 bg-[hsl(var(--card))] p-6 shadow-dashboard-soft">
                            <h2 className="text-lg font-semibold text-ink-8">Try this in 3 minutes</h2>
                            <ol className="mt-4 space-y-3 text-sm leading-7 text-ink-6">
                                <li>1. Look at a mountain or landscape image.</li>
                                <li>2. Take 5 breaths with a longer exhale.</li>
                                <li>3. Name 3 steady things around you.</li>
                            </ol>
                        </section>

                        <section className="rounded-[1.75rem] border border-ink-3/30 bg-gradient-to-br from-primary/8 to-emerald-50 p-6 shadow-dashboard-soft">
                            <h2 className="text-lg font-semibold text-ink-8">Helpful reminder</h2>
                            <p className="mt-3 text-sm leading-7 text-ink-6">
                                Calm does not have to arrive all at once. If this guide helps you feel even 5% more settled, that is a meaningful shift.
                            </p>
                        </section>

                        <section className="rounded-[1.75rem] border border-ink-3/30 bg-[hsl(var(--ink-8))] p-6 text-white shadow-dashboard-soft">
                            <h2 className="text-lg font-semibold">Explore more resources</h2>
                            <p className="mt-3 text-sm leading-7 text-white/75">
                                Open the resource library for more grounding exercises, calming guides, and psychology-backed tools.
                            </p>
                            <button
                                type="button"
                                onClick={() => navigate("/psychological-content")}
                                className="mt-5 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--card))] px-4 py-2.5 text-sm font-semibold text-ink-8 transition-transform hover:scale-[1.02]"
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

export default MountainResetGuideArticle;
