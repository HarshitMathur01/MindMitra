import * as React from "react";
import { useLocation } from "react-router-dom";
import { trackProductEvent } from "@/lib/productAnalytics";

/**
 * Route-level product analytics. Mounted inside BrowserRouter (App.tsx) so
 * useLocation is available. Emits one `page_viewed` event per pathname
 * change. Only the pathname is sent — never query strings or hashes, which
 * carry reset tokens and OAuth codes.
 */

/** Collapse user-specific dynamic segments so properties stay low-cardinality. */
function normalizePath(pathname: string): string {
  // MindGym tool/section slugs are catalog ids and stay as-is; booking ids
  // are per-referral and must not be sent.
  if (pathname.startsWith("/booking/")) return "/booking/:id";
  return pathname;
}

export const ProductAnalyticsProvider = ({ children }: { children: React.ReactNode }) => {
  const { pathname } = useLocation();
  const lastTracked = React.useRef<string | null>(null);

  React.useEffect(() => {
    const path = normalizePath(pathname);
    if (lastTracked.current === path) return;
    lastTracked.current = path;
    trackProductEvent("page_viewed", { path });
  }, [pathname]);

  return <>{children}</>;
};
