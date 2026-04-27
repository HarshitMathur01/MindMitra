import { useNavigate } from "react-router-dom";
import { FadeUp } from "@/components/layout/FadeUp";
import { Eyebrow } from "@/components/layout/Eyebrow";
import { WatercolorScene } from "@/components/layout/WatercolorScene";
import { PeachBlush } from "@/components/layout/PeachBlush";

const WelcomeHero = () => {
  const navigate = useNavigate();

  return (
    <section className="relative isolate overflow-hidden pt-[var(--header-height)]">
      <PeachBlush position="top-right" size="lg" />

      <div className="relative mx-auto grid max-w-[1200px] gap-12 px-6 pb-16 pt-16 sm:px-8 sm:pb-24 sm:pt-24 lg:grid-cols-[6fr_4fr] lg:items-center lg:gap-16">
        <FadeUp className="max-w-[60ch]">
          <Eyebrow>a quiet companion</Eyebrow>
          <h1 className="qc-display mt-5 text-[clamp(2.4rem,5.4vw,4rem)] text-[color:var(--qc-ink)]">
            something soft to set things down on,
            <br />
            for the loud days.
          </h1>
          <p className="mt-6 max-w-[52ch] text-lg leading-[1.6] text-[color:var(--qc-ink-soft)]">
            a private place to think out loud, return to the same conversation
            tomorrow, and reach a real therapist when you're ready. built for
            the way young people in india actually talk.
          </p>

          <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="qc-pill-primary"
            >
              open mindmitra
            </button>
            <button
              type="button"
              onClick={() => {
                const el = document.querySelector("#how-it-works");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="qc-pill-outline"
            >
              how it holds you
            </button>
          </div>

          <p className="mt-10 text-xs text-[color:var(--qc-ink-muted)]">
            private by default. crisis support is one tap away on every screen.
          </p>
        </FadeUp>

        <FadeUp delay={120} className="hidden lg:block">
          <WatercolorScene
            name="presence"
            maxRenderedWidth={960}
            loading="eager"
            className="mx-auto max-w-[480px]"
          />
        </FadeUp>
      </div>
    </section>
  );
};

export default WelcomeHero;
