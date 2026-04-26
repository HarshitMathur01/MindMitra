import type { EmotionalProfile } from "@/lib/mock/therapist-bridge";

export function TopicCloud({ topics }: { topics: EmotionalProfile["topics"] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {topics.map((t) => {
        const size = 0.75 + (t.weight / 10) * 0.6;
        const opacity = 0.5 + (t.weight / 10) * 0.5;
        return (
          <span
            key={t.word}
            className="rounded-full border bg-accent/40 px-3 py-1 font-medium text-accent-foreground"
            style={{ fontSize: `${size}rem`, opacity }}
          >
            {t.word}
          </span>
        );
      })}
    </div>
  );
}
