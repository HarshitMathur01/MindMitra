import { FadeUp } from "@/components/layout/FadeUp";
import { Eyebrow } from "@/components/layout/Eyebrow";

const pillars = [
  {
    kicker: "01 — talk",
    title: "A voice that stays with you.",
    body:
      "Open Mitra between classes, at 2am, or on the walk back to the hostel. She picks up the thread — exam noise, family pressure, loneliness — in Hindi, English, or Hinglish.",
  },
  {
    kicker: "02 — reset",
    title: "Two-minute tools when your body says no.",
    body:
      "Mind Gym is not therapy — short breathing, grounding, and reframing you can finish between bells. For the spiral, not the spreadsheet.",
  },
  {
    kicker: "03 — bridge",
    title: "Humans when you want a person in the room.",
    body:
      "Therapist Bridge matches you with vetted counsellors. They get a careful summary — not raw chat — so session one skips the cold start.",
  },
];

const HowItWorks = () => {
  return (
    <section
      id="how-it-works"
      className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6 sm:py-16 md:px-8 md:py-20 lg:py-24"
    >
      <FadeUp className="max-w-[60ch]">
        <Eyebrow>three moves</Eyebrow>
        <h2 className="qc-display mt-3 text-3xl sm:text-4xl md:text-5xl text-[color:var(--qc-ink)]">
          Built for loud semesters — not a clinic waiting room.
        </h2>
        <p className="mt-5 sm:mt-6 max-w-[52ch] text-base leading-[1.65] text-[color:var(--qc-ink-soft)]">
          MindMitra is the zero-th layer: think out loud, return tomorrow, escalate only when you choose.
          No streaks. No scores. No pretending you are "fine."
        </p>
      </FadeUp>

      <ul className="mt-12 sm:mt-16 md:mt-20 divide-y divide-[color:var(--qc-border)]">
        {pillars.map((p, i) => (
          <li key={p.kicker}>
            <FadeUp delay={i * 60}>
              <article className="grid gap-6 py-10 sm:py-12 md:grid-cols-[14ch_1fr] md:gap-16 md:py-16">
                <p className="qc-eyebrow pt-2">{p.kicker}</p>
                <div className="max-w-[60ch]">
                  <h3 className="qc-display text-xl sm:text-2xl md:text-3xl text-[color:var(--qc-ink)]">
                    {p.title}
                  </h3>
                  <p className="mt-3 sm:mt-4 text-base leading-[1.65] text-[color:var(--qc-ink-soft)]">
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
