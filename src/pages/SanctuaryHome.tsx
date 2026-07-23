import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useLocalizedT } from "@/hooks/useLocalizedT";
import { useSnapshot } from "@/hooks/useSnapshot";
import Footer from "@/components/layout/Footer";
import heroMorningImg from "@/assets/sanctuary/hero-morning.jpg";
import sceneWindowImg from "@/assets/sanctuary/scene-window.jpg";
import sceneHillsImg from "@/assets/sanctuary/scene-hills.jpg";
import sceneTreeMountainImg from "@/assets/sanctuary/scene-tree-mountain.jpg";
import sceneFireflyImg from "@/assets/sanctuary/scene-firefly.jpg";
import { PaperGrain } from "@/components/sanctuary/PaperGrain";
import { SanctuaryHeader } from "@/components/sanctuary/SanctuaryHeader";
import { SceneSection } from "@/components/sanctuary/scene/SceneSection";
import { SceneHeading } from "@/components/sanctuary/scene/SceneHeading";
import { HeroPanel } from "@/components/sanctuary/HeroPanel";
import { MoodPulse } from "@/components/sanctuary/MoodPulse";
import { InnerWeather } from "@/components/sanctuary/InnerWeather";
import { SoundscapeBar } from "@/components/sanctuary/SoundscapeBar";
import { ResumeCard } from "@/components/sanctuary/ResumeCard";
import { ConstellationMap } from "@/components/sanctuary/ConstellationMap";
import { DoorsGrid } from "@/components/sanctuary/DoorsGrid";
import { MicroPracticeCard } from "@/components/sanctuary/MicroPracticeCard";
import { GuidedVideoCard } from "@/components/sanctuary/GuidedVideoCard";
import { WhisperWall } from "@/components/sanctuary/WhisperWall";
import { ReflectionBlock } from "@/components/sanctuary/ReflectionBlock";
import { SafetyStrip } from "@/components/sanctuary/SafetyStrip";
import { MitraOrb } from "@/components/sanctuary/MitraOrb";
import { AmbienceProvider } from "@/components/sanctuary/AmbienceProvider";

/**
 * The authenticated landing page as a five-scene scroll:
 * arrival → check-in → doors → practice → reflect/safety.
 * Each SceneSection owns its watercolor backdrop, ambience tint, and
 * parallax; scroll stays native throughout.
 */
export default function SanctuaryHome() {
  // Mount the localized translator at the page root so the language
  // preference resolves once and propagates to every child via react-i18next.
  useLocalizedT();
  const { t } = useTranslation("sanctuary");
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

          <SceneSection
            id="arrival"
            image={heroMorningImg}
            imageWidth={1920}
            imageHeight={1080}
            ariaLabel={t("scenes.arrival.aria")}
            priority
          >
            <HeroPanel name={firstName} />
            <SoundscapeBar />
            {canResume && <ResumeCard />}
          </SceneSection>

          <SceneSection
            id="checkin"
            image={sceneWindowImg}
            imageWidth={1024}
            imageHeight={1024}
            ariaLabel={t("scenes.checkin.aria")}
            parallaxIntensity={0.8}
          >
            <SceneHeading
              eyebrow={t("scenes.checkin.eyebrow")}
              heading={t("scenes.checkin.heading")}
              headingId="checkin-heading"
            />
            <MoodPulse />
            <InnerWeather />
            <ConstellationMap />
          </SceneSection>

          <SceneSection
            id="doors"
            image={sceneHillsImg}
            imageWidth={1600}
            imageHeight={900}
            ariaLabel={t("scenes.doors.aria")}
            minH="auto"
            parallaxIntensity={0.6}
          >
            <DoorsGrid />
          </SceneSection>

          <SceneSection
            id="practice"
            image={sceneTreeMountainImg}
            imageWidth={1024}
            imageHeight={1024}
            ariaLabel={t("scenes.practice.aria")}
            parallaxIntensity={0.8}
          >
            <MicroPracticeCard />
            <GuidedVideoCard />
          </SceneSection>

          <SceneSection
            id="reflect"
            image={sceneFireflyImg}
            imageWidth={1024}
            imageHeight={1024}
            ariaLabel={t("scenes.reflect.aria")}
            align="center"
          >
            <WhisperWall />
            <ReflectionBlock />
            <SafetyStrip />
          </SceneSection>

          <Footer />
        </div>
        <MitraOrb />
      </main>
    </AmbienceProvider>
  );
}
