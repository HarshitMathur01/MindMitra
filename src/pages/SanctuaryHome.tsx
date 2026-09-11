import { useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocalizedT } from "@/hooks/useLocalizedT";
import { localDayKey, useMoodLog } from "@/hooks/useMoodLog";
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
 * in the greeting and the whole page follows.
 *
 * The arrival section is paper and ink — a two-column greeting and check-in.
 * It replaced a full-bleed hillside photograph that changed with the hour, and
 * the per-scene contrast table, the `<head>` image preload and the parallax
 * layers that backdrop needed went with it.
 *
 * Scoping matters: `.mm-river` is what keeps this surface's palette, grain and
 * atmosphere off every other route. See river.css.
 */
export default function SanctuaryHome() {
  // Mount the localized translator at the page root so the language preference
  // resolves once and propagates to every child via react-i18next. The crisis
  // rail is the main consumer — its copy exists in all seven locales.
  useLocalizedT();

  // The scroll-position custom properties are written to the elements that read
  // them, inside this root — not to <html>. See useScrollProgress.
  const riverRef = useRef<HTMLDivElement>(null);
  useScrollProgress(riverRef);

  const { user } = useAuth();
  const { companionName } = usePersonality();
  const { weekLogs, todayLog, logMood } = useMoodLog();
  const { data: snapshot } = useSnapshot();
  const thread = useOpenThread();
  const { hour } = useTimeScene();

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

  // Yesterday's last check-in, for the greeting's recall line. `weekLogs` is
  // newest-first, so the first match for that day key is the latest one — the
  // same "last log of the day wins" rule the constellation draws by. Null when
  // yesterday has no log, and the greeting then omits the line entirely rather
  // than remarking on the day they skipped.
  const yesterdayIndex = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const key = localDayKey(date);
    const log = weekLogs.find((entry) => localDayKey(new Date(entry.logged_at)) === key);
    return log?.mood_index ?? null;
  }, [weekLogs]);

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
        ref={riverRef}
        className="mm-river nr-grain min-h-screen w-full overflow-x-hidden"
        style={{ "--nr-mood": moodAccent } as React.CSSProperties}
      >
        {/* Scroll-driven atmosphere. Light mode only — see river.css. */}
        <div aria-hidden className="nr-atmosphere" />

        <Nav
          firstName={firstName}
          initials={initials}
          context={checkInLine}
          hasThread={!!thread}
        />

        <main id="main" className="relative z-10">
          <Hero
            firstName={firstName}
            companionName={companionName}
            moodIndex={moodIndex}
            onMoodSelect={handleMoodSelect}
            yesterdayIndex={yesterdayIndex}
            hour={hour}
          />

          <div className="space-y-24 py-16 md:space-y-32 lg:py-24">
            <FirstMinute companionName={companionName} />
            <Doors companionName={companionName} />
            <Practice />

            {thread && <OpenThread firstName={firstName} thread={thread} />}
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
