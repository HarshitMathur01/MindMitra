import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Button — "Held" variant set.
 *
 * Principles:
 * - Never pure black. Default = soft sage. `ink` variant is retained
 *   for backward compat but routed to a gentler dark walnut, not pure
 *   black — so a user in crisis never sees a jet-black CTA commanding
 *   them.
 * - No scale on press, no translate-y jitter. Only background shift.
 * - Rounded-full for the softest read; opacity-only hover.
 */
const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-full text-[14.5px] font-medium",
    "transition-[background-color,color,box-shadow] duration-base ease-out-expo",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    "focus-visible:outline-none",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-[hsl(var(--accent-500))] text-primary-foreground",
          "hover:bg-[hsl(var(--accent-600))]",
        ].join(" "),
        primary: [
          "bg-[hsl(var(--accent-500))] text-primary-foreground",
          "hover:bg-[hsl(var(--accent-600))]",
        ].join(" "),
        ink: [
          /* Kept for backward compat — but no longer pure black.
             Reads as a warm walnut, never commanding. */
          "bg-ink-8 text-ink-0",
          "hover:bg-ink-7",
        ].join(" "),
        destructive: [
          "bg-destructive text-destructive-foreground",
          "hover:bg-destructive/90",
        ].join(" "),
        outline: [
          "border border-ink-4 bg-transparent text-ink-7",
          "hover:bg-ink-2 hover:text-ink-8 hover:border-ink-4",
        ].join(" "),
        secondary: [
          "bg-ink-2 text-ink-8",
          "hover:bg-ink-3",
        ].join(" "),
        soft: [
          "bg-[hsl(var(--accent-50))] text-[hsl(var(--accent-700))]",
          "hover:bg-[hsl(var(--accent-100))]",
        ].join(" "),
        warmth: [
          /* Compassion tone — for emotional CTAs like "If you need someone" */
          "bg-[hsl(var(--warmth-100))] text-[hsl(var(--warmth-500))]",
          "hover:bg-[hsl(var(--warmth-200))]",
        ].join(" "),
        ghost: [
          "text-ink-7 hover:bg-ink-2 hover:text-ink-8",
        ].join(" "),
        link: "text-[hsl(var(--accent-500))] underline-offset-4 hover:underline p-0 h-auto rounded-none",
      },
      size: {
        default: "h-11 px-5",
        xs: "h-7 rounded-full px-3 text-xs",
        sm: "h-9 rounded-full px-4",
        lg: "h-12 rounded-full px-6 text-[15px]",
        xl: "h-14 rounded-full px-8 text-[15.5px]",
        icon: "h-10 w-10 rounded-full",
        "icon-sm": "h-8 w-8 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
