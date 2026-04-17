import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.12em] transition-colors duration-quick ease-out-expo",
  {
    variants: {
      variant: {
        default:
          "bg-[hsl(var(--accent-50))] text-[hsl(var(--accent-700))] hover:bg-[hsl(var(--accent-100))]",
        secondary:
          "bg-ink-2 text-ink-7 hover:bg-ink-3",
        outline:
          "border border-ink-4 text-ink-7 hover:border-ink-5",
        destructive:
          "bg-[hsl(var(--bad-500)/0.1)] text-[hsl(var(--bad-500))]",
        success:
          "bg-[hsl(var(--ok-500)/0.1)] text-[hsl(var(--ok-500))]",
        ink: "bg-ink-9 text-ink-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
