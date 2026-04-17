import { ArrowUpRight, MessageCircle, Leaf, HandHelping } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { duration, ease } from "@/lib/motion";

type Offering = {
  kicker: string;
  title: string;
  description: string;
  cta: string;
  path: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};

const offerings: Offering[] = [
  {
    kicker: "When you want to talk",
    title: "A quiet conversation, whenever",
    description:
      "Tell it what's on your mind — in whatever shape it's in. No prompts to fill, no tone to perform.",
    cta: "Start a conversation",
    path: "/chat",
    icon: MessageCircle,
  },
  {
    kicker: "When your body is tense",
    title: "Small practices that settle you",
    description:
      "Breathing, grounding, and short reflections for the moments where your thoughts are moving too fast.",
    cta: "Try a 2-minute practice",
    path: "/wellness-checkin",
    icon: Leaf,
  },
  {
    kicker: "When you want a person",
    title: "A warm hand-off to a therapist",
    description:
      "When and if you're ready, we can connect you with a real clinician — someone who speaks your language, on your terms.",
    cta: "See how it works",
    path: "/therapist-bridge",
    icon: HandHelping,
  },
];

const FeaturesPreview = () => {
  const navigate = useNavigate();

  return (
    <section className="relative py-28 md:py-36">
      <div className="mx-auto max-w-3xl px-gutter">
        <div className="text-center">
          <span className="text-[13.5px] text-ink-6">a few things that help</span>
          <h2 className="mt-4 font-display text-[clamp(28px,3.6vw,44px)] font-normal leading-[1.2] tracking-tight-1 text-ink-8">
            You don't have to use all of it.
            <br />
            <span className="font-display-soft text-[hsl(var(--accent-600))]">
              Take what feels useful today.
            </span>
          </h2>
        </div>

        <div className="mt-20 flex flex-col gap-5">
          {offerings.map((o, i) => {
            const Icon = o.icon;
            return (
              <motion.button
                key={o.title}
                type="button"
                onClick={() => navigate(o.path)}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: duration.long,
                  ease: ease.outExpo,
                  delay: i * 0.06,
                }}
                className="group relative w-full rounded-[28px] bg-[hsl(var(--ink-1))] px-7 py-8 text-left transition-colors duration-base ease-out-expo hover:bg-[hsl(var(--ink-2))] md:px-10 md:py-10"
              >
                <div className="flex items-start gap-6">
                  <span
                    aria-hidden
                    className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--accent-100))] text-[hsl(var(--accent-700))]"
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.6} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-ink-5">{o.kicker}</div>
                    <h3 className="mt-1.5 font-display text-[22px] font-normal leading-[1.3] tracking-tight-1 text-ink-8 md:text-[26px]">
                      {o.title}
                    </h3>
                    <p className="mt-3 max-w-xl text-[15.5px] leading-[1.7] text-ink-6">
                      {o.description}
                    </p>
                    <span className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium text-[hsl(var(--accent-600))] transition-colors group-hover:text-[hsl(var(--accent-700))]">
                      {o.cta}
                      <ArrowUpRight className="h-4 w-4" strokeWidth={1.6} />
                    </span>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturesPreview;
