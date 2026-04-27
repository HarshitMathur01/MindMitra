import { FadeUp } from "@/components/layout/FadeUp";
import { Eyebrow } from "@/components/layout/Eyebrow";

/**
 * Component name kept as `TestimonialCarousel` to preserve the
 * import path used by `PublicLanding.tsx`. Despite the legacy name,
 * there is no carousel here — the design language rejects them.
 * Three quiet voices, stacked typographically.
 */

const voices = [
  {
    quote:
      "it actually remembered what i told it last week. that sounds small but i've never had that with an app.",
    attribution: "priya, second-year undergrad",
  },
  {
    quote:
      "i open it at 2am instead of doom-scrolling. within ten minutes my chest feels less tight.",
    attribution: "arjun, first job",
  },
  {
    quote:
      "when i finally booked a counsellor through mindmitra, she already knew the shape of my month. we skipped the awkward part.",
    attribution: "sneha, graduate student",
  },
];

const TestimonialCarousel = () => {
  return (
    <section
      id="about"
      className="mx-auto max-w-[1200px] px-6 py-16 sm:px-8 sm:py-24"
    >
      <FadeUp className="max-w-[60ch]">
        <Eyebrow>in your words</Eyebrow>
        <h2 className="qc-display mt-3 text-4xl text-[color:var(--qc-ink)] sm:text-5xl">
          quiet wins, mostly.
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
