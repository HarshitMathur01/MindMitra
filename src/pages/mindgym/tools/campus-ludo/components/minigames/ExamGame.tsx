import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onResolve: (r: { success: boolean }) => void;
}

const SUBJECTS = ["📐", "🧪", "📖", "💻", "🔬", "📝"];

/** Simon-says: watch the sequence, replay it. */
export function ExamGame({ open, onResolve }: Props) {
  const [seq, setSeq] = useState<number[]>([]);
  const [showIdx, setShowIdx] = useState(-1); // -1 = input phase
  const [input, setInput] = useState<number[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    const len = 4;
    const s = Array.from({ length: len }, () => Math.floor(Math.random() * SUBJECTS.length));
    setSeq(s);
    setInput([]);
    setDone(false);
    setShowIdx(0);
    let i = 0;
    const interval = window.setInterval(() => {
      i++;
      if (i >= s.length) {
        window.clearInterval(interval);
        window.setTimeout(() => setShowIdx(-1), 600);
      } else {
        setShowIdx(i);
      }
    }, 700);
    return () => window.clearInterval(interval);
  }, [open]);

  function finish(success: boolean) {
    if (done) return;
    setDone(true);
    setTimeout(() => onResolve({ success }), 400);
  }

  function tap(idx: number) {
    if (showIdx !== -1 || done) return;
    const next = [...input, idx];
    if (next[next.length - 1] !== seq[next.length - 1]) {
      finish(false);
      return;
    }
    setInput(next);
    if (next.length === seq.length) {
      finish(true);
    }
  }

  const showing = showIdx !== -1;

  // The board waits on this dialog — don't let a stalled input phase block
  // every other player's turn forever.
  useEffect(() => {
    if (!open || showing || done) return;
    const t = window.setTimeout(() => finish(false), 12000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, showing, done]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) finish(false); }}>
      <DialogContent className="cl-scope paper-card ornate-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">Exam Cram</DialogTitle>
          <DialogDescription>
            {showing ? "Memorise the sequence…" : "Tap the subjects in the same order. Closing counts as a miss."}
          </DialogDescription>
        </DialogHeader>
        <div className="h-16 flex items-center justify-center font-display text-5xl">
          {showing ? SUBJECTS[seq[showIdx]] : `${input.length} / ${seq.length}`}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {SUBJECTS.map((s, i) => (
            <Button
              key={i}
              variant="secondary"
              onClick={() => tap(i)}
              disabled={showing || done}
              className="h-14 text-2xl"
            >
              {s}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
