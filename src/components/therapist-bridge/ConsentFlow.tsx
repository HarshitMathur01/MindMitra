import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useBridge, type ConsentKey } from "./BridgeContext";
import { PrivacyFlowVisualization } from "./PrivacyFlowVisualization";

const rows: { key: ConsentKey; label: string; detail: string }[] = [
  {
    key: "assessments",
    label: "Assessment results",
    detail: "PHQ-9 and GAD-7 scores, bands and the dates you took them.",
  },
  {
    key: "patterns",
    label: "Emotional patterns",
    detail: "Mood, energy and sleep trends — the shape of your week, not the entries.",
  },
  {
    key: "summaries",
    label: "Session summaries",
    detail: "Short written recaps you've reviewed and kept.",
  },
  {
    key: "words",
    label: "Your own words",
    detail: "Quoted lines you choose to attach. Chat transcripts are never sent automatically.",
  },
];

export function ConsentFlow({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { consent, toggleConsent } = useBridge();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[92dvh] overflow-y-auto rounded-t-2xl bg-card px-6 pb-10 pt-7 sm:max-w-2xl"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="display text-4xl text-ink">You're in control.</SheetTitle>
          <SheetDescription className="text-base leading-relaxed text-muted-foreground">
            Choose exactly what your therapist can see. You can change this anytime.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 rounded-2xl border border-border bg-background/60 p-4">
          <PrivacyFlowVisualization consent={consent} />
        </div>

        <ul className="mt-6 divide-y divide-border">
          {rows.map((row) => (
            <li key={row.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 py-4">
              <div className="min-w-0">
                <p className="text-foreground">{row.label}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{row.detail}</p>
              </div>
              <Switch
                checked={consent[row.key]}
                onCheckedChange={() => toggleConsent(row.key)}
                aria-label={`Share ${row.label} with your therapist`}
                className="shrink-0"
              />
            </li>
          ))}
        </ul>

        <p className="hand mt-6 text-base text-primary">Nothing is shared without your choice.</p>
      </SheetContent>
    </Sheet>
  );
}
