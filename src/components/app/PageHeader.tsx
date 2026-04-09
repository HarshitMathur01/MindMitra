import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
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
  title,
  description,
  icon,
  actions,
  className,
  ...props
}: PageHeaderProps) => {
  return (
    <div
      className={cn("flex items-start justify-between gap-4 mb-6", className)}
      {...props}
    >
      <div className="space-y-1 min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          {icon && (
            <span className="shrink-0 text-primary">{icon}</span>
          )}
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground leading-6">{description}</p>
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
