import { useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocalizedT } from "@/hooks/useLocalizedT";
import { useMoodLog } from "@/hooks/useMoodLog";
import { usePersonality } from "@/hooks/usePersonality";
import { useSnapshot } from "@/hooks/useSnapshot";
import Footer from "@/components/layout/Footer";
import { AmbienceProvider } from "@/components/sanctuary/AmbienceProvider";
import { MitraOrb } from "@/components/sanctuary/MitraOrb";

import { Nav } from "@/components/sanctuary/river/Nav";
import { Hero } from "@/components/sanctuary/river/Hero";
import { FirstMinute } from "@/components/sanctuary/river/FirstMinute";
import { Doors } from "@/components/sanctuary/river/Doors";
import { Practice } from "@/components/sanctuary/river/Practice";
import { OpenThread } from "@/components/sanctuary/river/OpenThread";
import { Constellation } from "@/components/sanctuary/river/Constellation";
import { CrisisBar } from "@/components/sanctuary/river/CrisisBar";
import { useScrollProgress } from "@/components/sanctuary/river/useScrollProgress";
import { useOpenThread } from "@/components/sanctuary/river/useOpenThread";
import { useTimeScene } from "@/components/sanctuary/river/useTimeScene";
import { moodAccentFor } from "@/components/sanctuary/river/moods";
import "@/components/sanctuary/river/river.css";

/**
 * The authenticated landing — "Night River".
 *
 * A single scroll: arrival → first minute → doors → practice → your thread →
 * safety. Everything below `.mm-river` recolours from one custom property,
 * `--nr-mood`, which is set here from the user's own check-in. Tap a mood dot
 * in the hero and the whole page follows.
 *
 * Scoping matters: `.mm-river` is what keeps this surface's palette, grain and
 * atmosphere off every other route. See river.css.
 */
export default function SanctuaryHome() {
  // Mount the localized translator at the page root so the language preference
  // resolves once and propagates to every child via react-i18next. The crisis
  // rail is the main consumer — its copy exists in all seven locales.
  useLocalizedT();
  useScrollProgress();

  const { user } = useAuth();
  const { companionName } = usePersonality();
  const { weekLogs, todayLog, logMood } = useMoodLog();
  const { data: snapshot } = useSnapshot();
  const thread = useOpenThread();
  const { scene, hour } = useTimeScene();

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

  const initials = useMemo(() => firstName.slice(0, 2).toUpperCase(), [firstName]);

  // Ambience switches to the real affect EMA once /me/snapshot returns; on a
  // first visit snapshot is undefined and AmbienceProvider falls back to the
  // mood-log + time-of-day path.
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

  const moodIndex = todayLog?.mood_index ?? null;

  // The accent is derived from today's logged mood rather than page-local
  // state, so it survives a reload and agrees with what the constellation and
  // the weekly trend are drawing.
  const moodAccent = moodAccentFor(moodIndex);

  const checkInLine = useMemo(() => {
    const total = weekLogs.length;
    if (total === 0) return "No check-ins yet this week";
    return `${total} ${total === 1 ? "check-in" : "check-ins"} this week`;
  }, [weekLogs.length]);

  const handleMoodSelect = useCallback((index: number) => logMood(index), [logMood]);

  return (
    <AmbienceProvider snapshot={ambienceSnapshot}>
      <div
        className="mm-river nr-grain min-h-screen w-full overflow-x-hidden"
        // `data-nr-scene` drives the hero's foreground colour: the backdrop is
        // a photograph that changes with the hour, and no single text colour is
        // legible on all four. See the measured contrast table in river.css.
        data-nr-scene={scene}
        style={{ "--nr-mood": moodAccent } as React.CSSProperties}
      >
        {/* Scroll-driven atmosphere. Light mode only — see river.css. */}
        <div aria-hidden className="nr-atmosphere" />

        <Nav firstName={firstName} initials={initials} context={checkInLine} />

        <main id="main" className="relative z-10">
          <Hero
            firstName={firstName}
            companionName={companionName}
            moodIndex={moodIndex}
            onMoodSelect={handleMoodSelect}
            checkInLine={checkInLine}
            scene={scene}
            hour={hour}
          />

          <div className="space-y-24 py-16 md:space-y-32 lg:py-24">
            <FirstMinute companionName={companionName} />
            <Doors companionName={companionName} />
            <Practice />

            {/*
              The thread card is omitted entirely when there is nothing open,
              rather than rendering an empty prompt — so the constellation goes
              full-width on a first visit instead of sitting next to a hole.
            */}
            <div
              className={
                thread
                  ? "mx-auto grid max-w-6xl gap-5 px-6 lg:grid-cols-[1fr_1.2fr] lg:items-stretch [&>div]:max-w-none [&>div]:px-0"
                  : undefined
              }
            >
              {thread && <OpenThread firstName={firstName} thread={thread} />}
              <Constellation firstName={firstName} weekLogs={weekLogs} />
            </div>
          </div>

          <div className="py-12">
            <CrisisBar />
          </div>

          <Footer />
        </main>

        <MitraOrb />
      </div>
    </AmbienceProvider>
  );
}
