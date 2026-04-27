import { cn } from "@/lib/utils";
import { WatercolorScene } from "@/components/layout/WatercolorScene";

interface HillsFooterProps {
  /** Optional closing line. Default: a quiet sign-off in Mitra's italic voice. */
  message?: string;
  /** Optional small print under the closing line. */
  smallPrint?: string;
  className?: string;
}

/**
 * Watercolor hills as visual closure. Per the design language,
 * every Quiet Companion page closes with this scene. The hills
 * illustration is decorative; the closing line is what readers
 * actually take away from the page.
 */
export function HillsFooter({ message, smallPrint, className }: HillsFooterProps) {
  return (
    <footer
      className={cn(
        "relative isolate overflow-hidden border-t",
        "border-[color:var(--qc-border)]",
        className,
      )}
    >
      <div className="mx-auto max-w-[1200px] px-6 pt-20 pb-8 text-center sm:px-8 sm:pt-24 sm:pb-12">
        <p className="qc-display mitra-voice mx-auto max-w-[28ch] text-2xl text-[color:var(--qc-ink-soft)] sm:text-3xl">
          {message ?? "rest now. tomorrow finds you here."}
        </p>
        {smallPrint && (
          <p className="mt-6 text-xs tracking-wide text-[color:var(--qc-ink-muted)]">
            {smallPrint}
          </p>
        )}
      </div>

      {/* Hills scene — ambient closure. The image is heavy at first
          paint; lazy load is fine since this is below the fold. */}
      <div aria-hidden className="pointer-events-none mx-auto -mt-2 max-w-[1600px] opacity-90">
        <WatercolorScene name="hills" maxRenderedWidth={1600} loading="lazy" />
      </div>
    </footer>
  );
}

export default HillsFooter;
