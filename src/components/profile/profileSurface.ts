import { cn } from "@/lib/utils";

/**
 * Shared chrome for profile sections, in Quiet Companion style.
 * Renders correctly inside a `qc-canvas` ancestor (Profile page),
 * since it reads --qc-surface and --qc-border vars defined there.
 *
 * `profileSectionCard` is intentionally padding-free so callers
 * compose it with `profileSectionInner` (or a custom padding).
 */
export const profileSectionCard = cn(
  "rounded-3xl border bg-[color:var(--qc-surface)]",
  "border-[color:var(--qc-border)]",
  "shadow-[0_1px_3px_rgba(0,0,0,0.03)]",
);

export const profileSectionInner = "p-8 sm:p-12";
