import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-md bg-ink-1 px-3.5 py-2 text-[15px] text-ink-8",
          "border border-ink-4",
          "transition-[border-color,box-shadow] duration-quick ease-out-expo",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink-8",
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
Input.displayName = "Input";

export { Input };
