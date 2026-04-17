import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[84px] w-full rounded-md bg-ink-1 px-3.5 py-2.5 text-[15px] leading-[1.55] text-ink-8",
          "border border-ink-4",
          "transition-[border-color,box-shadow] duration-quick ease-out-expo",
          "placeholder:text-ink-5",
          "hover:border-ink-5",
          "focus-visible:outline-none focus-visible:border-[hsl(var(--accent-400))] focus-visible:shadow-[0_0_0_4px_hsl(var(--accent-400)/0.12)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
