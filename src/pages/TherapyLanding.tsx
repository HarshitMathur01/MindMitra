import { Link } from "react-router-dom";
import { ArrowRight, HeartPulse, Phone } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import SEO from "@/components/system/SEO";
import { ROUND_THE_CLOCK_HELPLINE, helplineHref } from "@/lib/helplines";

const TherapyLanding = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="Care that meets you"
        description="A consent-first bridge from your daily check-ins with Mitra to the right clinician for you. Vetted Indian therapists — your context goes with you, never your raw chat."
        path="/therapy"
      />
      <Header />

      <main id="main-content" className="relative overflow-hidden pt-16">
        <div className="absolute inset-0 tb-gradient-soft" aria-hidden />
        <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-12 px-6 py-16 tb-fade-up md:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <HeartPulse className="h-3.5 w-3.5 text-primary" />
              MindMitra
            </div>

            <h1 className="mt-6 text-5xl font-semibold tracking-tight text-foreground sm:text-7xl">
              Care that{" "}
              <span className="bg-clip-text text-transparent tb-gradient-hero">meets you</span>
            </h1>

            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              From your quiet daily check-ins to the right clinician — a consent-first
              bridge to therapy that actually fits.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button asChild size="lg" className="tb-shadow-soft">
                <Link to="/therapist-bridge">
                  Open Therapist Bridge
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <a
                href={helplineHref(ROUND_THE_CLOCK_HELPLINE)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline decoration-[hsl(var(--accent-300))] underline-offset-4 transition-colors hover:decoration-[hsl(var(--accent-500))]"
              >
                <Phone className="h-4 w-4 text-[hsl(var(--accent-600))]" />
                Or call {ROUND_THE_CLOCK_HELPLINE.name} now — 24/7, free
              </a>
            </div>

            {/*
              Calm professional-care reassurance. Sits below the CTA so
              someone scanning the page understands the boundary before
              they tap through.
            */}
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground">
              MindMitra is a companion, not a clinician. If you are in crisis or
              worried about your safety, please reach a human first — the helplines
              above and in the footer are free, confidential, and answer in your
              language.
            </p>
          </div>

          <div className="relative hidden md:block">
            <div className="absolute -inset-10 rounded-full tb-gradient-hero blur-3xl tb-breathe" aria-hidden />
            <img
              src="https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=900&q=75"
              alt="Soft sunlight filtering through leaves"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              width={900}
              height={600}
              className="relative h-[480px] w-full rounded-[2.5rem] object-cover tb-shadow-soft tb-float"
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TherapyLanding;
