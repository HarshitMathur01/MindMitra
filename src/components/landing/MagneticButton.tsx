import { useRef, type ReactNode } from "react";
import { motion, type MotionStyle } from "framer-motion";
import { useMagnetic } from "@/hooks/useMagnetic";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { LandingLink } from "./LandingLink";

/**
 * Magnetic CTA with an ink-fill sweep that starts from the pointer's entry
 * point.
 *
 * Reduced-motion audit: magnetic pull, hover scale and sweep are all
 * disabled when `prefers-reduced-motion` is set. The control stays fully
 * interactive as a flat filled button.
 */
type Props = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "ghost";
  className?: string;
  ariaLabel?: string;
};

export function MagneticButton({
  children,
  href,
  onClick,
  variant = "primary",
  className = "",
  ariaLabel,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();
  const { x, y } = useMagnetic(ref, 8, !reduced);

  const isPrimary = variant === "primary";

  const handleEnter = (e: React.PointerEvent) => {
    if (reduced || !sweepRef.current || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * 100;
    const py = ((e.clientY - r.top) / r.height) * 100;
    sweepRef.current.style.setProperty("--px", `${px}%`);
    sweepRef.current.style.setProperty("--py", `${py}%`);
    sweepRef.current.style.willChange = "transform, opacity";
  };
  const handleLeave = () => {
    if (sweepRef.current) sweepRef.current.style.willChange = "";
  };

  const style: MotionStyle = { x, y };

  const inner = (
    <motion.div
      ref={ref}
      style={style}
      whileHover={reduced ? undefined : { scale: 1.03 }}
      transition={{ type: "spring", stiffness: 150, damping: 15 }}
      onPointerEnter={handleEnter}
      onPointerLeave={handleLeave}
      className={`group relative inline-flex select-none items-center justify-center overflow-hidden rounded-full px-8 py-4 text-base font-medium tracking-wide ${
        isPrimary
          ? "bg-terracotta text-cream shadow-[0_10px_30px_-12px_rgba(200,121,79,0.6)]"
          : "border border-forest/25 text-forest transition-colors hover:bg-forest/5"
      } ${className}`}
    >
      {/* Pointer-origin ink sweep */}
      {isPrimary && (
        <span
          ref={sweepRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:group-hover:opacity-0"
          style={{
            background:
              "radial-gradient(circle at var(--px,50%) var(--py,50%), #9E5A38 0%, transparent 55%)",
            mixBlendMode: "multiply",
          }}
        />
      )}
      <span className="relative z-10 flex items-center gap-2 font-deva">
        {children}
      </span>
    </motion.div>
  );

  if (href) {
    return (
      <LandingLink href={href} aria-label={ariaLabel} className="inline-block">
        {inner}
      </LandingLink>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="inline-block"
    >
      {inner}
    </button>
  );
}
