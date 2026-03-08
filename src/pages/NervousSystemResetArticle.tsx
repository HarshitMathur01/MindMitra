import { ArrowLeft, ArrowRight, Brain, CheckCircle2, Clock, Sparkles, Wind } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const resetSteps = [
    {
        title: "Lengthen your exhale first",
        icon: Wind,
        time: "45 seconds",
        steps: [
            "Breathe in gently through your nose for 4 counts.",
            "Breathe out slowly for 6 or 7 counts.",
            "Repeat for 5 rounds without forcing a deep breath.",
        ],
        whyItWorks:
            "A longer exhale tells the body that it is safe enough to come down from urgency, which helps reduce that wired, overstimulated feeling.",
    },
    {
        title: "Orient to the room around you",
        icon: Brain,
        time: "35 seconds",
        steps: [
            "Turn your head slowly and look around the space you are in.",
            "Notice one color, one shape, and one source of light.",
            "Let your eyes land on something steady for one full breath.",
        ],
        whyItWorks:
            "When you physically orient to your environment, the brain gets updated information that you are here, now, and not in immediate danger.",
    },
    {
        title: "Release one area of tension",
        icon: Sparkles,
        time: "40 seconds",
        steps: [
            "Choose your jaw, shoulders, hands, or stomach.",
            "Tense that area gently for 3 seconds.",
            "Release it fully and notice the difference.",
        ],
        whyItWorks:
            "Stress often stays trapped in the body. Releasing one muscle group can quickly lower the sense of internal alarm.",
    },
];

const NervousSystemResetArticle = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background text-text-primary transition-colors duration-300">
            <Header />

            <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
                <section className="overflow-hidden rounded-[32px] border border-border/50 bg-gradient-to-br from-[#F5F3FF] via-white to-[#ECFEFF] shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
                    <div className="grid gap-8 px-6 py-8 md:grid-cols-[1.2fr_0.8fr] md:px-10 md:py-10">
                        <div>
                            <button
                                type="button"
                                onClick={() => navigate(-1)}
                                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-white px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:text-primary"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </button>

                            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                                <Brain className="h-4 w-4" />
                                Quick nervous system reset
                            </div>

                            <h1 className="mt-4 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
                                How to reset your nervous system in 2 minutes
                            </h1>

                            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                                When your body feels overstimulated, shaky, or flooded, you do not always need a long break. Sometimes you need a short sequence that helps your system feel safer, steadier, and more regulated.
                            </p>

                            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5">
                                    <Clock className="h-4 w-4 text-primary" />
                                    3 min read
                                </span>
                                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                    Fast reset for stressful moments
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center justify-center rounded-[28px] bg-white/80 p-6">
                            <img
                                src="https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&w=900&q=80"
                                alt="A calming moment for nervous system regulation"
                                className="h-full max-h-[320px] w-full rounded-[24px] object-cover"
                            />
                        </div>
                    </div>
                </section>

                <section className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
                    <article className="rounded-[28px] border border-border/50 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)] sm:p-8">
                        <p className="text-sm leading-7 text-slate-600">
                            Your nervous system is always scanning for safety. When you are overwhelmed by messages, deadlines, conflict, or too much stimulation, your body may switch into protection mode. That can feel like restlessness, shallow breathing, racing thoughts, or the urge to shut down.
                        </p>

                        <p className="mt-4 text-sm leading-7 text-slate-600">
                            A reset does not erase stress. It gives your body enough support to move from alarm toward steadiness. The three steps below are designed to be short enough for real life: before class, after a difficult text, between meetings, or during a crowded commute.
                        </p>

                        <div className="mt-8 space-y-6">
                            {resetSteps.map((step, index) => {
                                const Icon = step.icon;

                                return (
                                    <section key={step.title} className="rounded-[24px] border border-border/50 bg-slate-50 p-5">
                                        <div className="flex flex-wrap items-start justify-between gap-4">
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                                    <Icon className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">
                                                        Reset step {index + 1}
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
                    </article>

                    <aside className="space-y-5">
                        <section className="rounded-[28px] border border-border/50 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                            <h2 className="text-lg font-semibold text-slate-900">When to use this</h2>
                            <ol className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                                <li>1. Before a stressful conversation.</li>
                                <li>2. After doom-scrolling or sensory overload.</li>
                                <li>3. Between tasks when your body still feels activated.</li>
                            </ol>
                        </section>

                        <section className="rounded-[28px] border border-border/50 bg-gradient-to-br from-primary/8 to-cyan-50 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                            <h2 className="text-lg font-semibold text-slate-900">Keep it simple</h2>
                            <p className="mt-3 text-sm leading-7 text-slate-600">
                                The most effective reset is the one you will actually use. Small regulation habits repeated often can be more powerful than perfect routines you never reach.
                            </p>
                        </section>

                        <section className="rounded-[28px] border border-border/50 bg-slate-900 p-6 text-white shadow-[0_18px_40px_rgba(15,23,42,0.14)]">
                            <h2 className="text-lg font-semibold">Explore more resources</h2>
                            <p className="mt-3 text-sm leading-7 text-slate-300">
                                Open the resource library for more grounding exercises, calming guides, and evidence-based emotional tools.
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

export default NervousSystemResetArticle;