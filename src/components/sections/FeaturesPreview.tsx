import { FadeUp } from "@/components/layout/FadeUp";
import { Eyebrow } from "@/components/layout/Eyebrow";
import { WatercolorScene } from "@/components/layout/WatercolorScene";

const lines = [
  "chal, ek minute — kya ab bhi wahi assignment dimaag mein atki hai?",
  "we can sit in English, Hindi, or mix — whatever is easiest right now.",
  "want a tiny reset, or just stay in the mess with me for a bit?",
  "no rush. i’m here when you ping again.",
];

const FeaturesPreview = () => {
  return (
    <section
      id="features"
      className="relative mx-auto max-w-[1200px] px-6 py-16 sm:px-8 sm:py-24"
    >
      <div className="grid gap-16 lg:grid-cols-[6fr_4fr] lg:items-center">
        <FadeUp className="max-w-[60ch]">
          <Eyebrow>tone check</Eyebrow>
          <h2 className="qc-display mt-3 text-4xl text-[color:var(--qc-ink)] sm:text-5xl">
            Sounds like a person, not a dashboard.
          </h2>
          <p className="mt-6 max-w-[52ch] text-base leading-[1.65] text-[color:var(--qc-ink-soft)]">
            Mitra adapts to how you text — direct when you need clarity, softer when you are raw.
            Crisis lines stay human-written; the rest is conversation.
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
