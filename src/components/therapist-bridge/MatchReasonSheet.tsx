import type { Match } from "@/lib/therapist-bridge/matching";
import { BottomSheet } from "./BottomSheet";

export function MatchReasonSheet({
  match,
  onOpenChange,
}: {
  match: Match | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <BottomSheet
      open={match !== null}
      onOpenChange={onOpenChange}
      title={match ? `Why ${match.therapist.name} came up` : ""}
      description={match?.phrase}
    >
      {match ? (
        <div className="space-y-4">
          <ul className="space-y-3">
            {match.reasons.map((reason) => (
              <li key={reason} className="flex gap-3 text-sm leading-relaxed text-foreground">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {reason}
              </li>
            ))}
          </ul>
          <p className="rounded-xl bg-secondary/70 p-4 text-sm leading-relaxed text-muted-foreground">
            Nothing here is hidden from you. If a reason looks wrong, change your answers and the
            matches change with them.
          </p>
        </div>
      ) : null}
    </BottomSheet>
  );
}
