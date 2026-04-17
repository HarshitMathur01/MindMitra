import { motion } from "framer-motion";
import { SectionMarker } from "@/components/ui/section-marker";
import { NumberTicker } from "@/components/ui/number-ticker";
import { duration, ease } from "@/lib/motion";

const stats = [
  {
    num: "01",
    value: 1250,
    suffix: "+",
    label: "Students held",
    detail: "young minds finding words for what they feel",
  },
  {
    num: "02",
    value: 5240,
    suffix: "+",
    label: "Sessions completed",
    detail: "honest conversations, no scripts, no judgement",
  },
  {
    num: "03",
    value: 89,
    suffix: "%",
    label: "Feel steadier",
    detail: "report reduced distress within four sessions",
  },
  {
    num: "04",
    value: 98,
    suffix: "%",
    label: "Would return",
    detail: "trust the loop enough to come back again",
  },
];

const StatsSection = () => {
  return (
    <section className="relative border-y border-ink-3 bg-ink-1 py-24 md:py-32">
      <div className="mx-auto max-w-page px-gutter">
        <div className="grid gap-10 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-5">
            <SectionMarker num="03" label="The quiet proof" />
            <h2 className="mt-6 font-display text-[clamp(32px,4vw,56px)] font-medium leading-[1.04] tracking-tighter-2 text-ink-9">
              Evidence,
              <br />
              <span className="italic text-[hsl(var(--accent-500))]">
                not promises.
              </span>
            </h2>
          </div>
          <div className="md:col-span-6 md:col-start-7 md:pt-12">
            <p className="max-w-prose text-[16px] leading-[1.65] text-ink-6">
              Numbers we track because they answer the only question that
              matters: <em>does this actually help?</em> Reviewed quarterly
              with our clinical advisors.
            </p>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 divide-y divide-ink-3 border-y border-ink-3 md:grid-cols-4 md:divide-x md:divide-y-0">
          {stats.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: duration.long,
                ease: ease.outExpo,
                delay: i * 0.06,
              }}
              className="flex flex-col gap-3 px-0 py-8 first:pl-0 md:px-7"
            >
              <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-5">
                {s.num}
              </div>
              <div className="flex items-baseline gap-1 text-ink-9">
                <NumberTicker
                  value={s.value}
                  className="font-display text-[clamp(44px,6vw,72px)] font-medium leading-none tracking-tighter-2 text-ink-9"
                />
                <span className="font-display text-[clamp(24px,3vw,36px)] text-[hsl(var(--accent-500))]">
                  {s.suffix}
                </span>
              </div>
              <div className="mt-1 text-[15px] font-medium text-ink-8">
                {s.label}
              </div>
              <div className="text-caption leading-relaxed text-ink-6">
                {s.detail}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <p className="max-w-xl text-[15px] leading-relaxed text-ink-6">
            Self-reported across 2025–26 beta cohorts. Methodology and raw
            aggregates available on request — we take measurement as
            seriously as the conversations we hold.
          </p>
          <a
            href="mailto:research@mindmitra.app"
            className="group inline-flex items-center gap-1.5 border-b border-ink-4 pb-1 text-[13.5px] font-medium text-ink-8 transition-colors hover:border-ink-8"
          >
            Request the methodology note
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </a>
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
