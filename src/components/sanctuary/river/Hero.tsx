import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
// `lucide-react` resolves to src/lib/lucide-react.ts, a hand-curated re-export
// that keeps the icon bundle small. Icons must be added there before use.
import { Mic, ArrowUpRight, Lock, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { RiverImage } from "./RiverImage";
import { RIVER_MOODS, greetingForHour } from "./moods";
// The scene→image table lives in scene.ts because the `<head>` preload names
// the same file before this component exists. See scene.ts.
import { HERO_SCENE_IMAGE, HERO_SIZES, type TimeScene } from "./scene";

interface HeroProps {
  firstName: string;
  companionName: string;
  /** Index into MOOD_LABELS, or null when today has no log yet. */
  moodIndex: number | null;
  onMoodSelect: (index: number) => void;
  /** e.g. "23 check-ins" — descriptive, never a streak. */
  checkInLine: string;
  /** Owned by the page root, which also stamps it as `data-nr-scene`. */
  scene: TimeScene;
  hour: number;
}

/**
 * Arrival. The same hillside, repainted for the hour the user arrives.
 *
 * Two departures from the design source, both deliberate:
 *
 *  1. It renders ONE scene, not all four cross-faded. The original mounted
 *     every landscape and animated opacity between them, which downloads four
 *     images to show one. The hour only changes while the page is open in the
 *     rare case someone sits on it across a boundary; a swap is fine there.
 *  2. The mood dots write through to `mood_logs` via `onMoodSelect`, so the
 *     tap is a real check-in that ambience, the constellation and the weekly
 *     trend all read back — not page-local state.
 *
 * All copy here uses `nr-hero-*`, never the page foreground. The backdrop is a
 * photograph that changes with the hour, and the page's own text colour is not
 * legible on all four — see the measured table in river.css.
 */
export function Hero({
  firstName,
  companionName,
  moodIndex,
  onMoodSelect,
  checkInLine,
  scene,
  hour,
}: HeroProps) {
  const [today, setToday] = useState("");

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("en-GB", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    );
  }, []);

  const greeting = greetingForHour(hour);
  const selected = moodIndex == null ? null : RIVER_MOODS[moodIndex];
  const image = HERO_SCENE_IMAGE[scene];

  return (
    <section
      id="top"
      className="relative overflow-hidden px-6 pt-36 pb-20 md:px-10 lg:pt-44 lg:pb-28"
    >
      {/* Moon haze over dark water */}
      <div
        aria-hidden
        className="nr-anim-breathe nr-parallax-soft pointer-events-none absolute -top-40 left-1/2 size-[34rem] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "color-mix(in oklab, var(--nr-mood) 26%, transparent)" }}
      />
      <div
        aria-hidden
        className="nr-anim-drift nr-parallax-slow pointer-events-none absolute -top-24 left-1/2 size-[22rem] -translate-x-1/2 rounded-full opacity-50 blur-2xl"
        style={{ background: "color-mix(in oklab, var(--nr-lavender) 34%, transparent)" }}
      />

      {/* Watercolour landscape — sits behind the text and fades into the page */}
      <div
        aria-hidden
        className="nr-parallax-fade pointer-events-none absolute inset-0 z-0 opacity-85"
        style={{
          maskImage:
            "linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,1) 25%, rgba(0,0,0,1) 60%, rgba(0,0,0,0.7) 80%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,1) 25%, rgba(0,0,0,1) 60%, rgba(0,0,0,0.7) 80%, transparent 100%)",
        }}
      >
        <RiverImage
          name={image.name}
          alt={image.alt}
          sizes={HERO_SIZES}
          priority
          className="absolute inset-0 size-full object-cover object-center"
        />
      </div>
      <div
        aria-hidden
        className="absolute inset-0 z-0 bg-gradient-to-b from-nr-bg/80 via-nr-bg/25 to-nr-bg/90"
      />
      {/*
        Contrast veil. Zero for most (theme x scene) pairs; only the ones whose
        measured contrast was marginal get a wash, and its colour is whichever
        direction pushes the band away from the chosen text colour.
      */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 transition-opacity duration-[1600ms]"
        style={{
          background: "var(--nr-hero-veil-color)",
          opacity: "var(--nr-hero-veil)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-4xl text-center text-nr-hero-fg transition-colors duration-[1600ms]">
        <p className="nr-label nr-hero-label">
          {greeting}
          {today ? ` · ${today}` : ""}
        </p>

        {/* `nr-hero-title` overrides the inherited hero colour with the
            near-black/near-white variant plus its halo — the headline is the
            one element large enough to be broken by the photograph's local
            extremes rather than its average. See river.css. */}
        <h1 className="nr-hero-title mt-6 text-balance font-nr-display text-5xl italic leading-[1.02] transition-colors duration-[1600ms] md:text-7xl lg:text-8xl">
          {greeting}, {firstName}.
        </h1>

        <p className="nr-hero-ink mx-auto mt-7 max-w-2xl text-xl font-normal leading-relaxed md:text-[1.375rem]">
          The river of your mind is settling. {checkInLine} — none of them scored, ranked or
          shared.
        </p>

        <div className="mt-14">
          <p className="nr-label nr-hero-label">
            {firstName} — how does the water feel today?
          </p>
          <div className="mt-7 flex flex-wrap items-start justify-center gap-5 md:gap-7">
            {RIVER_MOODS.map((m) => {
              const active = moodIndex === m.index;
              return (
                <button
                  key={m.label}
                  type="button"
                  onClick={() => onMoodSelect(m.index)}
                  aria-pressed={active}
                  className="group flex flex-col items-center gap-3"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-12 rounded-full border transition-all duration-700",
                      active
                        ? "scale-110 border-transparent"
                        : "border-nr-hero-border group-hover:scale-105",
                    )}
                    style={{
                      background: active
                        ? m.accent
                        : `color-mix(in oklab, ${m.accent} 55%, transparent)`,
                      boxShadow: active
                        ? `0 0 28px color-mix(in oklab, ${m.accent} 45%, transparent)`
                        : `0 0 18px color-mix(in oklab, ${m.accent} 22%, transparent)`,
                    }}
                  />
                  <span
                    data-active={active ? "true" : "false"}
                    className="nr-label nr-hero-label transition-opacity duration-500"
                  >
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            // Keyed on the mood so the reveal transition replays on each tap —
            // the copy change is the reward for the check-in.
            key={selected?.label ?? "empty"}
            className="nr-reveal nr-reveal-in mx-auto mt-10 max-w-xl border-y border-nr-hero-border py-7"
            aria-live="polite"
          >
            <p className="font-nr-display text-2xl italic leading-snug md:text-3xl">
              {selected
                ? selected.note
                : `no wrong answer, ${firstName} — pick the closest one and we'll take it from there.`}
            </p>
            <p className="mt-3 text-sm text-nr-hero-muted">
              {selected
                ? `${companionName} has lined up a two-minute door for that.`
                : "only you ever see this."}
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/chat"
            data-prefetch="/chat"
            className="group inline-flex items-center gap-3 rounded-full bg-nr-ink py-3.5 pl-3.5 pr-6 text-nr-paper transition-all duration-700 hover:gap-4"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-nr-paper/15">
              <Mic className="size-3.5" />
            </span>
            <span className="text-sm font-medium tracking-wide">Talk it out with {companionName}</span>
          </Link>
          <a
            href="#practice"
            className="inline-flex items-center gap-2 rounded-full border border-nr-hero-border px-6 py-3.5 text-sm font-medium tracking-wide text-nr-hero-fg transition-colors duration-700 hover:border-nr-mood"
          >
            Try the 2-minute reset
            <ArrowUpRight className="size-4" />
          </a>
        </div>

        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs text-nr-hero-muted">
          <li className="flex items-center gap-2">
            <Lock className="size-3.5" aria-hidden /> Private to {firstName}
          </li>
          <li className="flex items-center gap-2">
            <Clock className="size-3.5" aria-hidden /> First relief in under 2 minutes
          </li>
          <li>Student plan · free</li>
        </ul>
      </div>
    </section>
  );
}
