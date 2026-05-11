import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Flame, Sparkles, Compass } from "lucide-react";
import { loadProgress } from "@/lib/mindgym/storage";
import { MINDGYM_TOOLS } from "@/lib/mindgym/catalog";
import { trackMindGymEvent } from "@/lib/mindgym/analytics";

interface JourneyStripProps {
  className?: string;
}

/**
 * Subtle progression surface for the MindGym hub.
 * Renders streak / total XP / today's practice count from existing storage —
 * no new gamification, only visibility of data we already track.
 */
export default function JourneyStrip({ className }: JourneyStripProps) {
  const { streak, xp, doneToday, totalTools } = useMemo(() => {
    const p = loadProgress();
    return {
      streak: p.currentStreak,
      xp: p.totalXP,
      doneToday: p.completedToday.length,
      totalTools: MINDGYM_TOOLS.length,
    };
  }, []);

  // Hide the strip entirely for first-time visitors so it doesn't feel demanding.
  const isEmpty = streak === 0 && xp === 0 && doneToday === 0;

  useEffect(() => {
    if (!isEmpty) trackMindGymEvent("journey_strip_viewed", {});
  }, [isEmpty]);

  if (isEmpty) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className={`mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-2 sm:gap-3 ${className ?? ""}`}
    >
      {streak > 0 && (
        <Stat
          icon={<Flame className="h-3.5 w-3.5" strokeWidth={1.9} />}
          label={`${streak}-day ${streak === 1 ? "spark" : "streak"}`}
          accent="warmth"
        />
      )}
      <Stat
        icon={<Compass className="h-3.5 w-3.5" strokeWidth={1.9} />}
        label={`${doneToday} of ${totalTools} today`}
        accent="sage"
      />
      <Stat
        icon={<Sparkles className="h-3.5 w-3.5" strokeWidth={1.9} />}
        label={`${xp} gentle points`}
        accent="sage"
      />
    </motion.div>
  );
}

function Stat({
  icon,
  label,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  accent: "warmth" | "sage";
}) {
  const tone =
    accent === "warmth"
      ? "bg-[#f3d9c8]/70 text-[#b2613a] ring-[#b2613a]/15"
      : "bg-[#d8e4cf]/70 text-[#4f6b3f] ring-[#4f6b3f]/15";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-medium tracking-wide ring-1 backdrop-blur-sm ${tone}`}
    >
      {icon}
      {label}
    </span>
  );
}
