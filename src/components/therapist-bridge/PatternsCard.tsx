import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { EmotionalProfile } from "@/lib/mock/therapist-bridge";

export function PatternsCard({ patterns }: { patterns: EmotionalProfile["patterns"] }) {
  return (
    <ul className="space-y-3">
      {patterns.map((p) => {
        const Icon = p.trend === "up" ? TrendingUp : p.trend === "down" ? TrendingDown : Minus;
        const tone =
          p.trend === "up"
            ? "text-destructive"
            : p.trend === "down"
              ? "text-primary"
              : "text-muted-foreground";
        return (
          <li key={p.label} className="flex items-start gap-3">
            <span className={`mt-0.5 rounded-md bg-muted p-1.5 ${tone}`}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">{p.label}</p>
              <p className="text-xs text-muted-foreground">{p.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
