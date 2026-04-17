import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Small label above the title (matches dashboard section kickers) */
  kicker?: string;
  /** Primary page title — rendered as h1 */
  title: React.ReactNode;
  /** Muted subtitle rendered below the title */
  description?: React.ReactNode;
  /** Icon placed to the left of the title (optional) */
  icon?: React.ReactNode;
  /** Slot for action buttons on the right */
  actions?: React.ReactNode;
}

/**
 * Standard page header with consistent title/description rhythm.
 *
 * Usage:
 *   <PageHeader title="Settings" description="Customize your experience." actions={<Button>Save</Button>} />
 */
const PageHeader = ({
  kicker,
  title,
  description,
  icon,
  actions,
  className,
  ...props
}: PageHeaderProps) => {
  return (
    <div
      className={cn("mb-8 flex items-start justify-between gap-4 border-b border-ink-3/30 pb-8", className)}
      {...props}
    >
      <div className="min-w-0 space-y-2">
        {kicker ? (
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-5">{kicker}</p>
        ) : null}
        <h1 className="flex items-center gap-2 font-display text-2xl font-normal tracking-tight text-ink-8 sm:text-3xl">
          {icon && (
            <span className="shrink-0 text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]">{icon}</span>
          )}
          {title}
        </h1>
        {description && (
          <p className="max-w-xl text-sm leading-relaxed text-ink-5">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
};

PageHeader.displayName = "PageHeader";

export { PageHeader };
