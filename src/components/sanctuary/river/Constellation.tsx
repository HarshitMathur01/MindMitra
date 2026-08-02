import { useMemo } from "react";
import { Reveal } from "./Reveal";
import { localDayKey, type MoodLogEntry } from "@/hooks/useMoodLog";
import { moodAccentFor } from "./moods";

const W = 700;
const H = 240;
const TOP = 34;
const BOTTOM = 186;
const DAYS = 7;

interface DayPoint {
  key: string;
  day: string;
  count: number;
  /** 0..1 — brightness of the star. Higher mood index burns brighter. */
  glow: number;
  x: number;
  y: number;
  accent: string;
  logged: boolean;
}

/**
 * Fold the week's logs into one point per day.
 *
 * A day with no check-in still gets a point — it sits low and dim rather than
 * vanishing, so the trail stays continuous. A week of gaps should read as a
 * quiet sky, never as a broken chart or a scolding.
 */
function buildPoints(weekLogs: MoodLogEntry[]): DayPoint[] {
  const byDay = new Map<string, MoodLogEntry[]>();
  for (const log of weekLogs) {
    const key = localDayKey(new Date(log.logged_at));
    const bucket = byDay.get(key);
    if (bucket) bucket.push(log);
    else byDay.set(key, [log]);
  }

  const today = new Date();
  const points: DayPoint[] = [];

  for (let i = 0; i < DAYS; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - (DAYS - 1 - i));
    const key = localDayKey(date);
    const logs = byDay.get(key) ?? [];

    // Last log of the day wins — the most recent read on how it actually went.
    const latest = logs[0] ?? null;
    const moodIndex = latest?.mood_index ?? null;
    // MOOD_LABELS is 0..4 heavy→bright. Map to a 0..1 height, mid-height when
    // unknown so a blank day doesn't imply "bad".
    const normalised = moodIndex == null ? 0.5 : moodIndex / 4;

    points.push({
      key,
      day: date.toLocaleDateString("en-GB", { weekday: "short" }),
      count: logs.length,
      glow: moodIndex == null ? 0.35 : 0.55 + normalised * 0.45,
      x: 50 + i * 100,
      y: TOP + (1 - normalised) * (BOTTOM - TOP),
      accent: moodAccentFor(moodIndex),
      logged: latest != null,
    });
  }

  return points;
}

