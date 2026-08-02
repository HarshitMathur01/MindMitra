import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Wind, Eye, ArrowRight } from "lucide-react";
import { Reveal } from "./Reveal";
import { RiverImage } from "./RiverImage";
import { useSettings } from "@/hooks/useSettings";
import { useSnapshot } from "@/hooks/useSnapshot";
import { filterWhispers } from "@/lib/sanctuary/whispers";
import { useAmbience } from "@/components/sanctuary/AmbienceProvider";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type { SupportedLanguage } from "@/lib/locale";

const PHASES = [
  { label: "breathe in", duration: 4000, cue: "In through your nose. Let the circle grow." },
  { label: "hold", duration: 4000, cue: "Stay full. Soften your shoulders." },
  { label: "breathe out", duration: 4000, cue: "Out slowly. Let the circle settle." },
  { label: "hold", duration: 4000, cue: "Rest here. Widen what you see." },
] as const;

const RING_CIRCUMFERENCE = 289;

/** 4-4-4-4 box breathing, driven off rAF so the ring stays smooth. */
function RoomSync() {
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);

  const reset = useCallback(() => {
    setRunning(false);
    setPhase(0);
    setElapsed(0);
    setCycleCount(0);
    lastRef.current = null;
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
  }, []);

  const toggle = useCallback(() => {
    setRunning((r) => {
      lastRef.current = r ? null : performance.now();
      return !r;
    });
  }, []);

  useEffect(() => {
    if (!running) return;

    const tick = (now: number) => {
      if (lastRef.current == null) lastRef.current = now;
      const delta = now - lastRef.current;
      lastRef.current = now;

      setElapsed((prev) => {
        const next = prev + delta;
        if (next >= PHASES[phase].duration) {
          setPhase((p) => {
            const nextPhase = (p + 1) % PHASES.length;
            if (nextPhase === 0) setCycleCount((c) => c + 1);
            return nextPhase;
          });
          return 0;
        }
        return next;
      });

      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [running, phase]);

  const progress = elapsed / PHASES[phase].duration;
  const expanding = phase === 0 || phase === 1;
  const scale = expanding ? 0.92 + progress * 0.36 : 1.28 - progress * 0.36;
  const opacity = expanding ? 0.45 + progress * 0.35 : 0.8 - progress * 0.3;
  const settle = running ? "none" : "transform 1.2s ease-out, opacity 1.2s ease-out";

  return (
    <div className="nr-glass relative flex h-full min-h-[26rem] flex-col justify-between gap-6 overflow-hidden rounded-3xl p-8 md:p-10">
      <RiverImage
        name="door-practice-breath"
        alt=""
        sizes="(min-width: 1024px) 640px, 100vw"
        className="pointer-events-none absolute inset-0 size-full object-cover opacity-25 blur-2xl dark:opacity-15 dark:brightness-75"
      />

      <div className="relative z-10">
        <p className="nr-label flex items-center gap-2 text-nr-fg">
          <Eye className="size-3.5" aria-hidden /> <Wind className="size-3.5" aria-hidden />
          Room sync · breath + gaze
        </p>
        <h3 className="mt-3 max-w-md font-nr-display text-2xl text-nr-fg">
          Follow the circle. One minute is enough.
        </h3>
        <p className="mt-2 max-w-sm text-sm text-nr-muted">
          {running
            ? PHASES[phase].cue
            : "Tap begin. The circle will guide your breath and your gaze."}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            className="inline-flex items-center gap-3 rounded-full bg-nr-ink px-6 py-3 text-nr-paper transition-all duration-500 hover:gap-4"
          >
            {running ? (
              <Pause className="size-4" aria-hidden />
            ) : (
              <Play className="size-4" aria-hidden />
            )}
            <span className="font-nr-display text-xl">{running ? "pause" : "begin"}</span>
          </button>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-full border border-nr-border px-4 py-3 text-sm text-nr-fg transition-colors duration-500 hover:border-nr-mood"
          >
            <RotateCcw className="size-4" aria-hidden /> reset
          </button>
        </div>
      </div>

      {/*
        The circle is decoration, not a second control. The design source made
        it a role="button" AND bound Space/R on `window`, which meant pressing
        Space anywhere on the page — including to scroll it — started the
        timer. The buttons above are the only affordance now.
      */}
      <div aria-hidden className="relative z-10 flex flex-1 items-center justify-center">
        <span
          className="absolute size-48 rounded-full blur-3xl"
          style={{
            background: "color-mix(in oklab, var(--nr-mood) 28%, transparent)",
            transform: `scale(${scale * 1.15})`,
            opacity,
            transition: settle,
          }}
        />
        <span
          className="absolute flex size-44 items-center justify-center rounded-full border"
          style={{
            borderColor: "color-mix(in oklab, var(--nr-mood) 50%, transparent)",
            transform: `scale(${scale})`,
            opacity: running ? 1 : 0.55,
            transition: settle,
          }}
        >
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-nr-fg/10"
            />
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={RING_CIRCUMFERENCE - RING_CIRCUMFERENCE * progress}
              strokeLinecap="round"
              style={{
                transition: running ? "none" : "stroke-dashoffset 1.2s ease-out",
                color: "color-mix(in oklab, var(--nr-mood) 90%, transparent)",
              }}
            />
          </svg>
          <span className="nr-label text-nr-fg">{running ? PHASES[phase].label : "ready"}</span>
        </span>
      </div>

      {/* The phase label changes silently above; announce it once per phase. */}
      <p className="sr-only" aria-live="polite">
        {running ? PHASES[phase].cue : ""}
      </p>

      <div className="relative z-10 flex items-center justify-between gap-4">
        <div aria-hidden className="flex items-center gap-1.5">
          {PHASES.map((p, i) => (
            <span
              key={`${p.label}-${i}`}
              className="h-1 rounded-full transition-all duration-500"
              style={{
                width: i === phase ? 28 : 10,
                background:
                  i === phase
                    ? "color-mix(in oklab, var(--nr-mood) 85%, transparent)"
                    : "color-mix(in oklab, var(--nr-ink) 18%, transparent)",
              }}
            />
          ))}
        </div>
        <p className="nr-label text-nr-fg">
          {cycleCount} {cycleCount === 1 ? "round" : "rounds"}
        </p>
      </div>
    </div>
  );
}

/**
 * Anonymous peer voices, one at a time.
 *
 * This is the old WhisperWall's data path in the new design's clothes: the
 * pool is still ranked by the user's dominant themes (never labelled), still
 * narrowed to low-affect-safe lines on a heavy day, and still hidden outright
 * during a crisis cooldown.
 */
function PassingThought() {
  const { settings } = useSettings();
  const { data: snapshot } = useSnapshot();
  const ambience = useAmbience();
  const reducedMotion = usePrefersReducedMotion();

  const language = (settings?.language as SupportedLanguage) ?? "english";
  const lowAffect = ambience.valence < -0.3;
  const dominantThemes = useMemo(() => snapshot?.dominant_themes ?? [], [snapshot]);

  const whispers = useMemo(
    () => filterWhispers(language, lowAffect, dominantThemes),
    [language, lowAffect, dominantThemes],
  );

  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [direction, setDirection] = useState<1 | -1>(1);
  const swapRef = useRef<number | null>(null);

  useEffect(() => {
    setIndex(0);
  }, [whispers.length]);

  const show = useCallback(
    (nextIndex: number, dir: 1 | -1) => {
      setDirection(dir);
      setVisible(false);
      if (swapRef.current) window.clearTimeout(swapRef.current);
      swapRef.current = window.setTimeout(
        () => {
          setIndex(nextIndex);
          setVisible(true);
        },
        reducedMotion ? 0 : 350,
      );
    },
    [reducedMotion],
  );

  useEffect(() => () => void (swapRef.current && window.clearTimeout(swapRef.current)), []);

  useEffect(() => {
    if (whispers.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((i) => {
        setDirection(1);
        return (i + 1) % whispers.length;
      });
    }, 7000);
    return () => window.clearInterval(id);
  }, [whispers.length]);

  // Crisis cooldown: peer voices can land wrong in that window.
  if (ambience.crisisQuiet || whispers.length === 0) return null;

  const current = whispers[index];
  const next = () => show((index + 1) % whispers.length, 1);
  const prev = () => show((index - 1 + whispers.length) % whispers.length, -1);

  return (
    <div className="nr-glass relative flex h-full min-h-[26rem] flex-col overflow-hidden rounded-3xl p-8 md:p-10">
      <RiverImage
        name="door-practice-drift"
        alt=""
        sizes="(min-width: 1024px) 640px, 100vw"
        className="nr-anim-drift pointer-events-none absolute -inset-4 size-[calc(100%+2rem)] object-cover opacity-25 blur-2xl dark:opacity-15 dark:brightness-75"
      />

      <div className="relative z-10 flex items-start justify-between gap-6">
        <p className="nr-label text-nr-fg">Passing through · anonymous</p>
        <div className="flex items-center gap-1.5 pt-1">
          {whispers.map((w, i) => (
            <button
              key={w.id}
              type="button"
              aria-label={`Thought ${i + 1} of ${whispers.length}`}
              aria-current={i === index}
              onClick={() => show(i, i > index ? 1 : -1)}
              className="h-0.5 rounded-full transition-all duration-700"
              style={{
                width: i === index ? 22 : 8,
                background:
                  i === index
                    ? "color-mix(in oklab, var(--nr-mood) 85%, transparent)"
                    : "color-mix(in oklab, var(--nr-ink) 25%, transparent)",
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 mt-auto flex flex-col justify-end pt-8">
        <div
          className="transition-all duration-700"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : `translateY(${direction * 16}px)`,
          }}
          aria-live="polite"
        >
          <p className="font-nr-display text-2xl leading-snug text-nr-fg/85 md:text-3xl">
            &ldquo;{current.text}&rdquo;
          </p>
          <p className="nr-label mt-5 text-nr-fg">{current.tag}</p>
        </div>

        <div className="mt-8 flex items-center gap-3">
          <button
            type="button"
            onClick={prev}
            aria-label="Previous thought"
            className="inline-flex size-10 items-center justify-center rounded-full border border-nr-border text-nr-fg transition-colors duration-500 hover:border-nr-mood"
          >
            <ArrowRight className="size-4 rotate-180" aria-hidden />
          </button>
          <button
            type="button"
            onClick={next}
            className="group inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-nr-ink px-5 py-3 text-nr-paper transition-all duration-500 hover:gap-3"
          >
            <span className="text-sm font-medium">let another pass</span>
            <ArrowRight
              className="size-4 transition-transform duration-500 group-hover:translate-x-1"
              aria-hidden
            />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Practice() {
  return (
    <section
      id="practice"
      className="mx-auto grid max-w-6xl scroll-mt-28 gap-5 px-6 lg:grid-cols-[1.1fr_1fr]"
    >
      <Reveal className="h-full">
        <RoomSync />
      </Reveal>
      <Reveal className="h-full" delay={120}>
        <PassingThought />
      </Reveal>
    </section>
  );
}
