import { Link } from "react-router-dom";
import { ArrowRight, Phone } from "lucide-react";
import Header from "@/components/layout/Header";
import HillsFooter from "@/components/layout/HillsFooter";
import PageShell from "@/components/layout/PageShell";
import { WatercolorScene } from "@/components/layout/WatercolorScene";
import { PeachBlush } from "@/components/layout/PeachBlush";
import SEO from "@/components/system/SEO";
import { ROUND_THE_CLOCK_HELPLINE, helplineHref } from "@/lib/helplines";

const TherapyLanding = () => {
  return (
    <>
      <SEO
        title="Care that meets you"
        description="A consent-first bridge from your daily check-ins with Mitra to the right clinician for you. Vetted Indian therapists — your context goes with you, never your raw chat."
        path="/therapy"
      />
      <Header />
      <PageShell width="page" as="main" id="main-content">
        <section className="relative isolate grid min-h-[calc(100vh-var(--header-height))] items-center gap-12 overflow-hidden py-20 md:grid-cols-[1.1fr_0.9fr] md:py-24">
          <PeachBlush position="top-left" size="lg" className="-z-10" />

          <div>
            <p className="qc-eyebrow">Therapist bridge</p>
            <h1 className="qc-display mt-4 text-[clamp(2.5rem,5.5vw,4rem)]">
              Care that{" "}
              <span className="mitra-voice text-[color:var(--qc-forest)]">
                meets you.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[color:var(--qc-ink-soft)]">
              From your quiet daily check-ins to the right clinician — a
              consent-first bridge to therapy that actually fits.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-5">
              <Link to="/therapist-bridge" className="qc-pill-primary">
                Open Therapist Bridge
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href={helplineHref(ROUND_THE_CLOCK_HELPLINE)}
                className="inline-flex items-center gap-2 text-sm text-[color:var(--qc-ink-soft)] underline decoration-[color:var(--qc-sage)] underline-offset-4 transition-colors hover:text-[color:var(--qc-ink)] hover:decoration-[color:var(--qc-forest)]"
              >
                <Phone className="h-4 w-4 text-[color:var(--qc-forest)]" />
                Or call {ROUND_THE_CLOCK_HELPLINE.name} now — 24/7, free
              </a>
            </div>

            <p className="mt-8 max-w-xl text-sm leading-relaxed text-[color:var(--qc-ink-muted)]">
              <span className="mitra-voice">
                MindMitra is a companion, not a clinician.
              </span>{" "}
              If you are in crisis or worried about your safety, please reach a
              human first — the helplines above and in the footer are free,
              confidential, and answer in your language.
            </p>
          </div>

          <div className="relative hidden md:block">
            <WatercolorScene
              name="companions"
              maxRenderedWidth={960}
              loading="eager"
              className="rounded-[2rem]"
            />
          </div>
        </section>
      </PageShell>
      <HillsFooter scene="hills" />
    </>
  );
};

export default TherapyLanding;
