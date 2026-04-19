import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Pulse from "@/components/identity/Pulse";
import { DURATION, EASE } from "@/lib/redesign/tokens";

/**
 * WelcomeHero — first impression for the public landing.
 *
 * "Quiet Companion" direction: the brand presence (Pulse) is the only
 * decorative element. Copy is direct, not "AI-marketing". One primary
 * CTA, one quiet secondary, one trust line. No floating chat preview
 * here — the live preview lives further down the page.
 */
const WelcomeHero = () => {
  const navigate = useNavigate();

  return (
    <section
      className="relative isolate flex min-h-[88vh] items-center overflow-hidden pt-[var(--header-height)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 50% at 50% 18%, hsl(var(--accent-100) / 0.55) 0%, transparent 65%), radial-gradient(ellipse 55% 40% at 80% 90%, hsl(var(--warmth-100) / 0.35) 0%, transparent 60%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-page px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: DURATION.long, ease: EASE.outExpo }}
            className="mb-12"
          >
            <Pulse size={184} state="idle" intensity={0.85} />
          </motion.div>

          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.long, delay: 0.05, ease: EASE.outExpo }}
            className="quiet-label"
          >
            MindMitra
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.long, delay: 0.1, ease: EASE.outExpo }}
            className="mt-5 font-display text-[clamp(2.4rem,5.4vw,4rem)] leading-[1.06] tracking-tight text-foreground"
          >
            A quiet companion
            <br />
            for the loud days.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.long, delay: 0.18, ease: EASE.outExpo }}
            className="mt-6 max-w-xl text-balance text-lg leading-relaxed text-muted-foreground"
          >
            A private place to think out loud, return to the same conversation
            tomorrow, and reach a real therapist when you want to. Built for the
            way young people in India actually talk.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.long, delay: 0.26, ease: EASE.outExpo }}
            className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
          >
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="gap-2 rounded-full bg-primary px-8 text-base font-medium text-primary-foreground shadow-[var(--shadow-dashboard-warm)] hover:bg-[hsl(var(--accent-600))]"
            >
              Open MindMitra
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => {
                const el = document.querySelector("#how-it-works");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              How it holds you
            </Button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: DURATION.long, delay: 0.4 }}
            className="mt-10 text-xs text-muted-foreground"
          >
            Private by default. Crisis support is one tap away on every screen.
          </motion.p>
        </div>
      </div>
    </section>
  );
};

export default WelcomeHero;
