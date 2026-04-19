import { motion } from "framer-motion";
import { MessageCircle, Dumbbell, Stethoscope } from "lucide-react";
import { DURATION, EASE } from "@/lib/redesign/tokens";

/**
 * HowItWorks — the three things MindMitra actually does, drawn from
 * PS_Solution.md ("AI Companion", "MindGym", "Therapist Bridge"). No
 * "Powered by AI" framing; copy emphasizes what the user gets, not
 * the underlying model.
 */

const pillars = [
  {
    icon: MessageCircle,
    kicker: "01 — Companion",
    title: "Talk things through, anytime.",
    body:
      "A continuous conversation that picks up where you left off. Mitra notices patterns and remembers the small things, so you don't have to start from scratch.",
  },
  {
    icon: Dumbbell,
    kicker: "02 — Mind Gym",
    title: "Short, research-backed exercises.",
    body:
      "Two-minute breathing, grounding, and reframing tools you actually finish. Built around the moments stress shows up, not a clinical schedule.",
  },
  {
    icon: Stethoscope,
    kicker: "03 — Therapist Bridge",
    title: "When a person makes more sense.",
    body:
      "Connect with vetted therapists. They receive a clean, bias-free summary of how you've been — never raw chat — so the first session starts further along.",
  },
];

const HowItWorks = () => {
  return (
    <section
      id="how-it-works"
      className="relative py-20 sm:py-28"
    >
      <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: DURATION.long, ease: EASE.outExpo }}
          className="max-w-2xl"
        >
          <span className="quiet-label">How it holds you</span>
          <h2 className="mt-4 font-display text-balance text-3xl tracking-tight text-foreground sm:text-4xl">
            Three things, kept simple on purpose.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            Most apps stack features. MindMitra is built around the few moments
            that matter: the late-night spiral, the ten quiet minutes between
            classes, the day you decide it's time to talk to someone.
          </p>
        </motion.div>

        <ul className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border/40 bg-border/40 sm:grid-cols-3">
          {pillars.map((p, i) => (
            <motion.li
              key={p.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{
                duration: DURATION.long,
                delay: i * 0.08,
                ease: EASE.outExpo,
              }}
              className="bg-background p-7 sm:p-8"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--accent-100))] text-[hsl(var(--accent-600))]">
                <p.icon className="h-5 w-5" strokeWidth={1.6} />
              </div>
              <p className="mt-6 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {p.kicker}
              </p>
              <h3 className="mt-2 font-display text-lg text-foreground">
                {p.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {p.body}
              </p>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default HowItWorks;
