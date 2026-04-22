import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronRight, Clock } from "lucide-react";
import { type ContentItem, formatCount, formatTypeLabel } from "@/data/psychologicalContent";

interface Props {
  item: ContentItem | null;
  open: boolean;
  onClose: () => void;
}

function ResourceReaderDialogImpl({ item, open, onClose }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [takeawayIndex, setTakeawayIndex] = useState(0);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setProgress(max <= 0 ? 1 : Math.min(1, el.scrollTop / max));
  }, []);

  useEffect(() => {
    if (!open) {
      setProgress(0);
      setTakeawayIndex(0);
      return;
    }
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = 0;
      handleScroll();
    }
  }, [open, item, handleScroll]);

  if (!item) return null;

  const takeaways = item.keyTakeaways;
  const nextInsight = () => setTakeawayIndex((i) => (i + 1) % takeaways.length);
  const paragraphs = item.longDescription.split("\n\n");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <div className="h-1 w-full bg-muted">
          <div
            className="h-full bg-primary transition-[width] duration-150"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <div className="relative h-44 w-full overflow-hidden md:h-56">
          <img
            src={item.image}
            alt=""
            loading="eager"
            decoding="async"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
          <span className="absolute left-5 top-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-card/90 text-2xl shadow-soft backdrop-blur-sm" aria-hidden>
            {item.imageEmoji}
          </span>
        </div>

        <DialogHeader className="space-y-3 border-b border-border bg-gradient-calm p-6 text-left">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                <span>{formatTypeLabel(item.type)}</span>
                <span aria-hidden>•</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {item.duration}
                </span>
              </div>
              <DialogTitle className="font-display text-2xl leading-tight tracking-tight md:text-3xl">
                {item.title}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                MindMitra Care Team — clinically reviewed
              </p>
            </div>
          </div>
        </DialogHeader>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="max-h-[55vh] space-y-5 overflow-y-auto px-6 py-6 text-[15px] leading-relaxed text-foreground/85"
        >
          {paragraphs.map((paragraph, idx) => (
            <p key={idx} className="whitespace-pre-line">
              {paragraph}
            </p>
          ))}

          {takeaways.length > 0 ? (
            <div className="rounded-2xl border border-border bg-secondary/60 p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  One insight
                </span>
                <button
                  type="button"
                  onClick={nextInsight}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Next ({takeawayIndex + 1}/{takeaways.length})
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
              <p className="mt-3 font-display text-lg leading-snug text-foreground">
                {takeaways[takeawayIndex]}
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-card px-6 py-4">
          <span className="text-xs text-muted-foreground">
            {formatCount(item.readCount)} reads · ★ {item.rating.toFixed(1)}
          </span>
          <Button onClick={onClose} variant="default" size="sm">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const ResourceReaderDialog = memo(ResourceReaderDialogImpl);
export default ResourceReaderDialog;