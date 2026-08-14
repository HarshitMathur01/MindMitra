import { useState } from "react";
import { assessments, type Assessment } from "@/lib/therapist-bridge/data";
import { BottomSheet } from "./BottomSheet";

export function CheckIns() {
  const [open, setOpen] = useState<Assessment | null>(null);

  return (
    <section aria-labelledby="checkins-heading" className="panel rounded-2xl p-5">
      <h2 id="checkins-heading" className="display text-2xl text-ink">
        Your check-ins
      </h2>
      <ul className="mt-4 space-y-3">
        {assessments.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => setOpen(a)}
              className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 border-b border-border/70 pb-3 text-left transition-colors hover:border-primary/40"
            >
              <span className="text-sm tracking-wide text-muted-foreground">{a.name}</span>
              <span className="text-sm text-foreground">{a.band}</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setOpen(assessments[0]!)}
        className="mt-4 text-sm text-primary underline-offset-4 hover:underline"
      >
        View details →
      </button>

      <BottomSheet
        open={open !== null}
        onOpenChange={(o) => !o && setOpen(null)}
        title={open ? `${open.name} · ${open.band}` : ""}
        description={open ? `${open.score} · ${open.date}` : undefined}
      >
        {open ? (
          <div className="space-y-4">
            <p className="leading-relaxed text-foreground">{open.meaning}</p>
            <div className="flex flex-wrap gap-2">
              {assessments.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setOpen(a)}
                  aria-pressed={a.id === open.id}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    a.id === open.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {a.name}
                </button>
              ))}
            </div>
            <p className="rounded-xl bg-secondary/70 p-4 text-sm leading-relaxed text-muted-foreground">
              This is not a diagnosis. Questionnaires describe how a stretch of days felt — only a
              clinician, with you, can say more than that.
            </p>
          </div>
        ) : null}
      </BottomSheet>
    </section>
  );
}
