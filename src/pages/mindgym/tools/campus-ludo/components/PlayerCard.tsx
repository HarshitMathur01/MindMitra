import { ARCHETYPES, type PlayerState } from "../lib/game";
import { Progress } from "@/components/ui/progress";

export function PlayerCard({ player, active }: { player: PlayerState; active: boolean }) {
  const arc = ARCHETYPES.find((a) => a.id === player.id)!;
  return (
    <div
      className={`paper-card p-3 transition-all ${active ? "ring-2 ring-primary translate-y-[-2px]" : "opacity-90"}`}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-4 w-4 rounded-full border border-foreground/20"
          style={{ background: `var(${arc.tokenVar})` }}
        />
        <div className="min-w-0">
          <p className="font-display text-lg leading-none truncate">{arc.name}</p>
          <p className="text-[11px] text-muted-foreground truncate">{arc.tagline}</p>
        </div>
      </div>
      <div className="mt-3 space-y-1.5 text-[11px]">
        <Row label="Attendance" value={`${player.attendance}%`} danger={player.attendance < 30}>
          <Progress value={player.attendance} className="h-1.5" />
        </Row>
        <Row label="Cash" value={`₹${player.cash}`} />
        <Row label="Reputation" value={`${player.reputation}`}>
          <Progress value={player.reputation} className="h-1.5" />
        </Row>
        <Row label="Distance" value={`${player.distance} / 32`} />
      </div>
      {!player.alive && (
        <p className="mt-2 text-[11px] text-destructive font-semibold uppercase tracking-wider">
          Detained — attendance zero
        </p>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  danger,
  children,
}: {
  label: string;
  value: string;
  danger?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">{label}</span>
        <span className={danger ? "text-destructive font-semibold" : "font-semibold"}>{value}</span>
      </div>
      {children}
    </div>
  );
}
