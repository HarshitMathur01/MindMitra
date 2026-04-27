import type { EmotionalProfile, Severity } from "@/lib/mock/therapist-bridge";

const severityTone: Record<Severity, string> = {
  minimal: "text-[#7A736A]",
  mild: "text-[#7A736A]",
  moderate: "text-[#4A4640]",
  severe: "text-[#4A4640]",
};

export function AssessmentScores({ scores }: { scores: EmotionalProfile["assessments"] }) {
  return (
    <div className="space-y-5">
      {scores.map((s) => {
        const pct = (s.score / s.max) * 100;
        return (
          <div key={s.name}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13.5px] font-medium text-[#2D2A24]">{s.name}</span>
              <div className="flex items-baseline gap-3">
                <span className="text-xs text-[#7A736A]">
                  {s.score} / {s.max}
                </span>
                <span className={`text-xs italic capitalize ${severityTone[s.severity]}`}>
                  {s.severity}
                </span>
              </div>
            </div>
            <div className="h-[2px] overflow-hidden rounded-full bg-[#A8BC9A33]">
              <div
                className="h-full rounded-full bg-[#3F6B47] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
