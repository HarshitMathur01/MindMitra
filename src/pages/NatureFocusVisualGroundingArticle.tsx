import {
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    Clock,
    ExternalLink,
    Eye,
    Leaf,
    Sparkles,
    Trees,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const groundingSteps = [
    {
        title: "Start with a wide gaze",
        icon: Eye,
        time: "60 seconds",
        steps: [
            "Look at a nature image, tree line, hill, or open sky.",
            "Let your eyes widen instead of concentrating on one tiny detail.",
            "Notice the overall colors, depth, and shapes in front of you.",
        ],
        whyItWorks:
            "A softer, wider visual focus can help ease the sense of mental narrowing that often comes with stress, anxiety, or overload.",
    },
    {
        title: "Anchor attention to five natural details",
        icon: Leaf,
        time: "2 minutes",
        steps: [
            "Name one color you notice in the scene.",
            "Name one texture, one shadow, one line, and one point of light.",
            "Take one slow breath after each detail.",
        ],
        whyItWorks:
            "Gentle visual labeling redirects attention into the present moment and gives the nervous system a simple, structured task.",
    },
    {
        title: "End with one steady sentence",
        icon: Trees,
        time: "2 minutes",
        steps: [
            "Place one hand on your chest or lap.",
            "Say quietly: ‘I am here, and this moment can be softer.’",
            "Stay still for two more slow breaths before moving on.",
        ],
        whyItWorks:
            "Pairing a grounding phrase with a slower body rhythm can make calm feel more believable and easier to access again later.",
    },
];

const references = [
    {
        label: "American Psychological Association — The nature cure",
        href: "https://www.apa.org/monitor/2020/04/nurtured-nature",
    },
    {
        label: "University of California, Davis — Humans need nature to thrive",
        href: "https://www.ucdavis.edu/climate/news/humans-need-nature-thrive",
    },
    {
        label: "Cleveland Clinic — Grounding Techniques",
        href: "https://health.clevelandclinic.org/grounding-techniques",
    },
    {
        label: "NHS — Self-help tips to fight stress",
        href: "https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/tips-to-reduce-stress/",
    },
];

const NatureFocusVisualGroundingArticle = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
            <Header />

            <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
                <section className="overflow-hidden rounded-[32px] border border-border/50 bg-gradient-to-br from-[#F0FDF4] via-white to-[#EFF6FF] shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
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
                                <Eye className="h-4 w-4" />
                                Visual grounding guide
                            </div>

                            <h1 className="mt-4 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
                                Nature focus: 5-minute visual grounding
                            </h1>

                            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                                When your mind feels scattered, visual grounding with nature can help you slow down, widen attention, and reconnect with the present through simple observation instead of mental effort.
                            </p>

                            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5">
                                    <Clock className="h-4 w-4 text-primary" />
                                    5 min practice
                                </span>
                                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                    Calm attention and sensory reset
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center justify-center rounded-[28px] bg-white/80 p-6">
                            <img
                                src="https://plus.unsplash.com/premium_photo-1661964177687-57387c2cbd14?auto=format&fit=crop&w=900&q=80"
                                alt="Nature focus: 5-minute visual grounding"
                                className="h-full max-h-[320px] w-full rounded-2xl object-cover"
                            />
                        </div>
                    </div>
                </section>

                <section className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
                    <article className="rounded-[28px] border border-border/50 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)] sm:p-8">
                        <p className="text-sm leading-7 text-slate-600">
                            Visual grounding works by giving your attention something real, steady, and non-demanding to rest on. Nature scenes are especially helpful because they often contain repeating patterns, soft textures, and a sense of spaciousness that the body can interpret as less threatening than busy, high-stimulation environments.
                        </p>

                        <p className="mt-4 text-sm leading-7 text-slate-600">
                            You do not need to be outside for this to help. A photo of trees, mountains, water, or sky can still provide a useful anchor. The purpose is not to perform mindfulness perfectly. It is to help your mind shift from spiraling thoughts into clear, sensory contact with the present.
                        </p>

                        <div className="mt-8 space-y-6">
                            {groundingSteps.map((step, index) => {
                                const Icon = step.icon;

                                return (
                                    <section key={step.title} className="rounded-2xl border border-border/50 bg-slate-50 p-5">
                                        <div className="flex flex-wrap items-start justify-between gap-4">
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                                    <Icon className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">
                                                        Grounding step {index + 1}
                                                    </p>
                                                    <h2 className="mt-1 text-xl font-semibold text-slate-900">{step.title}</h2>
                                                </div>
                                            </div>

                                            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-600">
                                                <Clock className="h-4 w-4 text-primary" />
                                                {step.time}
                                            </span>
                                        </div>

                                        <ul className="mt-5 space-y-3">
                                            {step.steps.map((item) => (
                                                <li key={item} className="flex items-start gap-3 text-sm leading-7 text-slate-600">
                                                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                                                    <span>{item}</span>
                                                </li>
                                            ))}
                                        </ul>

                                        <div className="mt-5 rounded-2xl bg-white p-4">
                                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                                                Why it helps
                                            </p>
                                            <p className="mt-2 text-sm leading-7 text-slate-600">{step.whyItWorks}</p>
                                        </div>
                                    </section>
                                );
                            })}
                        </div>

                        <section className="mt-8 rounded-2xl border border-border/50 bg-muted/40 p-5">
                            <h2 className="text-lg font-semibold text-slate-900">References</h2>
                            <p className="mt-2 text-sm leading-7 text-slate-600">
                                These sources support the grounding, relaxation, and nature-exposure ideas used in this visual reset.
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
                        <section className="rounded-[28px] border border-border/50 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                            <h2 className="text-lg font-semibold text-slate-900">Quick version</h2>
                            <ol className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                                <li>1. Look at one calming nature image.</li>
                                <li>2. Name 5 visible details slowly.</li>
                                <li>3. End with 2 slow breaths and one grounding phrase.</li>
                            </ol>
                        </section>

                        <section className="rounded-[28px] border border-border/50 bg-gradient-to-br from-primary/8 to-cyan-50 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                            <h2 className="text-lg font-semibold text-slate-900">Helpful reminder</h2>
                            <p className="mt-3 text-sm leading-7 text-slate-600">
                                If your thoughts keep drifting, that is okay. Each gentle return to what you can see is part of the practice.
                            </p>
                        </section>

                        <section className="rounded-[28px] border border-border/50 bg-slate-900 p-6 text-white shadow-[0_18px_40px_rgba(15,23,42,0.14)]">
                            <h2 className="text-lg font-semibold">Explore more resources</h2>
                            <p className="mt-3 text-sm leading-7 text-slate-300">
                                Open the resource library for more grounding exercises, calming guides, and evidence-based wellness tools.
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

export default NatureFocusVisualGroundingArticle;
