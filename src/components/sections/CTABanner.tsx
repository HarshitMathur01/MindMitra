import { ArrowRight, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { DURATION, EASE } from "@/lib/redesign/tokens";

/**
 * CTABanner — single calm CTA + crisis disclaimer line above footer.
 * No gradient marketing tile; uses the same paper surface as the rest
 * of the page so the page reads as one continuous surface.
 */
const CTABanner = () => {
  const navigate = useNavigate();

  return (
    <section className="relative pb-24 pt-6 sm:pb-32">
      <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: DURATION.long, ease: EASE.outExpo }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="font-display text-3xl tracking-tight text-foreground sm:text-[2.5rem] sm:leading-[1.1]">
            Start with one sentence.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
            That's it. Tell Mitra one true thing about today, and let the
            conversation go where it needs to.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
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
              onClick={() => navigate("/psychological-content")}
              className="text-muted-foreground hover:text-foreground"
            >
              Read something first
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: DURATION.long, delay: 0.1 }}
          className="mx-auto mt-16 flex max-w-2xl items-start gap-3 rounded-2xl border border-border/40 bg-[hsl(var(--ink-1))] p-4 text-left"
        >
          <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--bad-500))]" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">If you are in crisis right now:</span>{" "}
            iCall <a className="underline-offset-2 hover:underline" href="tel:9152987821">9152&nbsp;987&nbsp;821</a>,
            Vandrevala Foundation <a className="underline-offset-2 hover:underline" href="tel:18602662345">1860&nbsp;2662&nbsp;345</a>,
            AASRA <a className="underline-offset-2 hover:underline" href="tel:9820466726">9820&nbsp;466&nbsp;726</a>. Call any time.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default CTABanner;
