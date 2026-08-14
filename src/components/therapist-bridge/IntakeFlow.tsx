import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { focusOptions, qualityOptions } from "@/lib/therapist-bridge/data";
import type { MeetingFormat } from "@/lib/therapist-bridge/data";
import { useBridge } from "./BridgeContext";

const steps = [
  { key: "focus", question: "What would feel supportive right now?", hint: "Choose as many as fit." },
  { key: "format", question: "How would you like to meet?", hint: "You can change this later." },
  { key: "qualities", question: "What matters most in a therapist?", hint: "Two or three is plenty." },
  { key: "budget", question: "What feels comfortable per session?", hint: "We'll stay near this." },
] as const;

const formats: { value: MeetingFormat; label: string }[] = [
  { value: "virtual", label: "Virtual" },
  { value: "in-person", label: "In person" },
  { value: "either", label: "Either" },
];

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-11 rounded-full border px-4 text-sm transition-all duration-300 ${
        selected
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-card/60 text-foreground hover:-translate-y-0.5 hover:border-primary/40"
      }`}
    >
      {label}
    </button>
  );
}

export function IntakeFlow({
  open,
  onOpenChange,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}) {
  const { draft, setDraft, setIntake } = useBridge();
  const [step, setStep] = useState(0);
  const reduced = useReducedMotion();
  const current = steps[step]!;

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const next = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
      return;
    }
    setIntake(draft);
    onOpenChange(false);
    setStep(0);
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-w-none flex-col gap-0 rounded-none border-0 bg-background p-6 sm:h-auto sm:max-w-xl sm:rounded-2xl sm:border sm:bg-card sm:p-8">
        <DialogTitle className="sr-only">Finding the right therapist</DialogTitle>
        <DialogDescription className="sr-only">
          A four step conversation about what you're looking for.
        </DialogDescription>

        <div className="flex items-center gap-4">
          <span className="text-xs tracking-[0.2em] text-muted-foreground">
            {String(step + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
          </span>
          <div className="h-px flex-1 bg-border">
            <motion.div
              className="h-px bg-primary"
              animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
              transition={{ duration: reduced ? 0 : 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>

        <div className="mt-10 flex-1 sm:min-h-[19rem]">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.key}
              initial={reduced ? { opacity: 0 } : { opacity: 0, x: 24 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, x: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: -24 }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
            >
              <h2 className="display text-3xl text-ink sm:text-4xl">{current.question}</h2>
              <p className="hand mt-2 text-sm text-muted-foreground">{current.hint}</p>

              <div className="mt-7">
                {current.key === "focus" && (
                  <div className="flex flex-wrap gap-2">
                    {focusOptions.map((f) => (
                      <Chip
                        key={f}
                        label={f}
                        selected={draft.focuses.includes(f)}
                        onClick={() => setDraft({ ...draft, focuses: toggle(draft.focuses, f) })}
                      />
                    ))}
                  </div>
                )}

                {current.key === "format" && (
                  <div className="flex flex-wrap gap-2">
                    {formats.map((f) => (
                      <Chip
                        key={f.value}
                        label={f.label}
                        selected={draft.format === f.value}
                        onClick={() => setDraft({ ...draft, format: f.value })}
                      />
                    ))}
                  </div>
                )}

                {current.key === "qualities" && (
                  <div className="flex flex-wrap gap-2">
                    {qualityOptions.map((q) => (
                      <Chip
                        key={q}
                        label={q}
                        selected={draft.qualities.includes(q)}
                        onClick={() => setDraft({ ...draft, qualities: toggle(draft.qualities, q) })}
                      />
                    ))}
                  </div>
                )}

                {current.key === "budget" && (
                  <div className="pt-2">
                    <p className="display text-5xl text-ink">
                      ${draft.budget}
                      <span className="ml-2 font-sans text-sm text-muted-foreground">per session</span>
                    </p>
                    <Slider
                      className="mt-8"
                      value={[draft.budget]}
                      min={60}
                      max={220}
                      step={5}
                      aria-label="Comfortable price per session in dollars"
                      onValueChange={([v]) => setDraft({ ...draft, budget: v ?? draft.budget })}
                    />
                    <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                      <span>$60</span>
                      <span>$220</span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => (step === 0 ? onOpenChange(false) : setStep(step - 1))}
            className="min-h-11 text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {step === 0 ? "Not now" : "Back"}
          </button>
          <Button onClick={next} className="lift min-h-11 rounded-full px-6">
            {step === steps.length - 1 ? "Find people who fit" : "Continue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
