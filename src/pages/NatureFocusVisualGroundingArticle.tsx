import { useMemo } from "react";
import { ExternalLink, Eye, Leaf, Sparkles, Trees } from "lucide-react";
import {
    ArticleLayout,
    ArticleLead,
    ArticleSideCard,
    ArticleStepCard,
} from "@/components/resources/ArticleLayout";
import { makeArticleStepId } from "@/components/resources/ArticleReadingEnhancements";

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

const VISUAL_REF_ID = "visual-references";

const NatureFocusVisualGroundingArticle = () => {
    const tocItems = useMemo(() => {
        const steps = groundingSteps.map((r, i) => ({
            id: makeArticleStepId("visual", i, r.title),
            label: `${i + 1}. ${r.title.length > 36 ? `${r.title.slice(0, 34)}…` : r.title}`,
        }));
        return [...steps, { id: VISUAL_REF_ID, label: "References" }];
    }, []);

    return (
        <ArticleLayout
            eyebrow={{ icon: Eye, label: "Visual grounding" }}
            title="Nature focus: 5-minute visual grounding"
            intro="When your mind feels scattered, visual grounding with nature can help you slow down, widen attention, and reconnect with the present through simple observation instead of mental effort."
            readLabel="5 min practice"
            meta={[{ icon: Sparkles, label: "Calm attention and sensory reset" }]}
            heroAccent="🍃"
            tocItems={tocItems}
            sidebar={
                <>
                    <ArticleSideCard title="Quick version">
                        <ol className="space-y-2.5">
                            <li>1. Look at one calming nature image.</li>
                            <li>2. Name 5 visible details slowly.</li>
                            <li>3. End with 2 slow breaths and one grounding phrase.</li>
                        </ol>
                    </ArticleSideCard>
                    <ArticleSideCard title="Helpful reminder" tone="warm">
                        If your thoughts keep drifting, that is okay. Each gentle return to what you can see is part of the practice.
                    </ArticleSideCard>
                </>
            }
        >
            <ArticleLead>
                Visual grounding works by giving your attention something real, steady, and non-demanding to rest on. Nature scenes are especially helpful because they often contain repeating patterns, soft textures, and a sense of spaciousness that the body can interpret as less threatening than busy, high-stimulation environments.
            </ArticleLead>
            <p className="mt-4 text-[14.5px] leading-[1.75] text-ink-6">
                You do not need to be outside for this to help. A photo of trees, mountains, water, or sky can still provide a useful anchor. The purpose is not to perform mindfulness perfectly. It is to help your mind shift from spiraling thoughts into clear, sensory contact with the present.
            </p>

            <div className="mt-8 space-y-5">
                {groundingSteps.map((step, index) => (
                    <ArticleStepCard
                        key={step.title}
                        id={tocItems[index]?.id}
                        index={index}
                        eyebrow="Grounding step"
                        title={step.title}
                        time={step.time}
                        icon={step.icon}
                        steps={step.steps}
                        whyItWorks={step.whyItWorks}
                    />
                ))}
            </div>

            <section id={VISUAL_REF_ID} className="mt-8 scroll-mt-28 rounded-2xl border border-ink-3/25 bg-muted/40 p-5">
                <h2 className="text-base font-semibold text-ink-8">References</h2>
                <p className="mt-2 text-[13.5px] leading-[1.7] text-ink-6">
                    These sources support the grounding, relaxation, and nature-exposure ideas used in this visual reset.
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

export default NatureFocusVisualGroundingArticle;
