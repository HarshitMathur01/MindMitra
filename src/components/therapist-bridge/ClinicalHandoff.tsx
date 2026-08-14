import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { assessments, insights, weekSignal } from "@/lib/therapist-bridge/data";
import { useBridge } from "./BridgeContext";

const items = [
  { label: "Wearable signals", detail: "Sleep duration and resting heart rate, last 14 days." },
  { label: "Session summary", detail: "One paragraph, written plainly, reviewed by you." },
  { label: "Assessment results", detail: "PHQ-9 and GAD-7 with dates and bands." },
  { label: "Pattern context", detail: "How mood, energy and sleep moved together." },
];

export function ClinicalHandoff({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [preview, setPreview] = useState(false);
  const { consent } = useBridge();
  const avgSleep = (weekSignal.reduce((s, d) => s + d.sleep, 0) / weekSignal.length).toFixed(1);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[88dvh] overflow-y-auto rounded-t-2xl bg-card px-6 pb-10 pt-7 sm:max-w-xl"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="display text-3xl text-ink">Clinical handoff</SheetTitle>
            <SheetDescription className="text-base text-muted-foreground">
              What travels with you to a first session.
            </SheetDescription>
          </SheetHeader>

          <ul className="mt-6 space-y-4">
            {items.map((item) => (
              <li key={item.label} className="border-b border-border/70 pb-4 last:border-0">
                <p className="text-foreground">{item.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
              </li>
            ))}
          </ul>

          <Button className="lift mt-6 min-h-11 w-full rounded-full" onClick={() => setPreview(true)}>
            Preview what your therapist sees
          </Button>
        </SheetContent>
      </Sheet>

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto rounded-2xl bg-card p-8">
          <DialogTitle className="display text-3xl text-ink">What your therapist sees</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Prepared for a first session · built only from what you've allowed
          </DialogDescription>

          <div className="mt-6 space-y-6 text-sm leading-relaxed">
            <section>
              <h3 className="text-xs uppercase tracking-[0.16em] text-muted-foreground">In brief</h3>
              <p className="mt-2 text-foreground">
                Someone arriving after a long stretch of work pressure, with sleep averaging{" "}
                {avgSleep} hours and mood lifting slightly over the past week.
              </p>
            </section>

            {consent.assessments ? (
              <section>
                <h3 className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Assessments
                </h3>
                <ul className="mt-2 space-y-1 text-foreground">
                  {assessments.map((a) => (
                    <li key={a.id}>
                      {a.name} — {a.band} ({a.score}), {a.date.toLowerCase()}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {consent.patterns ? (
              <section>
                <h3 className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Patterns</h3>
                <ul className="mt-2 space-y-1 text-foreground">
                  {insights.map((i) => (
                    <li key={i.id}>{i.label}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {consent.summaries ? (
              <section>
                <h3 className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Session summary
                </h3>
                <p className="mt-2 text-foreground">
                  Recurring themes: workload, sleep, self-criticism. Warmth when family comes up.
                </p>
              </section>
            ) : null}

            <p className="rounded-xl bg-secondary/70 p-4 text-muted-foreground">
              {consent.words
                ? "Includes lines you chose to attach. Full chat transcripts are never sent automatically."
                : "Your own words are not included. Full chat transcripts are never sent automatically."}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
