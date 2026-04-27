import { Eyebrow } from "@/components/layout/Eyebrow";
import { FadeUp } from "@/components/layout/FadeUp";
import { HeroIllustration } from "./HeroIllustration";

export function Hero({ onProfile, onFind }: { onProfile: () => void; onFind: () => void }) {
  return (
    <section className="relative overflow-hidden">
      <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-6 py-20 sm:px-8 sm:py-28 md:grid-cols-[3fr_2fr]">
        <FadeUp>
          <Eyebrow>A gentle bridge</Eyebrow>
          <h1 className="qc-display mt-6 text-5xl text-[#2D2A24] sm:text-6xl">
            Find someone who truly listens.
          </h1>
          <p className="mt-7 max-w-[60ch] text-[17px] leading-[1.6] text-[#4A4640]">
            When you're ready, we'll help you meet a therapist who feels like a good fit.
            You stay in control of what's shared — nothing leaves your hands without you.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={onProfile}
              className="inline-flex items-center justify-center rounded-full bg-[#3F6B47] px-7 py-3.5 text-[14px] font-medium text-[#F5EDE0] transition-[transform,filter] duration-200 ease-out hover:-translate-y-px hover:brightness-[0.92] motion-reduce:hover:transform-none motion-reduce:transition-none"
            >
              See how you've been feeling
            </button>
            <button
              type="button"
              onClick={onFind}
              className="inline-flex items-center justify-center rounded-full border border-[#2D2A24] bg-transparent px-7 py-3.5 text-[14px] font-medium text-[#2D2A24] transition-[transform,background-color] duration-200 ease-out hover:-translate-y-px hover:bg-[#2D2A2408] motion-reduce:hover:transform-none motion-reduce:transition-none"
            >
              Meet someone who fits
            </button>
          </div>
        </FadeUp>
        <FadeUp delay={120} className="relative hidden md:block">
          <div className="relative mx-auto aspect-square w-full max-w-[460px]">
            <HeroIllustration />
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
