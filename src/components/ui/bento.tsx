import * as React from "react";
import { cn } from "@/lib/utils";

type BentoGridProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Asymmetric bento grid container. Uses a 12-column base with a
 * dense auto-flow so children of varying span sizes pack naturally.
 * Callers apply `col-span-*` and `row-span-*` to individual cells.
 */
export function BentoGrid({ className, ...props }: BentoGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-6 md:grid-cols-12 md:gap-5 lg:gap-6",
        "[grid-auto-flow:dense] [grid-auto-rows:minmax(140px,auto)]",
        className
      )}
      {...props}
    />
  );
}

type BentoCellProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Visual variant — defaults to a standard surface card. */
  variant?: "default" | "accent" | "ink" | "ghost";
  /** Optional tonal span of columns on md+; lets you override via className. */
  span?: 3 | 4 | 6 | 8 | 12;
};

const variantStyles: Record<NonNullable<BentoCellProps["variant"]>, string> = {
  default: "bg-ink-1 border border-ink-3 text-ink-8",
  accent:
    "bg-[hsl(var(--accent-50))] border border-[hsl(var(--accent-100))] text-[hsl(var(--accent-700))]",
  ink: "bg-ink-9 border border-ink-8 text-ink-0",
  ghost: "bg-transparent border border-ink-3 text-ink-8",
};

const spanStyles: Record<NonNullable<BentoCellProps["span"]>, string> = {
  3: "md:col-span-3",
  4: "md:col-span-4",
  6: "md:col-span-6",
  8: "md:col-span-8",
  12: "md:col-span-12",
};

/**
 * Bento grid cell. Designed to allow content to breathe; avoid
 * cramming multiple media elements inside a single cell.
 */
export function BentoCell({
  className,
  variant = "default",
  span,
  ...props
}: BentoCellProps) {
  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl p-6 transition-[transform,box-shadow] duration-base ease-out-expo",
        "hover:-translate-y-[2px] hover:shadow-card",
        variantStyles[variant],
        span ? spanStyles[span] : undefined,
        className
      )}
      {...props}
    />
  );
}
