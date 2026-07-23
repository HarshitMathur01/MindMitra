import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onResolve: (r: { success: boolean }) => void;
}

/** Stop a moving needle inside the green zone. */
export function CanteenGame({ open, onResolve }: Props) {
  const [pos, setPos] = useState(0); // 0..100
  const [done, setDone] = useState(false);
  const raf = useRef<number | null>(null);
  const dir = useRef(1);
  // Mirrors `done` for the 5s fail timeout — its closure is created once on
  // open and would otherwise read stale state and double-resolve.
  const doneRef = useRef(false);

  // sweet spot 42..58
  const zone = { start: 42, end: 58 };

  useEffect(() => {
    if (!open) return;
    setDone(false);
    doneRef.current = false;
    setPos(0);
    dir.current = 1;
    const tick = () => {
      setPos((p) => {
        let n = p + dir.current * 1.6;
        if (n > 100) { n = 100; dir.current = -1; }
        if (n < 0)   { n = 0;   dir.current = 1; }
        return n;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    const timeout = window.setTimeout(() => finish(false), 5000);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      window.clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function finish(success: boolean) {
    if (doneRef.current) return;
    doneRef.current = true;
    setDone(true);
    if (raf.current) cancelAnimationFrame(raf.current);
    setTimeout(() => onResolve({ success }), 400);
  }

  function stop() {
    finish(pos >= zone.start && pos <= zone.end);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) finish(false); }}>
      <DialogContent className="cl-scope paper-card ornate-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">Canteen Haggle</DialogTitle>
          <DialogDescription>
            Stop the needle in the green zone to talk down the bill. Closing counts as a miss.
          </DialogDescription>
        </DialogHeader>
        <div className="relative h-8 w-full bg-muted rounded-sm overflow-hidden border border-border">
          <div
            className="absolute top-0 bottom-0 bg-accent/40"
            style={{ left: `${zone.start}%`, width: `${zone.end - zone.start}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-1 bg-primary"
            style={{ left: `${pos}%`, transition: "left 16ms linear" }}
          />
        </div>
        <Button onClick={stop} disabled={done} className="font-display tracking-wide">
          Lock the price
        </Button>
      </DialogContent>
    </Dialog>
  );
}
