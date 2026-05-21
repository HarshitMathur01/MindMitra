import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onResolve: (result: { success: boolean; delta: number }) => void;
}

/**
 * "Proxy Attendance" mini-game.
 * A target letter appears; player must tap it before time runs out.
 * Win  → +12 attendance, Lose → −15 attendance.
 */
export function ProxyGame({ open, onResolve }: Props) {
  const [target, setTarget] = useState("A");
  const [time, setTime] = useState(3.0);
  const [done, setDone] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setDone(false);
    setTime(3.0);
    setTarget(String.fromCharCode(65 + Math.floor(Math.random() * 8)));
    const start = performance.now();
    const tick = () => {
      const elapsed = (performance.now() - start) / 1000;
      const left = Math.max(0, 3 - elapsed);
      setTime(left);
      if (left <= 0) {
        finish(false);
        return;
      }
      timer.current = requestAnimationFrame(tick);
    };
    timer.current = requestAnimationFrame(tick);
    return () => {
      if (timer.current) cancelAnimationFrame(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function finish(success: boolean) {
    if (done) return;
    setDone(true);
    if (timer.current) cancelAnimationFrame(timer.current);
    setTimeout(() => onResolve({ success, delta: success ? 12 : -15 }), 450);
  }

  const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];

  return (
    <Dialog open={open}>
      <DialogContent className="cl-scope paper-card ornate-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">Proxy Attendance!</DialogTitle>
          <DialogDescription>
            Tap your name letter before the register closes. Miss → professor catches you.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Target letter</p>
          <p className="font-display text-3xl text-primary">{target}</p>
        </div>
        <div className="h-2 w-full bg-muted overflow-hidden rounded-sm">
          <div
            className="h-full bg-primary transition-[width] duration-100"
            style={{ width: `${(time / 3) * 100}%` }}
          />
        </div>
        <div className="grid grid-cols-4 gap-2 pt-2">
          {letters.map((l) => (
            <Button
              key={l}
              variant={l === target ? "default" : "secondary"}
              onClick={() => finish(l === target)}
              disabled={done}
              className="font-display text-xl h-12"
            >
              {l}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
