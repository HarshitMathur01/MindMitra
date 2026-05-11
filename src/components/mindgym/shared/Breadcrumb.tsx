import type { SurfaceTone } from "@/lib/mindgym/theme";

interface BreadcrumbProps {
  trail: string[];
  tone: SurfaceTone;
}

// Soft three-dot breadcrumb, e.g. "Mind Gym · Calm · Breath Sphere".
// The final crumb is emphasised; earlier crumbs fade. Always passive (display only).
export default function Breadcrumb({ trail, tone }: BreadcrumbProps) {
  if (trail.length === 0) return null;
  const isWarm = tone === "warm";
  const muted = isWarm ? "text-[#9a8674]" : "text-white/45";
  const accent = isWarm ? "text-[#5b4a3e]" : "text-white/75";

  return (
    <nav
      aria-label="Breadcrumb"
      className="inline-flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.22em]"
    >
      {trail.map((crumb, idx) => {
        const isLast = idx === trail.length - 1;
        return (
          <span key={`${crumb}-${idx}`} className="inline-flex items-center gap-1.5">
            <span className={isLast ? accent : muted}>{crumb}</span>
            {!isLast && (
              <span aria-hidden className={muted}>
                ·
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
