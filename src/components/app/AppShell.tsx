import * as React from "react";
import { cn } from "@/lib/utils";
import Header from "@/components/layout/Header";

interface AppShellProps {
  /** Additional classes on the root wrapper */
  className?: string;
  children: React.ReactNode;
  /** When true, hides the global Header (e.g. full-screen chat, modals) */
  hideHeader?: boolean;
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
const AppShell = ({ className, children, hideHeader = false }: AppShellProps) => {
  return (
    <div
      className={cn(
        "min-h-screen bg-background text-foreground transition-colors duration-300",
        className
      )}
    >
      {!hideHeader && <Header />}
      {children}
    </div>
  );
};

AppShell.displayName = "AppShell";

export { AppShell };
