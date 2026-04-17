import * as React from "react";
import { cn } from "@/lib/utils";

type NumberTickerProps = {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Kept for backward compat — no longer used (no count-up). */
  duration?: number;
  className?: string;
};

/**
 * Count-up tickers are a marketing/conversion pattern. In a mental
 * wellness context they create comparison anxiety ("everyone else
 * is being helped, why am I not?"). This component now renders the
 * final value plainly. Existing callsites continue to work.
 */
export function NumberTicker({
  value,
  decimals = 0,
  prefix,
  suffix,
  className,
}: NumberTickerProps) {
  const display = value.toFixed(decimals);
  return (
    <span className={cn("tabular-nums", className)}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
