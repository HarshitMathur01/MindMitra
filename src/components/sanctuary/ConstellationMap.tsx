import { motion } from "framer-motion";

const WEEK = [
  { day: "M", v: 0.35, label: "heavy" },
  { day: "T", v: 0.5, label: "low" },
  { day: "W", v: 0.42, label: "low" },
  { day: "T", v: 0.7, label: "okay" },
  { day: "F", v: 0.6, label: "okay" },
  { day: "S", v: 0.85, label: "lifting" },
  { day: "S", v: 0.78, label: "lifting" },
];

export function ConstellationMap() {
  const W = 560;
  const H = 180;
  const pad = 30;
  const pts = WEEK.map((d, i) => ({
    x: pad + (i * (W - pad * 2)) / (WEEK.length - 1),
    y: H - pad - d.v * (H - pad * 2),
    ...d,
  }));
  const path = pts
    .map((p, i) =>
      i === 0
        ? `M ${p.x} ${p.y}`
        : `Q ${(pts[i - 1].x + p.x) / 2} ${(pts[i - 1].y + p.y) / 2 - 6}, ${p.x} ${p.y}`,
    )
    .join(" ");

  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-4 md:px-12">
      <div
        className="relative overflow-hidden rounded-3xl border p-6 md:p-8"
        style={{
          borderColor: "var(--border)",
          background:
            "linear-gradient(160deg, color-mix(in oklab, var(--ink) 92%, var(--accent-sky)), color-mix(in oklab, var(--ink) 78%, var(--accent-blush)))",
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
              your week, as a constellation
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
              <span style={{ fontStyle: "italic" }}>quiet upward arc.</span>{" "}
              <span style={{ opacity: 0.7 }}>nothing to prove — just noticing.</span>
            </h3>
          </div>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label="Mood constellation across seven days"
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
          {pts.map((p, i) => (
            <g key={i}>
              <motion.circle
                cx={p.x}
                cy={p.y}
                r={i === pts.length - 1 ? 5 : 3.2}
                fill="white"
                initial={{ scale: 0, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 * i, type: "spring", stiffness: 200 }}
                style={{ transformOrigin: `${p.x}px ${p.y}px` }}
              />
              {i === pts.length - 1 && (
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
          ))}
        </svg>
      </div>
    </section>
  );
}
