import * as React from "react";
import { cn } from "@/lib/utils";
import Header from "@/components/layout/Header";

interface AppShellProps {
  /** Additional classes on the root wrapper */
  className?: string;
  children: React.ReactNode;
  /** When true, hides the global Header (e.g. full-screen chat, modals) */
  hideHeader?: boolean;
  /**
   * Visual surface system. Defaults to `quiet-companion`, which paints
   * the warm cream canvas and sets shadcn primitives to QC tokens via
   * the bridge in `src/index.css`. Pass `sanctuary` for legacy pages
   * (chat, MindGym tools) that own their own background.
   */
  surface?: "quiet-companion" | "sanctuary";
}

/**
 * Top-level page shell: Header + scrollable body area.
 * All authenticated pages should be wrapped in this.
 *
 * Usage:
 *   <AppShell>
 *     <PageContainer>…</PageContainer>
 *   </AppShell>
 */
const AppShell = ({
  className,
  children,
  hideHeader = false,
  surface = "quiet-companion",
}: AppShellProps) => {
  const isQc = surface === "quiet-companion";
  return (
    <div
      className={cn(
        "min-h-screen transition-colors duration-300",
        isQc ? "qc-canvas" : "bg-background text-foreground",
        className,
      )}
    >
      {!hideHeader && <Header />}
      {children}
    </div>
  );
};

AppShell.displayName = "AppShell";

export { AppShell };
