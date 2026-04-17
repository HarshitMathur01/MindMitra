import { HeartHandshake, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ease, duration } from "@/lib/motion";

/**
 * Pre-auth hero — aligns rhythm with signed-in dashboard: same max-width band,
 * eyebrow / display hierarchy, rounded sage CTA (not generic "xl" marketing button).
 */
const WelcomeHero = () => {
  const navigate = useNavigate();

  return (
    <section className="relative pb-24 pt-16 md:pb-32 md:pt-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(780px 460px at 50% -15%, hsl(var(--warmth-50)) 0%, transparent 58%), radial-gradient(640px 380px at 12% 100%, hsl(var(--accent-50)) 0%, transparent 55%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-[1.75rem] border border-ink-3/25 bg-[hsl(var(--card))]/55 px-6 py-12 shadow-dashboard-soft backdrop-blur-[8px] dark:border-ink-3/20 dark:bg-[hsl(var(--ink-2))]/40 md:px-10 md:py-14">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: duration.long, ease: ease.outExpo }}
              className="mx-auto mb-8 flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--accent-100))] text-[hsl(var(--accent-700))] breathe-slow dark:bg-[hsl(var(--accent-100))]/25 dark:text-[hsl(var(--accent-300))]"
              aria-hidden
            >
              <HeartHandshake className="h-6 w-6" strokeWidth={1.6} />
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration.long, ease: ease.outExpo, delay: 0.05 }}
              className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-5"
            >
              Welcome
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration.long, ease: ease.outExpo, delay: 0.08 }}
              className="mt-3 text-sm text-ink-5"
            >
              You don&apos;t have to know what to say.
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration.long, ease: ease.outExpo, delay: 0.1 }}
              className="mt-4 text-balance font-display text-[clamp(1.85rem,4.6vw,2.75rem)] font-normal leading-[1.18] tracking-tight text-ink-8"
            >
              Whatever today feels like,
              <br />
              <span className="text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]">there&apos;s a space for it here.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration.long, ease: ease.outExpo, delay: 0.15 }}
              className="mx-auto mt-6 max-w-lg text-[15px] leading-[1.7] text-ink-6"
            >
              MindMitra is a quiet place to talk when things feel heavy, foggy, or just a lot. No right way to start.
              No timer. No one watching.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration.long, ease: ease.outExpo, delay: 0.2 }}
              className="mt-10 flex flex-col items-center gap-4"
            >
              <Button
                type="button"
                onClick={() => navigate("/chat")}
                className="h-11 rounded-full bg-[hsl(var(--accent-500))] px-8 text-[15px] font-semibold text-white shadow-md hover:bg-[hsl(var(--accent-600))]"
              >
                When you&apos;re ready
              </Button>
              <button
                type="button"
                onClick={() => navigate("/wellness-checkin")}
                className="text-[14px] text-ink-6 underline-offset-4 transition-colors hover:text-[hsl(var(--accent-600))] hover:underline dark:hover:text-[hsl(var(--accent-400))]"
              >
                Or check in with yourself for a minute
              </button>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: duration.long, delay: 0.35 }}
              className="mt-12 text-[13px] text-ink-5"
            >
              Your words stay here. You can close this page at any time.
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: duration.long, delay: 0.45 }}
              className="mx-auto mt-5 inline-flex max-w-md items-center gap-2 rounded-full border border-[hsl(var(--warmth-300))]/40 bg-[hsl(var(--warmth-50))] px-4 py-2.5 text-left text-[13px] leading-snug text-[hsl(var(--warmth-600))] dark:border-[hsl(var(--warmth-400))]/25 dark:bg-[hsl(var(--warmth-50))]/12 dark:text-[hsl(var(--warmth-400))]"
            >
              <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
              <span>
                If you need someone right now,{" "}
                <button
                  type="button"
                  onClick={() => navigate("/therapist-bridge")}
                  className="font-medium underline underline-offset-4 hover:no-underline"
                >
                  a human is a tap away
                </button>
                .
              </span>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WelcomeHero;
