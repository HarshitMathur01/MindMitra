import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
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

export default function SanctuaryHome() {
  const { user } = useAuth();
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

  return (
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
  );
}
