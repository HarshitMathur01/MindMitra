import { FadeUp } from "@/components/layout/FadeUp";
import { Eyebrow } from "@/components/layout/Eyebrow";

const voices = [
  {
    quote:
      "it remembered what i messaged last week. small thing, huge relief — i didn’t have to re-explain my family thing.",
    attribution: "priya, second-year undergrad",
  },
  {
    quote:
      "2am before internals i used to spiral on reels. now i dump it in hinglish and actually sleep.",
    attribution: "arjun, final year",
  },
  {
    quote:
      "booking a therapist felt huge, but she already knew the shape of my month — not my raw chats, just the truth of it.",
    attribution: "sneha, pg student",
  },
];

const TestimonialCarousel = () => {
  return (
    <section
      id="about"
      className="mx-auto max-w-[1200px] px-6 py-16 sm:px-8 sm:py-24"
    >
      <FadeUp className="max-w-[60ch]">
        <Eyebrow>real voices</Eyebrow>
        <h2 className="qc-display mt-3 text-4xl text-[color:var(--qc-ink)] sm:text-5xl">
          Quiet wins from people like you.
        </h2>
      </FadeUp>

      <ul className="mt-14 space-y-12 sm:mt-20 sm:space-y-16">
        {voices.map((v, i) => (
          <li key={v.attribution}>
            <FadeUp delay={i * 60}>
              <article className="grid gap-4 border-b border-[color:var(--qc-border)] pb-12 last:border-b-0 last:pb-0 sm:grid-cols-[8ch_1fr] sm:gap-12 sm:pb-16">
                <span className="qc-eyebrow tabular-nums sm:pt-2">
                  0{i + 1}
                </span>
                <div className="max-w-[60ch]">
                  <p className="qc-display mitra-voice text-balance text-2xl leading-snug text-[color:var(--qc-ink)] sm:text-3xl">
                    &ldquo;{v.quote}&rdquo;
                  </p>
                  <p className="mt-5 text-sm text-[color:var(--qc-ink-muted)]">
                    — {v.attribution}
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

export default TestimonialCarousel;
