import { useMemo, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { insights, weekSignal, type Insight } from "@/lib/therapist-bridge/data";
import { BottomSheet } from "./BottomSheet";

const W = 640;
const H = 170;

function buildPath() {
  const max = 8;
  const points = weekSignal.map((d, i) => {
    const x = (i / (weekSignal.length - 1)) * (W - 40) + 20;
    const y = H - 24 - (d.moodValue / max) * (H - 60);
    return { x, y, d };
  });
  let path = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const cur = points[i]!;
    const cx = (prev.x + cur.x) / 2;
    path += ` C ${cx} ${prev.y}, ${cx} ${cur.y}, ${cur.x} ${cur.y}`;
  }
  return { path, points };
}

const arrow: Record<Insight["direction"], string> = { up: "↑", down: "↓", flat: "→" };

export function EmotionalSignal() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduced = useReducedMotion();
  const { path, points } = useMemo(buildPath, []);
  const [active, setActive] = useState<number | null>(null);
  const [openInsight, setOpenInsight] = useState<Insight | null>(null);

  const day = active === null ? null : points[active]!.d;

  return (
    <section ref={ref} aria-labelledby="signal-heading" className="relative">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h2 id="signal-heading" className="display text-4xl text-ink sm:text-5xl">
            Your signal
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            A gentle picture of how things have been moving lately.
          </p>
        </div>
        <p className="hand hidden shrink-0 text-sm text-muted-foreground sm:block">last seven days</p>
      </div>

      <div className="panel relative mt-6 rounded-2xl px-3 pb-3 pt-5 sm:px-5">
        <div
          className="pointer-events-none absolute inset-x-8 top-4 h-24 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(closest-side, var(--sage), transparent)" }}
          aria-hidden="true"
        />
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="relative w-full"
          role="img"
          aria-label="Mood over the last seven days, gradually rising from low on Wednesday to steady on Tuesday."
        >
          <motion.path
            d={path}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2}
            strokeLinecap="round"
            initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
            animate={inView ? { pathLength: 1 } : {}}
            transition={{ duration: reduced ? 0 : 1.8, ease: [0.16, 1, 0.3, 1] }}
          />
          {points.map((p, i) => (
            <g key={p.d.day}>
              <motion.circle
                cx={p.x}
                cy={p.y}
                r={active === i ? 5.5 : 3.5}
                fill="var(--primary)"
                initial={reduced ? { opacity: 1 } : { opacity: 0 }}
                animate={inView ? { opacity: 1 } : {}}
                transition={{ delay: reduced ? 0 : 0.9 + i * 0.09, duration: 0.4 }}
              />
              <text
                x={p.x}
                y={H - 4}
                textAnchor="middle"
                className="fill-muted-foreground text-[11px]"
                style={{ fontSize: 11 }}
              >
                {p.d.short}
              </text>
              <rect
                x={p.x - 22}
                y={0}
                width={44}
                height={H - 12}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${p.d.day}: mood ${p.d.mood}, energy ${p.d.energy}, sleep ${p.d.sleep} hours`}
                className="cursor-pointer focus:outline-none"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              />
            </g>
          ))}
        </svg>

        <div className="min-h-14 px-2 pb-1 pt-2" aria-live="polite">
          {day ? (
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
              <span className="display text-xl text-ink">{day.day}</span>
              <span className="text-sm text-muted-foreground">Mood: {day.mood}</span>
              <span className="text-sm text-muted-foreground">Energy: {day.energy}</span>
              <span className="text-sm text-muted-foreground">Sleep: {day.sleep}h</span>
            </div>
          ) : (
            <p className="hand text-sm text-muted-foreground">
              Hover or focus a day to see what it held.
            </p>
          )}
        </div>
      </div>

      <ul className="mt-5 flex flex-wrap gap-2">
        {insights.map((insight, i) => (
          <motion.li
            key={insight.id}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: reduced ? 0 : 1.2 + i * 0.1, duration: 0.5 }}
          >
            <button
              type="button"
              onClick={() => setOpenInsight(insight)}
              className="lift rounded-full border border-border bg-card/70 px-4 py-2 text-sm text-foreground hover:border-primary/40"
            >
              <span aria-hidden="true" className="mr-2 text-primary">
                {arrow[insight.direction]}
              </span>
              {insight.label}
            </button>
          </motion.li>
        ))}
      </ul>

      <BottomSheet
        open={openInsight !== null}
        onOpenChange={(o) => !o && setOpenInsight(null)}
        title={openInsight?.label ?? ""}
        description={openInsight?.detail}
      >
        <p className="hand text-sm text-muted-foreground">
          Patterns like this are a starting point for conversation, not a conclusion.
        </p>
      </BottomSheet>
    </section>
  );
}
