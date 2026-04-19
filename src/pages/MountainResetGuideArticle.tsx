import { useMemo } from "react";
import { ExternalLink, Mountain, Sparkles, Trees, Wind } from "lucide-react";
import {
    ArticleLayout,
    ArticleLead,
    ArticleSideCard,
    ArticleStepCard,
} from "@/components/resources/ArticleLayout";
import { makeArticleStepId } from "@/components/resources/ArticleReadingEnhancements";

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

const REF_ID = "mountain-references";

const MountainResetGuideArticle = () => {
    const tocItems = useMemo(() => {
        const steps = guideSteps.map((r, i) => ({
            id: makeArticleStepId("mountain", i, r.title),
            label: `${i + 1}. ${r.title.length > 36 ? `${r.title.slice(0, 34)}…` : r.title}`,
        }));
        return [...steps, { id: REF_ID, label: "References" }];
    }, []);

    return (
        <ArticleLayout
            eyebrow={{ icon: Mountain, label: "Nature grounding" }}
            title="Mountain reset for a calmer mind"
            intro="When your thoughts feel loud or your body feels overstretched, a mountain-based visual reset can help you widen your attention, slow your breathing, and reconnect with a steadier inner pace."
            readLabel="4 min read"
            meta={[{ icon: Sparkles, label: "Grounding, breath, and visual calm" }]}
            heroAccent="⛰️"
            tocItems={tocItems}
            sidebar={
                <>
                    <ArticleSideCard title="Try this in 3 minutes">
                        <ol className="space-y-2.5">
                            <li>1. Look at a mountain or landscape image.</li>
                            <li>2. Take 5 breaths with a longer exhale.</li>
                            <li>3. Name 3 steady things around you.</li>
                        </ol>
                    </ArticleSideCard>
                    <ArticleSideCard title="Helpful reminder" tone="warm">
                        Calm does not have to arrive all at once. If this guide helps you feel even 5% more settled, that is a meaningful shift.
                    </ArticleSideCard>
                </>
            }
        >
            <ArticleLead>
                Sometimes the mind settles faster when attention moves away from pressure and toward something wider, quieter, and more stable. Mountains can work well for this because they naturally suggest steadiness. Even if you are indoors, looking at a mountain photo or any distant landscape can create a brief pause from mental overdrive.
            </ArticleLead>
            <p className="mt-4 text-[14.5px] leading-[1.75] text-ink-6">
                This reset is not about forcing yourself to feel better instantly. It is about giving your nervous system a simpler job for a few minutes: look, breathe, and notice what is steady. That combination can help reduce overwhelm and create a small pocket of calm.
            </p>

            <div className="mt-8 space-y-5">
                {guideSteps.map((step, index) => (
                    <ArticleStepCard
                        key={step.title}
                        id={tocItems[index]?.id}
                        index={index}
                        eyebrow="Reset step"
                        title={step.title}
                        time={step.time}
                        icon={step.icon}
                        steps={step.steps}
                        whyItWorks={step.whyItWorks}
                    />
                ))}
            </div>

            <section id={REF_ID} className="mt-8 scroll-mt-28 rounded-2xl border border-ink-3/25 bg-muted/40 p-5">
                <h2 className="text-base font-semibold text-ink-8">References</h2>
                <p className="mt-2 text-[13.5px] leading-[1.7] text-ink-6">
                    These sources support the grounding, relaxation, and nature-based calming ideas used in this guide.
                </p>
                <ul className="mt-4 space-y-2.5">
                    {references.map((reference) => (
                        <li key={reference.href}>
                            <a
                                href={reference.href}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-start gap-2 text-[13.5px] font-medium text-[hsl(var(--accent-600))] transition-colors hover:text-[hsl(var(--accent-700))] dark:text-[hsl(var(--accent-400))]"
                            >
                                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span>{reference.label}</span>
                            </a>
                        </li>
                    ))}
                </ul>
            </section>
        </ArticleLayout>
    );
};

export default MountainResetGuideArticle;
