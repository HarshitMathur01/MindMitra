import { BOARD, type PlayerState, type ArchetypeId, ARCHETYPES } from "../lib/game";

interface Props {
  players: PlayerState[];
  activeId: ArchetypeId;
  /** A token mid-hop: render it at `pos` instead of its committed position. */
  moving?: { id: ArchetypeId; pos: number } | null;
}

// Lay 32 tiles around a square ring: 9 per side, sharing corners.
// Sides: top (0-8), right (8-16), bottom (16-24), left (24-32→0)
function gridPos(i: number): { col: number; row: number } {
  const SIZE = 9; // 9x9 grid
  if (i < 8) return { col: 1 + i, row: 1 };
  if (i < 16) return { col: 9, row: 1 + (i - 8) };
  if (i < 24) return { col: 9 - (i - 16), row: 9 };
  return { col: 1, row: 9 - (i - 24) };
}

const KIND_COLOR: Record<string, string> = {
  start: "bg-primary text-primary-foreground",
  lecture: "bg-secondary/70",
  library: "bg-accent/30",
  canteen: "bg-secondary/40",
  festival: "bg-primary/15",
  exam: "bg-destructive/20",
  placement: "bg-accent/50 text-accent-foreground",
  surprise: "bg-destructive/35",
  chill: "bg-muted",
  hostel: "bg-primary text-primary-foreground",
};

export function Board({ players, activeId, moving }: Props) {
  const posOf = (p: PlayerState) => (moving && moving.id === p.id ? moving.pos : p.position);
  return (
    <div className="paper-card p-4 sm:p-6">
      <div
        className="relative grid gap-1 ornate-border p-3"
        style={{
          gridTemplateColumns: "repeat(9, minmax(0, 1fr))",
          gridTemplateRows: "repeat(9, minmax(0, 1fr))",
          aspectRatio: "1 / 1",
          background:
            "radial-gradient(circle at center, oklch(0.92 0.04 80) 0%, oklch(0.88 0.05 75) 100%)",
        }}
      >
        {BOARD.map((tile, i) => {
          const { col, row } = gridPos(i);
          const occupants = players.filter((p) => posOf(p) === i);
          return (
            <div
              key={i}
              style={{ gridColumn: col, gridRow: row }}
              className={`relative rounded-sm border border-border/60 p-1 text-[9px] sm:text-[10px] leading-tight flex flex-col items-center justify-center text-center ${KIND_COLOR[tile.kind]}`}
              title={tile.label}
            >
              <span className="text-base sm:text-lg leading-none">{tile.emoji}</span>
              <span className="hidden sm:block opacity-80 truncate max-w-full">{tile.label}</span>
              {occupants.length > 0 && (
                <div className="absolute -top-1 -right-1 flex gap-0.5">
                  {occupants.map((o) => {
                    const arc = ARCHETYPES.find((a) => a.id === o.id)!;
                    return (
                      <span
                        key={o.id}
                        className={`block h-3 w-3 rounded-full border border-background ${o.id === activeId ? "animate-hop" : ""}`}
                        style={{ background: `var(${arc.tokenVar})` }}
                        title={arc.name}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Center crest */}
        <div
          className="flex flex-col items-center justify-center text-center"
          style={{ gridColumn: "2 / span 7", gridRow: "2 / span 7" }}
        >
          <div className="paper-card ornate-border px-6 py-5 sm:px-10 sm:py-8 bg-card/95">
            <p className="text-[10px] sm:text-xs tracking-[0.3em] uppercase text-muted-foreground">Est. Semester I</p>
            <h2 className="font-display text-3xl sm:text-5xl text-primary leading-none mt-1">
              Campus Ludo
            </h2>
            <p className="font-display italic text-base sm:text-xl text-foreground/80 mt-1">
              Hostel Hustle
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 max-w-[18rem] sm:max-w-sm">
              {ARCHETYPES.map((a) => (
                <span
                  key={a.id}
                  className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm border ${a.id === activeId ? "border-primary text-primary font-semibold" : "border-border/60 text-muted-foreground"}`}
                >
                  ● {a.name.replace("The ", "")}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
