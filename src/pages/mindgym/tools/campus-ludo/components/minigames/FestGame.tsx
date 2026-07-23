import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onResolve: (r: { success: boolean }) => void;
}

/** Tap on the beat 4 times. Hits inside the pulse window count. */
export function FestGame({ open, onResolve }: Props) {
  const [beat, setBeat] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [pulse, setPulse] = useState(false);
  const [done, setDone] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const pulseAt = useRef<number>(0);
  // Refs mirror `done`/`hits` for the timer callbacks — their closures are
  // created once on open and would otherwise read stale state (the beat-4
  // finish used to see hits=0 forever).
  const doneRef = useRef(false);
  const hitsRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    setBeat(0); setHits(0); setMisses(0); setDone(false);
    doneRef.current = false;
    hitsRef.current = 0;
    const BEATS = 4;
    const PERIOD = 700;
    let b = 0;
    const start = performance.now();
    pulseAt.current = start;
    setPulse(true);
    window.setTimeout(() => setPulse(false), 200);
    intervalRef.current = window.setInterval(() => {
      b++;
      pulseAt.current = performance.now();
      setBeat(b);
      setPulse(true);
      window.setTimeout(() => setPulse(false), 200);
      if (b >= BEATS) {
        if (intervalRef.current) window.clearInterval(intervalRef.current);
        window.setTimeout(() => finish(), 500);
      }
    }, PERIOD);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function tap() {
    if (doneRef.current) return;
    const dt = Math.abs(performance.now() - pulseAt.current);
    if (dt < 220) { hitsRef.current += 1; setHits((h) => h + 1); }
    else setMisses((m) => m + 1);
  }

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    setDone(true);
    setTimeout(() => onResolve({ success: hitsRef.current >= 3 }), 350);
  }

  function forfeit() {
    if (doneRef.current) return;
    doneRef.current = true;
    setDone(true);
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    setTimeout(() => onResolve({ success: false }), 350);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) forfeit(); }}>
      <DialogContent className="cl-scope paper-card ornate-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">Fest Rhythm Tap</DialogTitle>
          <DialogDescription>
            Tap on every beat. Hit 3 of 4 to nail the performance. Closing counts as a miss.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center py-4">
          <div
            className={`h-24 w-24 rounded-full border-4 border-primary flex items-center justify-center font-display text-3xl transition-all duration-150 ${
              pulse ? "bg-primary/30 scale-110" : "bg-primary/5 scale-100"
            }`}
          >
            🎤
          </div>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Beat {Math.min(beat + 1, 4)} / 4</span>
          <span>Hits: {hits} · Misses: {misses}</span>
        </div>
        <Button onClick={tap} disabled={done} className="font-display tracking-wide h-14 text-xl">
          TAP
        </Button>
      </DialogContent>
    </Dialog>
  );
}
