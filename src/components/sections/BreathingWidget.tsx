import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wind, X, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { duration as dur, ease } from "@/lib/motion";

type BreathPhase = "inhale" | "hold" | "exhale" | "rest";

const phaseConfig: Record<
  BreathPhase,
  { label: string; duration: number }
> = {
  inhale: { label: "Inhale", duration: 4000 },
  hold: { label: "Hold", duration: 4000 },
  exhale: { label: "Exhale", duration: 6000 },
  rest: { label: "Rest", duration: 2000 },
};

const phaseOrder: BreathPhase[] = ["inhale", "hold", "exhale", "rest"];

const BreathingWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [phase, setPhase] = useState<BreathPhase>("inhale");
  const [cycleCount, setCycleCount] = useState(0);
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    if (!isActive) return;
    const currentDuration = phaseConfig[phase].duration;
    setCountdown(Math.ceil(currentDuration / 1000));

    const countdownInterval = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : prev));
    }, 1000);

    const timer = setTimeout(() => {
      const currentIndex = phaseOrder.indexOf(phase);
      const nextIndex = (currentIndex + 1) % phaseOrder.length;
      if (nextIndex === 0) setCycleCount((c) => c + 1);
      setPhase(phaseOrder[nextIndex]);
    }, currentDuration);

    return () => {
      clearTimeout(timer);
      clearInterval(countdownInterval);
    };
  }, [isActive, phase]);

  const reset = () => {
    setIsActive(false);
    setPhase("inhale");
    setCycleCount(0);
  };

  const toggleExercise = () => {
    if (isActive) {
      reset();
    } else {
      setIsActive(true);
      setPhase("inhale");
      setCycleCount(0);
    }
  };

  const circleScale =
    phase === "inhale" ? 1.25 : phase === "exhale" ? 0.82 : 1;

  return (
    <>
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 left-5 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-[hsl(var(--accent-100))] text-[hsl(var(--accent-700))] shadow-e1 transition-colors duration-base hover:bg-[hsl(var(--accent-200))]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: dur.long, ease: ease.outExpo }}
        title="A moment to breathe"
        aria-label="Open a breathing exercise"
      >
        <Wind className="h-[18px] w-[18px]" strokeWidth={1.6} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed bottom-20 left-5 z-50 w-72 overflow-hidden rounded-3xl bg-[hsl(var(--ink-0))] shadow-e3"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: dur.base, ease: ease.outExpo }}
          >
            <div className="flex items-center justify-between px-5 pt-5">
              <div className="text-[13px] text-ink-6">
                A minute to breathe
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  reset();
                }}
                className="text-ink-5 transition-colors hover:text-ink-8"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col items-center px-5 pb-2 pt-6">
              <div className="relative mb-6 flex h-32 w-32 items-center justify-center">
                <motion.div
                  className="absolute inset-4 rounded-full bg-[hsl(var(--accent-200))]"
                  animate={{
                    scale: isActive ? circleScale : 1,
                    opacity: isActive ? 0.45 : 0.2,
                  }}
                  transition={{
                    duration: phaseConfig[phase].duration / 1000,
                    ease: "easeInOut",
                  }}
                />
                <div className="relative text-center">
                  {isActive ? (
                    <>
                      <p className="text-[12.5px] text-ink-6">
                        {phaseConfig[phase].label.toLowerCase()}
                      </p>
                      <p className="mt-1 font-display text-[34px] font-normal leading-none tabular-nums text-ink-8">
                        {countdown}
                      </p>
                    </>
                  ) : (
                    <p className="px-2 text-[13px] leading-relaxed text-ink-6">
                      Four in. Hold. Six out.
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={toggleExercise}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13.5px] font-medium transition-colors",
                  isActive
                    ? "bg-[hsl(var(--ink-2))] text-ink-7 hover:bg-[hsl(var(--ink-3))]"
                    : "bg-[hsl(var(--accent-500))] text-primary-foreground hover:bg-[hsl(var(--accent-600))]",
                )}
              >
                {isActive ? (
                  <>
                    <Pause className="h-3.5 w-3.5" strokeWidth={1.8} />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" strokeWidth={1.8} />
                    Begin
                  </>
                )}
              </button>

              {cycleCount > 0 && (
                <p className="mt-3 text-[12.5px] tabular-nums text-ink-5">
                  {cycleCount} slow breath{cycleCount > 1 ? "s" : ""} so far
                </p>
              )}
            </div>

            <div className="px-5 pb-5 pt-3">
              <p className="text-[12.5px] leading-relaxed text-ink-5">
                If you only have a minute, this can help your body remember it's
                safe. That's all it needs to do.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default BreathingWidget;
