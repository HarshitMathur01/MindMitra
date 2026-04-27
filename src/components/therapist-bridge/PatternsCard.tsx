import type { EmotionalProfile } from "@/lib/mock/therapist-bridge";

export function PatternsCard({ patterns }: { patterns: EmotionalProfile["patterns"] }) {
  return (
    <ul className="space-y-5">
      {patterns.map((p) => {
        const arrow = p.trend === "up" ? "↑" : p.trend === "down" ? "↓" : "—";
        return (
          <li key={p.label} className="flex items-start gap-4">
            <span
              aria-hidden
              className="qc-display mt-0.5 w-4 shrink-0 text-lg leading-none text-[#7A736A]"
            >
              {arrow}
            </span>
            <div>
              <p className="text-[13.5px] font-medium text-[#2D2A24]">{p.label}</p>
              <p className="mt-1 text-xs leading-[1.6] text-[#7A736A]">{p.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
