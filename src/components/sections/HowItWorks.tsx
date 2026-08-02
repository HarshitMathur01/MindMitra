import { FadeUp } from "@/components/layout/FadeUp";
import { Eyebrow } from "@/components/layout/Eyebrow";

const pillars = [
  {
    kicker: "01 — companion",
    title: "talk things through, anytime.",
    body:
      "a continuous conversation that picks up where you left off. mitra notices patterns and remembers the small things, so you don't have to start from scratch.",
  },
  {
    kicker: "02 — mind gym",
    title: "short, research-backed exercises.",
    body:
      "two-minute breathing, grounding, and reframing tools you actually finish. built around the moments stress shows up, not a clinical schedule.",
  },
  {
    kicker: "03 — therapist bridge",
    title: "when a person makes more sense.",
    body:
      "connect with vetted therapists. they receive a clean, bias-free summary of how you've been — never raw chat — so the first session starts further along.",
  },
];

const HowItWorks = () => {
  return (
    <section
      id="how-it-works"
      className="mx-auto max-w-[1200px] px-6 py-16 sm:px-8 sm:py-24"
    >
      <FadeUp className="max-w-[60ch]">
        <Eyebrow>how it holds you</Eyebrow>
        <h2 className="qc-display mt-3 text-4xl text-[color:var(--qc-ink)] sm:text-5xl">
          three things, kept simple on purpose.
        </h2>
        <p className="mt-6 max-w-[52ch] text-base leading-[1.6] text-[color:var(--qc-ink-soft)]">
          most apps stack features. mindmitra is built around the few moments
          that matter: the late-night spiral, the ten quiet minutes between
          classes, the day you decide it's time to talk to someone.
        </p>
      </FadeUp>

      <ul className="mt-16 divide-y divide-[color:var(--qc-border)] sm:mt-20">
        {pillars.map((p, i) => (
          <li key={p.kicker}>
            <FadeUp delay={i * 60}>
              <article className="grid gap-6 py-12 sm:grid-cols-[14ch_1fr] sm:gap-16 sm:py-16">
                <p className="qc-eyebrow pt-2">{p.kicker}</p>
                <div className="max-w-[60ch]">
                  <h3 className="qc-display text-2xl text-[color:var(--qc-ink)] sm:text-3xl">
                    {p.title}
                  </h3>
                  <p className="mt-4 text-base leading-[1.6] text-[color:var(--qc-ink-soft)]">
                    {p.body}
                  </p>
                </div>
              </article>
            </FadeUp>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default HowItWorks;
