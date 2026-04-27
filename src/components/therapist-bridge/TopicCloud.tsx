import type { EmotionalProfile } from "@/lib/mock/therapist-bridge";

export function TopicCloud({ topics }: { topics: EmotionalProfile["topics"] }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-3">
      {topics.map((t) => {
        const size = 0.95 + (t.weight / 10) * 0.9;
        const opacity = 0.55 + (t.weight / 10) * 0.45;
        return (
          <span
            key={t.word}
            className="qc-display text-[#2D2A24]"
            style={{ fontSize: `${size}rem`, opacity }}
          >
            {t.word}
          </span>
        );
      })}
    </div>
  );
}
