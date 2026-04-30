import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { WatercolorScene } from "@/components/layout/WatercolorScene";
import { ROUND_THE_CLOCK_HELPLINE, helplineHref } from "@/lib/helplines";

interface HillsFooterProps {
  /** Optional closing line. Default: a quiet sign-off in Mitra's italic voice. */
  message?: string;
  /** Optional small print under the closing line. */
  smallPrint?: string;
  /** Render a sparse line of essential links above the hills scene.
   *  Default true — every QC page wants a discoverable privacy /
   *  helpline anchor without giving up the calm closure. */
  withLinks?: boolean;
  /** Hills scene shown as visual closure. Default `hills`; pages that
   *  prefer the grander variant can pass `mountain`. */
  scene?: "hills" | "mountain" | "companions";
  className?: string;
}

const FOOTER_LINKS: { label: string; to: string }[] = [
  { label: "Privacy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
  { label: "Safety plan", to: "/safety-plan" },
  { label: "Resources", to: "/psychological-content" },
];

/**
 * Watercolor hills as visual closure. Per the design language,
 * every Quiet Companion page closes with this scene. The hills
 * illustration is decorative; the closing line is what readers
 * actually take away from the page.
 */
export function HillsFooter({
  message,
  smallPrint,
  withLinks = true,
  scene = "hills",
  className,
}: HillsFooterProps) {
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

        {withLinks && (
          <nav
            aria-label="Footer"
            className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-[color:var(--qc-ink-muted)]"
          >
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="transition-colors hover:text-[color:var(--qc-ink)]"
              >
                {link.label}
              </Link>
            ))}
            <a
              href={helplineHref(ROUND_THE_CLOCK_HELPLINE)}
              className="transition-colors hover:text-[color:var(--qc-forest)]"
            >
              {ROUND_THE_CLOCK_HELPLINE.name} · {ROUND_THE_CLOCK_HELPLINE.display}
            </a>
          </nav>
        )}
      </div>

      {/* Hills scene — ambient closure. The image is heavy at first
          paint; lazy load is fine since this is below the fold. */}
      <div aria-hidden className="pointer-events-none mx-auto -mt-2 max-w-[1600px] opacity-90">
        <WatercolorScene name={scene} maxRenderedWidth={1600} loading="lazy" />
      </div>
    </footer>
  );
}

export default HillsFooter;
