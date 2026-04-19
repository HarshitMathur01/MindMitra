import { useMemo } from "react";
import { Brain, Sparkles, Wind } from "lucide-react";
import {
    ArticleLayout,
    ArticleLead,
    ArticleSideCard,
    ArticleStepCard,
} from "@/components/resources/ArticleLayout";
import { makeArticleStepId } from "@/components/resources/ArticleReadingEnhancements";

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
    const tocItems = useMemo(
        () =>
            resetSteps.map((r, i) => ({
                id: makeArticleStepId("nervous", i, r.title),
                label: `${i + 1}. ${r.title.length > 40 ? `${r.title.slice(0, 38)}…` : r.title}`,
            })),
        [],
    );

    return (
        <ArticleLayout
            eyebrow={{ icon: Brain, label: "Quick regulation" }}
            title="How to reset your nervous system in 2 minutes"
            intro="When your body feels overstimulated, shaky, or flooded, you do not always need a long break. Sometimes you need a short sequence that helps your system feel safer, steadier, and more regulated."
            readLabel="3 min read"
            meta={[{ icon: Sparkles, label: "Fast reset for stressful moments" }]}
            heroAccent="🌿"
            tocItems={tocItems}
            sidebar={
                <>
                    <ArticleSideCard title="When to use this">
                        <ol className="space-y-2.5">
                            <li>1. Before a stressful conversation.</li>
                            <li>2. After doom-scrolling or sensory overload.</li>
                            <li>3. Between tasks when your body still feels activated.</li>
                        </ol>
                    </ArticleSideCard>
                    <ArticleSideCard title="Keep it simple" tone="warm">
                        The most effective reset is the one you will actually use. Small regulation habits repeated often can be more powerful than perfect routines you never reach.
                    </ArticleSideCard>
                </>
            }
        >
            <ArticleLead>
                Your nervous system is always scanning for safety. When you are overwhelmed by messages, deadlines, conflict, or too much stimulation, your body may switch into protection mode. That can feel like restlessness, shallow breathing, racing thoughts, or the urge to shut down.
            </ArticleLead>
            <p className="mt-4 text-[14.5px] leading-[1.75] text-ink-6">
                A reset does not erase stress. It gives your body enough support to move from alarm toward steadiness. The three steps below are designed to be short enough for real life: before class, after a difficult text, between meetings, or during a crowded commute.
            </p>

            <div className="mt-8 space-y-5">
                {resetSteps.map((step, index) => (
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
        </ArticleLayout>
    );
};

export default NervousSystemResetArticle;
