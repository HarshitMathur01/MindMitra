import { ClipboardList, Sparkles, ShieldCheck, CalendarCheck } from "lucide-react";

const steps = [
  { icon: ClipboardList, title: "Intake", desc: "Tell us what you need." },
  { icon: Sparkles, title: "Match", desc: "We surface the best-fit therapists." },
  { icon: ShieldCheck, title: "Consent", desc: "Choose exactly what to share." },
  { icon: CalendarCheck, title: "Book", desc: "Confirm your first session." },
];

export function ProcessTimeline() {
  return (
    <div className="rounded-2xl border bg-card p-6 tb-shadow-card">
      <h3 className="text-sm font-semibold text-muted-foreground">How the bridge works</h3>
      <ol className="mt-5 grid gap-6 sm:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.title} className="relative">
            {i < steps.length - 1 && (
              <span
                className="absolute left-10 top-5 hidden h-px w-[calc(100%-2.5rem)] bg-border sm:block"
                aria-hidden
              />
            )}
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-content-center rounded-full tb-gradient-hero text-primary-foreground">
                <s.icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {i + 1}. {s.title}
                </p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
