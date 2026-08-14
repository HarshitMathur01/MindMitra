import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { BridgeProvider } from "./BridgeContext";
import { HeroImage } from "./HeroImage";
import { EmotionalSignal } from "./EmotionalSignal";
import { CheckIns } from "./CheckIns";
import { TopicConstellation } from "./TopicConstellation";
import { IntakeFlow } from "./IntakeFlow";
import { MatchReveal } from "./MatchReveal";
import { ConsentFlow } from "./ConsentFlow";
import { ClinicalHandoff } from "./ClinicalHandoff";
import { TransparencyDrawer } from "./TransparencyDrawer";


function Hero({ onSignal, onMeet }: { onSignal: () => void; onMeet: () => void }) {
  const reduced = useReducedMotion();
  return (
    <section className="relative grid items-center gap-10 pb-16 pt-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-24 lg:pt-16">
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14, filter: "blur(6px)" }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="order-2 lg:order-1"
      >
        <p className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-sage/15 px-3 py-1.5 text-[0.7rem] font-medium uppercase tracking-[0.14em] text-primary">
          <span className="breathe h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
          Your space · private by default
        </p>
        <h1 className="display text-[clamp(2.6rem,7vw,4.6rem)] leading-[0.98] text-ink">
          Find someone who
          <br />
          <em className="italic text-primary">truly</em> listens.
        </h1>
        <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
          When you're ready, we'll help you meet a therapist who feels like a good fit.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
          <Button onClick={onSignal} className="lift min-h-11 w-full rounded-full px-6 sm:w-auto">
            See how you've been feeling
          </Button>
          <Button
            onClick={onMeet}
            variant="outline"
            className="lift min-h-11 w-full rounded-full border-primary/30 px-6 text-primary sm:w-auto"
          >
            Meet someone who fits
          </Button>
        </div>
      </motion.div>

      <div className="relative order-1 aspect-square w-full max-w-[28rem] justify-self-center overflow-visible lg:order-2 lg:max-w-[30rem]">
        <HeroImage className="absolute inset-0 h-full w-full" />
      </div>

    </section>

  );
}

export function TherapistBridge() {
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);

  return (
    <BridgeProvider>
      <div className="paper-grain min-h-dvh">
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-0 h-[36rem] opacity-60"
          style={{
            background:
              "radial-gradient(60% 55% at 70% 0%, color-mix(in oklab, var(--sage) 32%, transparent), transparent)",
          }}
        />

        <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-8">
          <header className="flex items-center justify-between py-6">
            <p className="display text-xl text-ink">Therapist Bridge</p>
            <button
              type="button"
              onClick={() => setConsentOpen(true)}
              className="min-h-11 text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
            >
              Privacy
            </button>
          </header>

          <main>
            <Hero
              onSignal={() =>
                document.getElementById("signal")?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              onMeet={() => setIntakeOpen(true)}
            />

            <div id="signal" className="grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:items-start">
              <EmotionalSignal />
              <div className="grid gap-4">
                <CheckIns />
                <TopicConstellation />
              </div>
            </div>

            <section className="mt-10 grid gap-4 lg:grid-cols-[1.35fr_1fr] lg:items-start">
              <div className="panel flex flex-col items-start gap-5 rounded-2xl px-6 py-7 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="display text-3xl text-ink">Ready when you are.</p>
                  <p className="hand mt-1 text-sm text-muted-foreground">
                    Four questions, then a few people who might feel right.
                  </p>
                </div>
                <Button
                  onClick={() => setIntakeOpen(true)}
                  className="lift min-h-11 w-full shrink-0 rounded-full px-6 sm:w-auto"
                >
                  Meet someone who fits
                </Button>
              </div>
              <TransparencyDrawer />
            </section>

            <div className="h-16 sm:h-6" />
          </main>
        </div>

        <button
          type="button"
          onClick={() => setHandoffOpen(true)}
          className="lift panel fixed bottom-5 right-5 z-50 min-h-11 rounded-full px-5 text-sm text-foreground"
        >
          Clinical handoff
        </button>

        <IntakeFlow
          open={intakeOpen}
          onOpenChange={setIntakeOpen}
          onComplete={() => setMatchOpen(true)}
        />
        <MatchReveal
          open={matchOpen}
          onOpenChange={setMatchOpen}
          onOpenIntake={() => {
            setMatchOpen(false);
            setIntakeOpen(true);
          }}
        />
        <ConsentFlow open={consentOpen} onOpenChange={setConsentOpen} />
        <ClinicalHandoff open={handoffOpen} onOpenChange={setHandoffOpen} />
      </div>
    </BridgeProvider>
  );
}
