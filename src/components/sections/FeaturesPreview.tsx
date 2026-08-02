import { FadeUp } from "@/components/layout/FadeUp";
import { Eyebrow } from "@/components/layout/Eyebrow";
import { WatercolorScene } from "@/components/layout/WatercolorScene";

/**
 * "What it actually feels like." A single 60ch column of italic
 * Mitra-voice lines separated by hairlines, with a watercolor of
 * the lakeside breath scene grounding the right column on desktop.
 * No floating preview cards, no chat mock — the design language
 * rejects dashboard-flavored marketing tiles.
 */

const lines = [
  "we picked up where we left off, like always.",
  "you said the chemistry paper was the loudest thing in your head — is it still?",
  "want to sit with it for a minute, or try a small breath together?",
  "no rush. i'm here when you are.",
];

const FeaturesPreview = () => {
  return (
    <section
      id="features"
      className="relative mx-auto max-w-[1200px] px-6 py-16 sm:px-8 sm:py-24"
    >
      <div className="grid gap-16 lg:grid-cols-[6fr_4fr] lg:items-center">
        <FadeUp className="max-w-[60ch]">
          <Eyebrow>a live look</Eyebrow>
          <h2 className="qc-display mt-3 text-4xl text-[color:var(--qc-ink)] sm:text-5xl">
            what it actually feels like.
          </h2>
          <p className="mt-6 max-w-[52ch] text-base leading-[1.6] text-[color:var(--qc-ink-soft)]">
            mitra speaks in your conversation, not at you. here's the kind of
            small thing she says — gentle, specific, never urgent.
          </p>

          <ul className="mt-12 space-y-8">
            {lines.map((line, i) => (
              <li
                key={i}
                className="border-b border-[color:var(--qc-border)] pb-8 last:border-b-0 last:pb-0"
              >
                <p className="mitra-voice qc-display text-xl leading-snug text-[color:var(--qc-ink-soft)] sm:text-2xl">
                  {line}
                </p>
              </li>
            ))}
            <li className="pt-2 text-right text-sm text-[color:var(--qc-ink-muted)]">
              — Mitra
            </li>
          </ul>
        </FadeUp>

        <FadeUp delay={120} className="hidden lg:block">
          <WatercolorScene
            name="breath"
            maxRenderedWidth={960}
            className="mx-auto max-w-[460px]"
          />
        </FadeUp>
      </div>
    </section>
  );
};

export default FeaturesPreview;
