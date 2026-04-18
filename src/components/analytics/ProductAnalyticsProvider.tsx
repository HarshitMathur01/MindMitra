import * as React from "react";

/**
 * Lightweight analytics wrapper — currently a pass-through shell.
 * Replace with a real provider (e.g. PostHog, Amplitude) when ready.
 */
export const ProductAnalyticsProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};
