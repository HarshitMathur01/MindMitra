import { useNavigate } from "react-router-dom";
import { FadeUp } from "@/components/layout/FadeUp";
import { WatercolorScene } from "@/components/layout/WatercolorScene";

const CTABanner = () => {
  const navigate = useNavigate();

  return (
    <section className="relative mx-auto max-w-[1200px] px-6 pb-16 pt-8 text-center sm:px-8 sm:pb-24">
      <FadeUp className="mx-auto max-w-[60ch]">
        <div aria-hidden className="mx-auto mb-10 max-w-[280px] opacity-90">
          <WatercolorScene name="solitude" maxRenderedWidth={480} />
        </div>

        <h2 className="qc-display text-3xl text-[color:var(--qc-ink)] sm:text-[2.5rem] sm:leading-[1.1]">
          One honest sentence is enough.
        </h2>
        <p className="mx-auto mt-5 max-w-[44ch] text-base leading-[1.65] text-[color:var(--qc-ink-soft)]">
          Tell Mitra what is loudest today. She won&apos;t rush you to solutions — sometimes
          being heard is the first reset.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => navigate("/auth")}
            className="qc-pill-primary min-h-[48px] min-w-[200px] px-8"
          >
            Create your space
          </button>
          <button
            type="button"
            onClick={() => navigate("/psychological-content")}
            className="qc-pill-outline min-h-[48px] min-w-[200px] px-8"
          >
            Browse resources
          </button>
        </div>
      </FadeUp>

      <FadeUp delay={120} className="mx-auto mt-20 max-w-[60ch]">
        <p className="text-left text-sm leading-[1.7] text-[color:var(--qc-ink-soft)]">
          <span className="qc-display text-[color:var(--qc-ink)]">
            if you are in crisis right now:
          </span>{" "}
          iCall{" "}
          <a
            className="underline decoration-[color:var(--qc-border-stronger)] underline-offset-4 hover:decoration-[color:var(--qc-forest)]"
            href="tel:9152987821"
          >
            9152&nbsp;987&nbsp;821
          </a>
          , Vandrevala Foundation{" "}
          <a
            className="underline decoration-[color:var(--qc-border-stronger)] underline-offset-4 hover:decoration-[color:var(--qc-forest)]"
            href="tel:18602662345"
          >
            1860&nbsp;2662&nbsp;345
          </a>
          , AASRA{" "}
          <a
            className="underline decoration-[color:var(--qc-border-stronger)] underline-offset-4 hover:decoration-[color:var(--qc-forest)]"
            href="tel:9820466726"
          >
            9820&nbsp;466&nbsp;726
          </a>
          . call any time.
        </p>
      </FadeUp>
    </section>
  );
};

export default CTABanner;
