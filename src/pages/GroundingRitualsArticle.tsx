import { useMemo } from "react";
import { Flower2, Sparkles, Wind } from "lucide-react";
import {
    ArticleLayout,
    ArticleLead,
    ArticleSideCard,
    ArticleStepCard,
} from "@/components/resources/ArticleLayout";
import { makeArticleStepId } from "@/components/resources/ArticleReadingEnhancements";

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
    const tocItems = useMemo(
        () =>
            rituals.map((r, i) => ({
                id: makeArticleStepId("grounding", i, r.title),
                label: `${i + 1}. ${r.title.length > 40 ? `${r.title.slice(0, 38)}…` : r.title}`,
            })),
        [],
    );

    return (
        <ArticleLayout
            eyebrow={{ icon: Flower2, label: "Morning grounding" }}
            title="3 grounding rituals for busy mornings"
            intro="If your mornings feel like a sprint before your mind has even fully arrived, these tiny rituals can help you feel calmer, clearer, and more present in under three minutes."
            readLabel="4 min read"
            meta={[{ icon: Sparkles, label: "Gentle and beginner-friendly" }]}
            heroAccent="🌅"
            tocItems={tocItems}
            sidebar={
                <>
                    <ArticleSideCard title="Try the 2-minute version">
                        <ol className="space-y-2.5">
                            <li>1. Name 3 things you can see.</li>
                            <li>2. Take 5 slow breaths with a longer exhale.</li>
                            <li>3. Repeat one kind sentence to yourself.</li>
                        </ol>
                    </ArticleSideCard>
                    <ArticleSideCard title="A helpful reminder" tone="warm">
                        Grounding is not about doing more before work, study, or caregiving. It is about meeting yourself kindly before the world asks things from you.
                    </ArticleSideCard>
                </>
            }
        >
            <ArticleLead>
                Busy mornings often push the body into urgency before the day has properly begun. You wake up, check notifications, think about unfinished tasks, and suddenly your breathing gets shallow and your attention scatters. Grounding rituals work because they bring you back into the body and into the current moment.
            </ArticleLead>
            <p className="mt-4 text-[14.5px] leading-[1.75] text-ink-6">
                The goal is not to create a perfect wellness routine. The goal is to create a brief pause between waking up and reacting. Even one grounded minute can change the emotional tone of the next hour.
            </p>

            <div className="mt-8 space-y-5">
                {rituals.map((ritual, index) => (
                    <ArticleStepCard
                        key={ritual.title}
                        id={tocItems[index]?.id}
                        index={index}
                        eyebrow="Ritual"
                        title={ritual.title}
                        time={ritual.time}
                        icon={ritual.icon}
                        steps={ritual.steps}
                        whyItWorks={ritual.whyItWorks}
                    />
                ))}
            </div>
        </ArticleLayout>
    );
};

export default GroundingRitualsArticle;
