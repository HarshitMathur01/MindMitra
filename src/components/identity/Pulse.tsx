import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { BREATH_PERIOD_MS } from "@/lib/redesign/tokens";

/**
 * Pulse — MindMitra's signature presence mark.
 *
 * A slowly breathing orb at ~6 BPM (resonant breathing). It is the
 * single motion identity used across landing hero, auth focal point,
 * chat empty state, "thinking" indicator, and dashboard greeting.
 *
 * Implementation:
 *   - Pure SVG + CSS animations (no framer-motion runtime cost)
 *   - Respects `prefers-reduced-motion` via the global rule in index.css
 *     (animation-duration is forced to 0.01ms, leaving a static halo)
 *   - All color is token-driven so light/dark themes follow automatically
 */

export type PulseState = "idle" | "listening" | "thinking" | "warm";

export interface PulseProps {
  /** Pixel diameter of the outer orb. */
  size?: number;
  state?: PulseState;
  /** 0..1 — overall opacity intensity of decorative rings. */
  intensity?: number;
  className?: string;
  /** When true, renders the orb without aria-hidden so it can be labeled. */
  interactive?: boolean;
  label?: string;
}

const PulseImpl = ({
  size = 160,
  state = "idle",
  intensity = 1,
  className,
  interactive = false,
  label,
}: PulseProps) => {
  const period = useMemo(() => {
    switch (state) {
      case "thinking":
        return Math.round(BREATH_PERIOD_MS * 0.45);
      case "listening":
        return Math.round(BREATH_PERIOD_MS * 0.7);
      case "warm":
      case "idle":
      default:
        return BREATH_PERIOD_MS;
    }
  }, [state]);

  const ringClass = state === "warm" ? "pulse-ring-warm" : "pulse-ring";
  const coreClass = state === "warm" ? "pulse-core-warm" : "pulse-core";

  const styleVars = {
    "--pulse-size": `${size}px`,
    "--pulse-period": `${period}ms`,
    "--pulse-intensity": `${Math.max(0, Math.min(1, intensity))}`,
  } as React.CSSProperties;

  return (
    <div
      className={cn("pulse-root", className)}
      style={styleVars}
      role={interactive ? "img" : undefined}
      aria-hidden={interactive ? undefined : true}
      aria-label={interactive ? label ?? "MindMitra presence" : undefined}
    >
      <span className={cn("pulse-ring-base", ringClass, "pulse-delay-0")} />
      <span className={cn("pulse-ring-base", ringClass, "pulse-delay-1")} />
      <span className={cn("pulse-ring-base", ringClass, "pulse-delay-2")} />
      <span className={cn("pulse-core-base", coreClass)} />
    </div>
  );
};

export const Pulse = memo(PulseImpl);
Pulse.displayName = "Pulse";

export default Pulse;
