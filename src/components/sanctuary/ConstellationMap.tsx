import { motion } from "framer-motion";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { localDayKey, useMoodLog, type MoodLogEntry } from "@/hooks/useMoodLog";
import { moodSlope } from "@/lib/sanctuary/ambience";
import { useAmbience } from "./AmbienceProvider";

const W = 560;
const H = 180;
const PAD = 30;
const DAYS = 7;

const VALENCE_TO_AXIS: Record<string, number> = {
  heavy: 0.18,
  low: 0.4,
  okay: 0.55,
  lifting: 0.78,
  bright: 0.92,
};

const DAY_LABEL = (d: Date) =>
  d.toLocaleDateString(undefined, { weekday: "narrow" });

interface DayPoint {
  day: string;
  v: number | null;
  /** raw log if one exists for this calendar day. */
  log: MoodLogEntry | null;
}

function buildWeekGrid(weekLogs: MoodLogEntry[]): DayPoint[] {
  // Walk back DAYS days from today (inclusive). Today is the rightmost.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const grid: DayPoint[] = [];
  for (let offset = DAYS - 1; offset >= 0; offset--) {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    const key = localDayKey(d);
    const log =
      weekLogs.find((e) => localDayKey(new Date(e.logged_at)) === key) ?? null;
    grid.push({
      day: DAY_LABEL(d),
      v: log ? VALENCE_TO_AXIS[log.mood_label] ?? null : null,
      log,
    });
  }
  return grid;
}

function deriveHeadlineKey(weekLogs: MoodLogEntry[]): "stillDrawing" | "lift" | "level" | "heavy" {
  if (weekLogs.length < 3) return "stillDrawing";
  const slope = moodSlope(weekLogs);
  if (slope > 0.1) return "lift";
  if (slope < -0.1) return "heavy";
  return "level";
}

export function ConstellationMap() {
  const { t } = useTranslation("sanctuary");
  const { weekLogs } = useMoodLog();
  const ambience = useAmbience();

  const grid = useMemo(() => buildWeekGrid(weekLogs), [weekLogs]);
  const headlineKey = useMemo(() => deriveHeadlineKey(weekLogs), [weekLogs]);

  // Build points, treating missing days as faint placeholder stars at the
  // midline. Connect only the days with real values via the curve.
  const points = grid.map((d, i) => {
    const x = PAD + (i * (W - PAD * 2)) / (DAYS - 1);
    const fallbackY = H - PAD - 0.5 * (H - PAD * 2);
    const y = d.v == null ? fallbackY : H - PAD - d.v * (H - PAD * 2);
    return { ...d, x, y };
  });
  const realPoints = points.filter((p) => p.v != null);
  const path = realPoints
    .map((p, i) =>
      i === 0
        ? `M ${p.x} ${p.y}`
        : `Q ${(realPoints[i - 1].x + p.x) / 2} ${
            (realPoints[i - 1].y + p.y) / 2 - 6
          }, ${p.x} ${p.y}`,
    )
    .join(" ");

  // Saturation hint: nudge the background blend toward `valence`. Negative
  // values cool toward the sky accent, positive ones warm toward blush.
  const v = ambience.valence;
  const blendStart = v < 0
    ? "var(--accent-sky)"
    : v > 0.3
      ? "var(--accent-blush)"
      : "var(--accent-sage)";
  const inkMix = `${Math.round(86 - v * 8)}%`;

  const headline = t(`constellation.${headlineKey}`);
  const headlineTail = t(`constellation.${headlineKey}Tail`);

  return (
    <div className="w-full">
      <div
        className="relative overflow-hidden rounded-3xl border p-6 md:p-8"
        style={{
          borderColor: "var(--border)",
          background: `linear-gradient(160deg, color-mix(in oklab, var(--ink) ${inkMix}, ${blendStart}), color-mix(in oklab, var(--ink) 78%, var(--accent-blush)))`,
        }}
      >
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p
              className="mb-2 text-[0.7rem] uppercase tracking-[0.4em]"
              style={{
                color: "color-mix(in oklab, var(--paper) 70%, transparent)",
              }}
            >
              {t("constellation.eyebrow")}
            </p>
            <h3
              className="leading-tight"
              style={{
                fontFamily: "var(--font-serif)",
                color: "var(--paper)",
                fontSize: "clamp(1.3rem, 2.2vw, 1.7rem)",
                fontWeight: 500,
              }}
            >
              <span style={{ fontStyle: "italic" }}>{headline}</span>{" "}
              <span style={{ opacity: 0.7 }}>{headlineTail}</span>
            </h3>
          </div>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={t("constellation.eyebrow")}
        >
          {Array.from({ length: 26 }).map((_, i) => (
            <circle
              key={i}
              cx={(i * 53) % W}
              cy={(i * 41) % H}
              r={((i * 7) % 10) / 10 + 0.3}
              fill="white"
              opacity={((i * 11) % 35) / 100 + 0.1}
            />
          ))}
          {realPoints.length >= 2 && (
            <motion.path
              d={path}
              fill="none"
              stroke="color-mix(in oklab, white 60%, transparent)"
              strokeWidth={1}
              strokeDasharray="2 4"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 2.2, ease: "easeInOut" }}
            />
          )}
          {points.map((p, i) => {
            const missing = p.v == null;
            return (
              <g key={i}>
                <motion.circle
                  cx={p.x}
                  cy={p.y}
                  r={missing ? 2 : i === points.length - 1 ? 5 : 3.2}
                  fill="white"
                  fillOpacity={missing ? 0.22 : 1}
                  initial={{ scale: 0, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.15 * i, type: "spring", stiffness: 200 }}
                  style={{ transformOrigin: `${p.x}px ${p.y}px` }}
                />
                {i === points.length - 1 && !missing && (
                  <circle cx={p.x} cy={p.y} r={11} fill="white" opacity={0.18} />
                )}
                <text
                  x={p.x}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize={10}
                  fill="color-mix(in oklab, white 60%, transparent)"
                  style={{ letterSpacing: "0.2em" }}
                >
                  {p.day}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
