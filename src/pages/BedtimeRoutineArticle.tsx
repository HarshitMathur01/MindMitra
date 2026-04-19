import { useMemo } from "react";
import { MoonStar, Sparkles, Stars, Wind } from "lucide-react";
import {
    ArticleLayout,
    ArticleLead,
    ArticleSideCard,
    ArticleStepCard,
} from "@/components/resources/ArticleLayout";
import { makeArticleStepId } from "@/components/resources/ArticleReadingEnhancements";

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
    const tocItems = useMemo(
        () =>
            bedtimeSteps.map((r, i) => ({
                id: makeArticleStepId("bedtime", i, r.title),
                label: `${i + 1}. ${r.title.length > 40 ? `${r.title.slice(0, 38)}…` : r.title}`,
            })),
        [],
    );

    return (
        <ArticleLayout
            eyebrow={{ icon: Stars, label: "Evening routine" }}
            title="A calming bedtime routine for deep rest"
            intro="Rest starts before your head touches the pillow. A gentle night routine can help your body feel safe enough to slow down, so sleep feels more inviting and less like a struggle."
            readLabel="4 min read"
            meta={[{ icon: Sparkles, label: "Gentle evening reset" }]}
            heroAccent="🌙"
            tocItems={tocItems}
            sidebar={
                <>
                    <ArticleSideCard title="A simple order to follow">
                        <ol className="space-y-2.5">
                            <li>1. Dim lights and reduce stimulation.</li>
                            <li>2. Write down tomorrow’s worries and tasks.</li>
                            <li>3. Relax the body before trying to sleep.</li>
                        </ol>
                    </ArticleSideCard>
                    <ArticleSideCard title="Be gentle with yourself" tone="warm">
                        A calming routine is not a performance. If you miss a night or only do one step, it still counts. Consistency grows best in kindness, not pressure.
                    </ArticleSideCard>
                </>
            }
        >
            <ArticleLead>
                Many people try to fall asleep while their body is still carrying the speed of the day. Notifications, unfinished thoughts, emotional conversations, bright screens, and late-night pressure can all keep the nervous system on alert.
            </ArticleLead>
            <p className="mt-4 text-[14.5px] leading-[1.75] text-ink-6">
                A bedtime routine helps by creating a bridge between activity and rest. It does not need to be elaborate. It just needs to send a clear message: the day is ending, and you are allowed to soften.
            </p>

            <div className="mt-8 space-y-5">
                {bedtimeSteps.map((step, index) => (
                    <ArticleStepCard
                        key={step.title}
                        id={tocItems[index]?.id}
                        index={index}
                        eyebrow="Bedtime step"
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

export default BedtimeRoutineArticle;
