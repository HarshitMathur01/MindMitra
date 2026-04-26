import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";
import type { ConsentState } from "@/lib/mock/therapist-bridge";

const items: { key: keyof ConsentState; label: string; desc: string }[] = [
  { key: "assessments", label: "Share assessments", desc: "A simple snapshot of how you've been feeling lately." },
  { key: "fullProfile", label: "Share full emotional profile", desc: "The bigger picture — your moods, themes, and gentle patterns." },
  { key: "sessionSummaries", label: "Share session summaries", desc: "Soft notes from your reflections, in your own rhythm." },
  { key: "contactInfo", label: "Share contact information", desc: "Just your name and email, so they can reach out." },
];

export function ConsentForm({
  consent,
  onChange,
}: {
  consent: ConsentState;
  onChange: (c: ConsentState) => void;
}) {
  return (
    <Card className="rounded-2xl border-border/60 tb-shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5 text-primary" />
          What you'd like to share
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Take your time. Share only what feels right — you can change your mind anytime.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((it) => (
          <div
            key={it.key}
            className="flex items-start justify-between gap-4 rounded-xl border bg-background/40 p-4"
          >
            <div>
              <Label htmlFor={`c-${it.key}`} className="text-sm font-medium text-foreground">
                {it.label}
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">{it.desc}</p>
            </div>
            <Switch
              id={`c-${it.key}`}
              checked={consent[it.key]}
              onCheckedChange={(v) => onChange({ ...consent, [it.key]: v })}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
