import type { Stance } from "../lib/game";

interface Props {
  stance: Stance;
  onChange: (s: Stance) => void;
  disabled?: boolean;
}

const OPTIONS: Array<{ id: Stance; label: string; emoji: string; hint: string }> = [
  { id: "study",  label: "Study",  emoji: "📖", hint: "+library, harder bunks" },
  { id: "bunk",   label: "Bunk",   emoji: "😴", hint: "skip proxy, lose rep" },
  { id: "hustle", label: "Hustle", emoji: "💸", hint: "+cash, −attendance" },
];

export function StanceBar({ stance, onChange, disabled }: Props) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1.5">
        Today's stance
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {OPTIONS.map((o) => {
          const active = o.id === stance;
          return (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
              disabled={disabled}
              className={`p-2 rounded-sm border-2 text-left transition-all disabled:opacity-50 ${
                active ? "border-primary bg-primary/10" : "border-border bg-muted/30 hover:border-primary/50"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-base leading-none">{o.emoji}</span>
                <span className="font-display text-sm">{o.label}</span>
              </div>
              <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{o.hint}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
