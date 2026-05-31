import { useState } from "react";
import { ARCHETYPES, type ArchetypeId } from "../lib/game";
import { Button } from "@/components/ui/button";
import boxArt from "../assets/box-art.jpg";

interface Props {
  onStart: (humans: ArchetypeId[]) => void;
  onHowToPlay?: () => void;
}

export function StartScreen({ onStart, onHowToPlay }: Props) {
  const [humans, setHumans] = useState<Set<ArchetypeId>>(new Set(["topper"]));

  function toggle(id: ArchetypeId) {
    setHumans((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) next.add(id); // must keep at least 1 human
      return next;
    });
  }

  return (
    <main className="min-h-screen px-4 py-10 flex items-center justify-center">
      <div className="paper-card ornate-border max-w-2xl w-full p-6 sm:p-10">
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          <img
            src={boxArt}
            alt="Campus Ludo box art"
            className="w-full sm:w-40 h-40 object-cover rounded-sm ornate-border"
          />
          <div>
            <p className="text-[11px] tracking-[0.35em] uppercase text-muted-foreground">
              Pick your players
            </p>
            <h1 className="font-display text-4xl sm:text-5xl text-primary leading-none mt-1">
              Campus Ludo
            </h1>
            <p className="font-display italic text-foreground/80 text-xl mt-1">Hostel Hustle</p>
            <p className="text-sm text-muted-foreground mt-3">
              Toggle each archetype as a <strong className="text-foreground">human</strong> (hot-seat) or{" "}
              <strong className="text-foreground">CPU</strong>. Pass the device on each human turn.
            </p>
            {onHowToPlay && (
              <button
                onClick={onHowToPlay}
                className="mt-3 text-[11px] font-mono uppercase tracking-[0.2em] underline underline-offset-4 text-muted-foreground hover:text-foreground transition-colors"
              >
                ? How to play
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ARCHETYPES.map((a) => {
            const isHuman = humans.has(a.id);
            return (
              <button
                key={a.id}
                onClick={() => toggle(a.id)}
                className={`text-left p-3 rounded-sm border-2 transition-all ${
                  isHuman ? "border-primary bg-primary/10" : "border-border bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-4 w-4 rounded-full border border-foreground/30"
                    style={{ background: `var(${a.tokenVar})` }}
                  />
                  <span className="font-display text-lg">{a.name}</span>
                  <span
                    className={`ml-auto text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-sm ${
                      isHuman ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isHuman ? "Human" : "CPU"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 italic">{a.tagline}</p>
                <p className="text-[11px] text-foreground/70 mt-1">{a.perk}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {humans.size} human{humans.size === 1 ? "" : "s"} · {4 - humans.size} CPU
          </p>
          <Button
            onClick={() => onStart(ARCHETYPES.map((a) => a.id).filter((id) => humans.has(id)))}
            className="font-display tracking-wide text-base px-6"
          >
            Begin Semester →
          </Button>
        </div>
      </div>
    </main>
  );
}
