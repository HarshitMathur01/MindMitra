import { cn } from "@/lib/utils";

/** Shared chrome for profile + settings sections (matches signed-in dashboard cards). */
export const profileSectionCard = cn(
  "rounded-[1.75rem] border border-ink-3/40 bg-[hsl(var(--card))] shadow-dashboard-soft",
  "dark:border-ink-3/30 dark:bg-[hsl(var(--ink-2))]"
);

export const profileSectionInner = "p-6 sm:p-8";