/** Smooth bezier through the stars. */
function buildPath(points: DayPoint[]): string {
  return points.reduce((d, p, i, all) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = all[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `${d} C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
  }, "");
}

/** Deterministic dust, so it doesn't reshuffle on every render. */
const DUST = Array.from({ length: 46 }, (_, i) => ({
  x: ((i * 137.5) % 96) + 2,
  y: 16 + (((i * 61.3) % 78) / 100) * (BOTTOM + 10),
  r: 0.6 + ((i * 13) % 5) / 6,
  delay: (i % 9) * 0.7,
}));

interface ConstellationProps {
  firstName: string;
  weekLogs: MoodLogEntry[];
}

export function Constellation({ firstName, weekLogs }: ConstellationProps) {
  const points = useMemo(() => buildPoints(weekLogs), [weekLogs]);
  const path = useMemo(() => buildPath(points), [points]);
  const total = points.reduce((sum, p) => sum + p.count, 0);

  return (
    <div className="mx-auto max-w-6xl px-6 lg:h-full">
      {/* The ring is what stops the card reading as a hole punched in a light
          page — it gives the dark panel a deliberate edge. Stronger in light
          theme, near-invisible in dark where the card already belongs. */}
      <Reveal
        className="relative flex h-full flex-col overflow-hidden rounded-3xl bg-nr-ink p-7 ring-1 ring-inset md:p-9"
        style={{ ["--tw-ring-color" as string]: "var(--nr-sky-ring)" }}
      >
        {/* Horizon glow */}
        <div
          aria-hidden
          className="nr-anim-breathe pointer-events-none absolute -bottom-32 left-1/2 h-64 w-[130%] -translate-x-1/2 rounded-[50%] blur-3xl"
          style={{ background: "color-mix(in oklab, var(--nr-mood) 26%, transparent)" }}
        />

        <div className="relative flex flex-wrap items-baseline justify-between gap-3">
          <p className="nr-label text-nr-paper">{firstName}&apos;s week</p>
          <p className="nr-label text-nr-paper/60">still drawing itself</p>
        </div>

        <p className="relative mt-3 font-nr-display text-2xl text-nr-paper/90 md:text-3xl">
          <span className="text-nr-paper">
            {total} {total === 1 ? "check-in" : "check-ins"}
          </span>{" "}
          <span className="text-nr-paper/70">and not one of them scored.</span>
        </p>

        <div
          className="relative mt-4 flex-1"
          role="img"
          aria-label={
            total === 0
              ? "An empty sky — no check-ins logged this week yet"
              : `A week of check-ins drawn as a constellation, ${total} in total`
          }
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-full min-h-[190px] w-full overflow-visible"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <filter id="nr-halo" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="11" />
              </filter>
              <linearGradient id="nr-trail" x1="0" x2="1">
                {/* Lifted from 0.05: the head of the trail used to fade to
                    nothing, so the week appeared to start mid-air. */}
                <stop offset="0%" stopColor="var(--nr-mood)" stopOpacity="0.22" />
                <stop offset="45%" stopColor="var(--nr-mood)" stopOpacity="0.78" />
                <stop offset="100%" stopColor="var(--nr-gold)" stopOpacity="0.95" />
              </linearGradient>
            </defs>

            {DUST.map((d, i) => (
              <circle
                key={`dust-${i}`}
                className="nr-anim-twinkle"
                cx={(d.x / 100) * W}
                cy={d.y}
                r={d.r}
                fill="var(--nr-paper)"
                style={{
                  animationDelay: `${d.delay}s`,
                  opacity: "calc(0.34 * var(--nr-sky-boost))",
                }}
              />
            ))}

            <path
              d={path}
              fill="none"
              stroke="url(#nr-trail)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="5 7"
              vectorEffect="non-scaling-stroke"
            />

            {points.map((p, i) => (
              <g key={p.key}>
                {/* Halo was 0.22*glow+0.08 — 1.57:1 against the card on an
                    idle day, effectively invisible. */}
                <circle
                  className="nr-anim-breathe"
                  cx={p.x}
                  cy={p.y}
                  r={8 + p.glow * 6}
                  fill={p.accent}
                  filter="url(#nr-halo)"
                  style={{
                    animationDelay: `${i * 0.4}s`,
                    transformBox: "fill-box",
                    transformOrigin: "center",
                    opacity: `calc(${(0.34 * p.glow + 0.2).toFixed(3)} * var(--nr-sky-boost))`,
                  }}
                />
                <circle
                  className="nr-anim-twinkle"
                  cx={p.x}
                  cy={p.y}
                  r={2.6 + p.glow * 1.6}
                  fill={p.logged ? "var(--nr-gold)" : "var(--nr-paper)"}
                  style={{
                    animationDelay: `${i * 0.55}s`,
                    transformBox: "fill-box",
                    transformOrigin: "center",
                    // Idle lifted 0.25 -> 0.48: an empty sky should still read
                    // as a sky, not as a blank panel.
                    opacity: `calc(${(p.logged ? 0.62 + 0.38 * p.glow : 0.48).toFixed(3)} * var(--nr-sky-boost))`,
                  }}
                />
                <line
                  x1={p.x}
                  y1={p.y + 8}
                  x2={p.x}
                  y2={BOTTOM + 22}
                  stroke="var(--nr-paper)"
                  strokeWidth="1"
                  style={{ opacity: "calc(0.26 * var(--nr-sky-boost))" }}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ))}
          </svg>
        </div>

        <ul className="relative mt-4 grid grid-cols-7 text-center">
          {points.map((p) => (
            <li key={p.key} className="flex flex-col items-center gap-1">
              <span className="nr-label text-nr-paper/60">{p.day}</span>
              <span className="font-nr-display text-lg text-nr-paper/85">
                {p.count > 0 ? p.count : "·"}
              </span>
            </li>
          ))}
        </ul>
      </Reveal>
    </div>
  );
}
