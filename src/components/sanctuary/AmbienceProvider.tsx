import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useMoodLog } from "@/hooks/useMoodLog";
import {
  computeAmbience,
  type AmbienceState,
} from "@/lib/sanctuary/ambience";

const SanctuaryAmbienceContext = createContext<AmbienceState | null>(null);

interface AmbienceProviderProps {
  children: ReactNode;
  /**
   * Phase 2 hook: when /me/snapshot is wired this provider will accept the
   * snapshot here and pass it into `computeAmbience`. Until then it stays
   * undefined and ambience derives from MoodPulse + time-of-day only.
   */
  snapshot?: {
    affectEma?: { valence: number; arousal: number } | null;
    recentCrisisFlag?: boolean;
    longitudinalRiskFlag?: boolean;
  };
}

export function AmbienceProvider({ children, snapshot }: AmbienceProviderProps) {
  const { todayLog, weekLogs } = useMoodLog();

  const ambience = useMemo(
    () =>
      computeAmbience({
        todayLog,
        weekLogs,
        affectEma: snapshot?.affectEma,
        recentCrisisFlag: snapshot?.recentCrisisFlag,
        longitudinalRiskFlag: snapshot?.longitudinalRiskFlag,
      }),
    [todayLog, weekLogs, snapshot],
  );

  return (
    <SanctuaryAmbienceContext.Provider value={ambience}>
      {children}
    </SanctuaryAmbienceContext.Provider>
  );
}

/**
 * Read the current sanctuary ambience. Returns a sensible neutral default
 * if a component is rendered outside the provider — first-visit and
 * dev-storybook scenarios should never crash on missing context.
 */
export function useAmbience(): AmbienceState {
  const ctx = useContext(SanctuaryAmbienceContext);
  if (ctx) return ctx;
  return {
    valence: 0,
    arousal: 0.4,
    crisisQuiet: false,
    palette: "noon-bright",
    paperWarmth: 1,
    orbHalo:
      "radial-gradient(circle at 35% 30%, color-mix(in oklab, var(--accent-sage) 60%, transparent), transparent 70%)",
    sceneAccent: "var(--accent-sage)",
    valenceBucket: "neutral",
    timeBucket: "afternoon",
  };
}
