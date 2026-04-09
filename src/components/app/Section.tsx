import * as React from "react";
import { cn } from "@/lib/utils";

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  as?: "section" | "div" | "article";
  /** Section heading — rendered as h2 */
  title?: React.ReactNode;
  /** Helper text below heading */
  description?: React.ReactNode;
  /** Slot for right-side actions */
  actions?: React.ReactNode;
  /**
   * Vertical padding preset.
   * "sm" = py-4, "md" = py-6 (default), "lg" = py-8
   */
  spacing?: "sm" | "md" | "lg";
}

const spacingMap = { sm: "py-4", md: "py-6", lg: "py-8" };

/**
 * Consistent vertical rhythm wrapper for page sections.
 *
 * Usage:
 *   <Section title="Recent activity" description="Your last 7 days.">
 *     ...content
 *   </Section>
 */
const Section = React.forwardRef<HTMLElement, SectionProps>(
  (
    { as: Tag = "section", title, description, actions, spacing = "md", className, children, ...props },
    ref
  ) => {
    return (
      // @ts-expect-error — polymorphic ref
      <Tag
        ref={ref}
        className={cn(spacingMap[spacing], "space-y-4", className)}
        {...props}
      >
        {(title || description || actions) && (
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              {title && (
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-sm text-muted-foreground leading-6">{description}</p>
              )}
            </div>
            {actions && (
              <div className="flex items-center gap-2 shrink-0">{actions}</div>
            )}
          </div>
        )}
        {children}
      </Tag>
    );
  }
);

Section.displayName = "Section";

export { Section };
