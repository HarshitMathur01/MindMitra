import { motion } from "framer-motion";
import { Wind } from "lucide-react";
import Pulse from "@/components/identity/Pulse";
import { DURATION, EASE } from "@/lib/redesign/tokens";

/**
 * FeaturesPreview — replaced with a single "Live preview" strip:
 * a static chat snippet on the left, an animated breath demo on the
 * right. Token-driven; no extra deps; respects reduced motion via
 * the global CSS rule.
 */

const conversation = [
  {
    role: "mitra" as const,
    text:
      "It's been a while. Last we spoke, exams were the thing on your mind — how did the week land?",
  },
  {
    role: "you" as const,
    text:
      "Honestly bad. I keep waking up at 4am and thinking about the chemistry paper.",
  },
  {
    role: "mitra" as const,
    text:
      "That early-morning loop is exhausting. Want to try a two-minute breath together, or first say more about what 4am feels like?",
  },
];

const FeaturesPreview = () => {
  return (
    <section
      id="features"
      className="relative bg-[hsl(var(--ink-1))] py-20 sm:py-28"
    >
      <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: DURATION.long, ease: EASE.outExpo }}
          className="max-w-2xl"
        >
          <span className="quiet-label">A live look</span>
          <h2 className="mt-4 font-display text-balance text-3xl tracking-tight text-foreground sm:text-4xl">
            What it actually feels like.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            Two surfaces you'll use most: a continuous conversation that
            remembers, and small in-the-moment rituals you can finish in two
            minutes.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-6 lg:grid-cols-5">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: DURATION.long, ease: EASE.outExpo }}
            className="rounded-3xl border border-border/40 bg-background p-6 sm:p-8 lg:col-span-3"
          >
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--accent-100))]">
                  <img src="/image.png" alt="" className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Mitra</p>
                  <p className="text-xs text-muted-foreground">
                    Continuous conversation
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-[hsl(var(--accent-100))] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--accent-600))]">
                Today
              </span>
            </div>

            <ul className="space-y-3">
              {conversation.map((m, i) =>
                m.role === "mitra" ? (
                  <li key={i} className="flex items-start gap-3">
                    <div className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-[hsl(var(--accent-100))]" />
                    <div className="max-w-[88%] rounded-2xl rounded-tl-md bg-[hsl(var(--ink-2))] px-4 py-3 text-sm leading-relaxed text-foreground">
                      {m.text}
                    </div>
                  </li>
                ) : (
                  <li key={i} className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground">
                      {m.text}
                    </div>
                  </li>
                ),
              )}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{
              duration: DURATION.long,
              delay: 0.08,
              ease: EASE.outExpo,
            }}
            className="relative flex flex-col items-center justify-between gap-6 overflow-hidden rounded-3xl border border-border/40 bg-background p-8 lg:col-span-2"
          >
            <div className="flex w-full items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Wind className="h-3.5 w-3.5" />
              Two-minute breath
            </div>

            <div className="relative flex flex-1 items-center justify-center py-4">
              <Pulse size={180} state="listening" intensity={0.95} />
            </div>

            <div className="w-full text-center">
              <p className="font-display text-base text-foreground">
                Inhale 4 — hold 2 — exhale 6.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Resonant breathing, six cycles per minute.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default FeaturesPreview;
