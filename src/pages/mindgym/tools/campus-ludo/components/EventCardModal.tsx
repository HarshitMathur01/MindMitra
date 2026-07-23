import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { EventCard, EventChoice } from "../lib/events";

interface Props {
  open: boolean;
  card: EventCard | null;
  onPick: (choice: EventChoice) => void;
}

export function EventCardModal({ open, card, onPick }: Props) {
  if (!card) return null;
  return (
    <Dialog open={open}>
      {/* A choice is mandatory — there is no sensible "close" outcome. */}
      <DialogContent hideCloseButton className="cl-scope paper-card ornate-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary flex items-center gap-2">
            <span>{card.emoji}</span> {card.title}
          </DialogTitle>
          <DialogDescription className="text-base text-foreground/80 pt-1">
            {card.prompt}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-2 pt-2">
          {card.choices.map((c, i) => (
            <Button
              key={i}
              variant={i === 0 ? "default" : "secondary"}
              onClick={() => onPick(c)}
              className="h-auto py-3 flex flex-col items-start text-left whitespace-normal"
            >
              <span className="font-display text-lg">{c.label}</span>
              <span className="text-[11px] opacity-80 font-normal">{c.blurb}</span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
