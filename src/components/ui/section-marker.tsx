import { cn } from "@/lib/utils";

type SectionMarkerProps = {
  /** Kept for backward compat — no longer rendered as a number. */
  num?: string;
  label: string;
  className?: string;
};

/**
 * Section label — sentence-case, soft sage dot.
 * Replaces the old "01 — LISTEN" editorial pattern with something that
 * reads as a quiet note in the margin, not a magazine masthead.
 */
export function SectionMarker({ label, className }: SectionMarkerProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 text-[13px] font-medium text-ink-6",
        className,
      )}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full bg-accent-400/70"
      />
      <span>{label}</span>
    </span>
  );
}
