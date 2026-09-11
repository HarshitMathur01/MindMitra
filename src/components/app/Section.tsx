import * as React from "react";
import { cn } from "@/lib/utils";

// `title` is omitted from the DOM attributes because this component
// renders it as an <h2>, not as the browser tooltip attribute — which is
// typed `string` and so conflicts with a ReactNode heading.
interface SectionProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
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
    // Widen the intrinsic tag so one forwarded HTMLElement ref satisfies
    // every branch of the `as` union (a <div> ref is typed HTMLDivElement,
    // a <section> ref HTMLElement, and JSX will not unify them).
    const Component = Tag as React.ElementType;
    return (
      <Component
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
      </Component>
    );
  }
);

Section.displayName = "Section";

export { Section };
