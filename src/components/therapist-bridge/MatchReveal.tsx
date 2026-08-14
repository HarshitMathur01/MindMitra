import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Match } from "@/lib/therapist-bridge/matching";
import { useBridge } from "./BridgeContext";
import { TherapistCardReveal } from "./TherapistCard";
import { MatchReasonSheet } from "./MatchReasonSheet";

const signals = ["Your needs", "Your preferences", "Their approach"];

export function MatchReveal({
  open,
  onOpenChange,
  onOpenIntake,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenIntake: () => void;
}) {
  const { matches } = useBridge();
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<"searching" | "results">("searching");
  const [why, setWhy] = useState<Match | null>(null);

  useEffect(() => {
    if (!open) return;
    setPhase("searching");
    const timer = setTimeout(() => setPhase("results"), reduced ? 200 : 2600);
    return () => clearTimeout(timer);
  }, [open, reduced]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[100dvh] max-w-none flex-col gap-0 overflow-y-auto rounded-none border-0 bg-background p-6 sm:h-auto sm:max-h-[88dvh] sm:max-w-5xl sm:rounded-2xl sm:border sm:p-8">
          <DialogTitle className="sr-only">People who might feel right</DialogTitle>
          <DialogDescription className="sr-only">
            Therapist suggestions based on what you shared.
          </DialogDescription>

          <AnimatePresence mode="wait">
            {phase === "searching" ? (
              <motion.div
                key="searching"
                className="flex min-h-[60dvh] flex-col items-center justify-center text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                aria-live="polite"
              >
                <p className="display text-3xl text-ink sm:text-4xl">
                  Finding people who might feel right.
                </p>
                <ul className="mt-10 flex flex-col items-center gap-3">
                  {signals.map((s, i) => (
                    <motion.li
                      key={s}
                      className="text-sm text-muted-foreground"
                      initial={reduced ? { opacity: 1 } : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: reduced ? 0 : 0.3 + i * 0.5 }}
                    >
                      {i > 0 ? <span className="mr-2 text-primary">+</span> : null}
                      {s}
                    </motion.li>
                  ))}
                  <motion.li
                    className="hand text-lg text-primary"
                    initial={reduced ? { opacity: 1 } : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: reduced ? 0 : 1.9 }}
                  >
                    = a good fit
                  </motion.li>
                </ul>
              </motion.div>
            ) : (
              <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="display text-3xl text-ink sm:text-4xl">
                      Four people who might feel right
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ordered by fit, not by promotion. Nothing here is booked yet.
                    </p>
                  </div>
                  <Button variant="outline" className="shrink-0 rounded-full" onClick={onOpenIntake}>
                    Change my answers
                  </Button>
                </div>

                <div className="-mx-6 mt-7 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0">
                  {(matches ?? []).map((m, i) => (
                    <TherapistCardReveal
                      key={m.therapist.id}
                      match={m}
                      index={i}
                      reduced={!!reduced}
                      onWhy={() => setWhy(m)}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      <MatchReasonSheet match={why} onOpenChange={(o) => !o && setWhy(null)} />
    </>
  );
}
