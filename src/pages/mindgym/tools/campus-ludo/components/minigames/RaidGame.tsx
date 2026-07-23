import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onResolve: (r: { success: boolean }) => void;
}

/** Pick the door without the warden behind it. */
export function RaidGame({ open, onResolve }: Props) {
  const [warden, setWarden] = useState(0);
  const [done, setDone] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(3);
  // Refs mirror `done`/`picked` for the countdown closure (created once on
  // open) so onResolve can never fire twice from a stale read.
  const doneRef = useRef(false);
  const pickedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setWarden(Math.floor(Math.random() * 3));
    setDone(false);
    setPicked(null);
    setCountdown(3);
    doneRef.current = false;
    pickedRef.current = null;
    const id = window.setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          window.clearInterval(id);
          if (!doneRef.current && pickedRef.current === null) finish(null);
        }
        return c - 1;
      });
    }, 700);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function pick(i: number) {
    if (doneRef.current) return;
    setPicked(i);
    pickedRef.current = i;
    finish(i);
  }

  function finish(i: number | null) {
    if (doneRef.current) return;
    doneRef.current = true;
    setDone(true);
    const success = i !== null && i !== warden;
    setTimeout(() => onResolve({ success }), 600);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) finish(null); }}>
      <DialogContent className="cl-scope paper-card ornate-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">Hostel Raid</DialogTitle>
          <DialogDescription>
            Warden's torch is sweeping. Pick a door to hide behind in {Math.max(0, countdown)}… Closing counts as caught.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 pt-2">
          {[0, 1, 2].map((i) => {
            const reveal = done;
            const isWarden = reveal && i === warden;
            const isSafe = reveal && i !== warden;
            return (
              <Button
                key={i}
                onClick={() => pick(i)}
                disabled={done}
                variant={picked === i ? "default" : "secondary"}
                className={`h-24 text-4xl ${isWarden ? "bg-destructive text-destructive-foreground" : ""} ${isSafe && picked === i ? "bg-accent text-accent-foreground" : ""}`}
              >
                {reveal ? (isWarden ? "🔦" : "✅") : "🚪"}
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
