import * as React from "react";
import { cn } from "@/lib/utils";

type MagneticProps = {
  children: React.ReactNode;
  className?: string;
  /** Kept for backward compat — no longer used. */
  strength?: number;
  /** Kept for backward compat — no longer used. */
  hitPadding?: number;
};

/**
 * Magnetic was an attention-grabbing tech-startup CTA pattern.
 * In a wellness product, the UI should not chase the cursor — it
 * is here to be steady. This component now renders its children
 * unchanged. It is kept only so existing imports do not break.
 */
export function Magnetic({ children, className }: MagneticProps) {
  return <span className={cn("inline-block", className)}>{children}</span>;
}
