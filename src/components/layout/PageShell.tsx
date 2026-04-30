import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * PageShell — consistent vertical rhythm wrapper used by redesigned
 * surfaces (landing, auth, dashboard, resources, mind gym hub).
 *
 * Responsibilities:
 *   - Reserve space below the fixed glass header
 *   - Constrain content to the standard page width
 *   - Provide consistent horizontal gutter at every breakpoint
 *
 * Intentionally does NOT inject background, prose styles, or motion;
 * those are surface-specific.
 */

export type PageShellTone = "page" | "raised" | "transparent";
export type PageShellSurface = "quiet-companion" | "sanctuary";

export interface PageShellProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  /** Reserve top space equal to fixed header height. Default true. */
  withHeaderOffset?: boolean;
  /** Tone of the outer wrapper. Ignored when `surface="quiet-companion"`. Default `page`. */
  tone?: PageShellTone;
  /** Override container max width. Default uses `max-w-page` (1200px). */
  width?: "page" | "wide" | "narrow";
  /** Render as `<main>` (default) or `<div>`. */
  as?: "main" | "div";
  /**
   * Visual surface system:
   *   - `quiet-companion` (default): warm cream canvas, ink colors, Fraunces.
   *     Honours `.qc-canvas` tokens — beats Sanctuary v4 utility classes.
   *   - `sanctuary`: legacy v4 tokens. Used by chat, MindGym tools, and
   *     anything that owns its own background.
   */
  surface?: PageShellSurface;
}

const widthClass: Record<NonNullable<PageShellProps["width"]>, string> = {
  page: "max-w-page",
  wide: "max-w-[1320px]",
  narrow: "max-w-3xl",
};

const toneClass: Record<PageShellTone, string> = {
  page: "bg-background",
  raised: "bg-[hsl(var(--ink-1))]",
  transparent: "",
};

export const PageShell = forwardRef<HTMLElement, PageShellProps>(
  (
    {
      children,
      withHeaderOffset = true,
      tone = "page",
      width = "page",
      as = "main",
      surface = "quiet-companion",
      className,
      ...rest
    },
    ref,
  ) => {
    const Tag = as as "main";
    const isQc = surface === "quiet-companion";
    return (
      <Tag
        ref={ref as React.Ref<HTMLElement>}
        className={cn(
          "min-h-screen w-full",
          isQc ? "qc-canvas" : cn("text-foreground", toneClass[tone]),
          withHeaderOffset && "pt-[var(--header-height)]",
          className,
        )}
        {...rest}
      >
        <div
          className={cn(
            "mx-auto w-full px-4 sm:px-6 lg:px-8",
            widthClass[width],
          )}
        >
          {children}
        </div>
      </Tag>
    );
  },
);

PageShell.displayName = "PageShell";

export default PageShell;
