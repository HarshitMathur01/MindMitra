import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocalizedT } from "@/hooks/useLocalizedT";
import { useSnapshot } from "@/hooks/useSnapshot";
import Footer from "@/components/layout/Footer";
import { PaperGrain } from "@/components/sanctuary/PaperGrain";
import { SanctuaryHeader } from "@/components/sanctuary/SanctuaryHeader";
import { HeroPanel } from "@/components/sanctuary/HeroPanel";
import { InnerWeather } from "@/components/sanctuary/InnerWeather";
import { SoundscapeBar } from "@/components/sanctuary/SoundscapeBar";
import { ResumeCard } from "@/components/sanctuary/ResumeCard";
import { ConstellationMap } from "@/components/sanctuary/ConstellationMap";
import { DoorsGrid } from "@/components/sanctuary/DoorsGrid";
import { MicroPracticeCard } from "@/components/sanctuary/MicroPracticeCard";
import { GuidedVideoCard } from "@/components/sanctuary/GuidedVideoCard";
import { WhisperWall } from "@/components/sanctuary/WhisperWall";
import { ReflectionScene } from "@/components/sanctuary/ReflectionScene";
import { SafetyStrip } from "@/components/sanctuary/SafetyStrip";
import { MitraOrb } from "@/components/sanctuary/MitraOrb";
import { AmbienceProvider } from "@/components/sanctuary/AmbienceProvider";

export default function SanctuaryHome() {
  // Mount the localized translator at the page root so the language
  // preference resolves once and propagates to every child via react-i18next.
  useLocalizedT();
  const { user } = useAuth();
  const { data: snapshot } = useSnapshot();
  const [canResume, setCanResume] = useState(false);

  useEffect(() => {
    setCanResume(!!localStorage.getItem("currentChatSession"));
  }, []);

  const firstName = useMemo(() => {
    const raw =
      user?.user_metadata?.full_name ??
      user?.user_metadata?.name ??
      user?.email?.split("@")[0] ??
      "friend";
    return String(raw)
      .trim()
      .split(/[\s_-]+/)[0]
      .replace(/^./, (c) => c.toUpperCase());
  }, [user]);

  // Ambience switches to the real affect EMA once /me/snapshot returns; on
  // first-visit (no chat history) snapshot is undefined and AmbienceProvider
  // falls back to the Phase 1 MoodPulse + time-of-day path.
  const ambienceSnapshot = useMemo(
    () =>
      snapshot
        ? {
            affectEma: snapshot.affect_ema,
            recentCrisisFlag: snapshot.recent_crisis_flag,
            longitudinalRiskFlag: snapshot.longitudinal_risk_flag,
          }
        : undefined,
    [snapshot],
  );

  return (
    <AmbienceProvider snapshot={ambienceSnapshot}>
      <main
        className="relative min-h-screen w-full overflow-x-hidden"
        style={{ backgroundColor: "var(--paper-soft)" }}
      >
        <PaperGrain />
        <div className="relative z-10">
          <SanctuaryHeader name={firstName} />
          <HeroPanel name={firstName} />
          <InnerWeather />
          <div className="mt-6">
            <SoundscapeBar />
          </div>
          {canResume && <ResumeCard />}
          <ConstellationMap />
          <DoorsGrid />
          <MicroPracticeCard />
          <GuidedVideoCard />
          <WhisperWall />
          <ReflectionScene />
          <SafetyStrip />
          <Footer />
        </div>
        <MitraOrb />
      </main>
    </AmbienceProvider>
  );
}
