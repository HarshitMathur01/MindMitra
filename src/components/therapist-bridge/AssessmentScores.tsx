import { Badge } from "@/components/ui/badge";
import type { EmotionalProfile, Severity } from "@/lib/mock/therapist-bridge";

const severityVariant: Record<Severity, "secondary" | "default" | "destructive"> = {
  minimal: "secondary",
  mild: "secondary",
  moderate: "default",
  severe: "destructive",
};

export function AssessmentScores({ scores }: { scores: EmotionalProfile["assessments"] }) {
  return (
    <div className="space-y-3">
      {scores.map((s) => {
        const pct = (s.score / s.max) * 100;
        return (
          <div key={s.name}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{s.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {s.score} / {s.max}
                </span>
                <Badge variant={severityVariant[s.severity]} className="capitalize">
                  {s.severity}
                </Badge>
              </div>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full tb-gradient-hero transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
