import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { MINDGYM_TOOLS } from "@/lib/mindgym/catalog";
import { loadProgress } from "@/lib/mindgym/storage";
import { trackMindGymEvent } from "@/lib/mindgym/analytics";
import type { SurfaceTone } from "@/lib/mindgym/theme";
import type { ToolId } from "@/lib/mindgym/types";

interface NextToolHandoffProps {
  currentToolId: ToolId;
  tone: SurfaceTone;
}

/**
 * Suggests a next practice after a completion.
 * Heuristic: same section, not yet done today → any tool not yet done today.
 * Returns null when everything available today is already complete.
 */
export default function NextToolHandoff({ currentToolId, tone }: NextToolHandoffProps) {
  const next = useMemo(() => pickNext(currentToolId), [currentToolId]);
  const navigate = useNavigate();
  const isWarm = tone === "warm";

  if (!next) return null;

  const Icon = next.icon;

  return (
    <button
      onClick={() => {
        trackMindGymEvent("next_tool_clicked", { fromToolId: currentToolId, toolId: next.id });
        navigate(`/mindgym/${next.id}`);
      }}
      className={
        isWarm
          ? "group w-full flex items-center gap-3 rounded-2xl border border-black/5 bg-[#FBF6EC]/85 px-4 py-3.5 text-left shadow-[0_8px_24px_-16px_rgba(80,60,40,0.18)] backdrop-blur-sm transition-all hover:bg-[#FBF6EC] hover:shadow-[0_12px_32px_-18px_rgba(80,60,40,0.22)]"
          : "group w-full flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-left backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/15"
      }
    >
      <span
        className={
          isWarm
            ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#4f6b3f] ring-1 ring-black/5"
            : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 ring-1 ring-white/10"
        }
      >
        <Icon className="h-4 w-4" strokeWidth={1.7} />
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={
            isWarm
              ? "text-[10.5px] font-medium uppercase tracking-[0.18em] text-[#9a8674]"
              : "text-[10.5px] font-medium uppercase tracking-[0.18em] text-white/45"
          }
        >
          Stay a moment longer
        </p>
        <p
          className={
            isWarm
              ? "mt-0.5 font-serif-display text-[1.05rem] font-normal leading-snug text-[#2a1c14]"
              : "mt-0.5 font-serif-display text-[1.05rem] font-normal leading-snug text-white/95"
          }
        >
          {next.title}
          <span
            className={
              isWarm
                ? " ml-1.5 text-[12px] font-sans font-normal text-[#9a8674]"
                : " ml-1.5 text-[12px] font-sans font-normal text-white/50"
            }
          >
            · {next.minutes} min
          </span>
        </p>
      </div>
      <ArrowRight
        className={
          isWarm
            ? "h-4 w-4 shrink-0 text-[#9a8674] transition-transform group-hover:translate-x-0.5"
            : "h-4 w-4 shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5"
        }
        strokeWidth={1.8}
      />
    </button>
  );
}

function pickNext(currentToolId: ToolId) {
  const current = MINDGYM_TOOLS.find((t) => t.id === currentToolId);
  if (!current) return null;
  const done = new Set(loadProgress().completedToday);
  done.add(currentToolId);

  const sameSection = MINDGYM_TOOLS.find(
    (t) => t.section === current.section && t.id !== currentToolId && !done.has(t.id),
  );
  if (sameSection) return sameSection;

  return MINDGYM_TOOLS.find((t) => t.id !== currentToolId && !done.has(t.id)) ?? null;
}
