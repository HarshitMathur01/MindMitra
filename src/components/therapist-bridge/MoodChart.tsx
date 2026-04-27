import { useMemo } from "react";

export function MoodChart({ data }: { data: { day: string; value: number }[] }) {
  const { points, area } = useMemo(() => {
    const W = 320;
    const H = 110;
    const pad = 16;
    const max = 10;
    const step = (W - pad * 2) / (data.length - 1);
    const pts = data.map((d, i) => {
      const x = pad + i * step;
      const y = H - pad - (d.value / max) * (H - pad * 2);
      return [x, y] as const;
    });
    const path = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
    const areaPath = `${path} L${pts[pts.length - 1][0]},${H - pad} L${pts[0][0]},${H - pad} Z`;
    return { points: { path, pts }, area: areaPath };
  }, [data]);

  return (
    <div>
      <svg viewBox="0 0 320 110" className="h-28 w-full" role="img" aria-label="seven-day mood trend">
        <path d={area} fill="#A8BC9A" fillOpacity="0.18" />
        <path
          d={points.path}
          stroke="#3F6B47"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        {points.pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.5" fill="#3F6B47" />
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] tracking-wide text-[#7A736A]">
        {data.map((d) => (
          <span key={d.day}>{d.day}</span>
        ))}
      </div>
    </div>
  );
}
