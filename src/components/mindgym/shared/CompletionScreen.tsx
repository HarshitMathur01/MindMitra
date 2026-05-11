import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { Star, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AccentSwatch, SurfaceTone } from "@/lib/mindgym/theme";

export interface CompletionAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
}

interface CompletionScreenProps {
  tone: SurfaceTone;
  accent: AccentSwatch;
  xp: number;
  // Optional secondary stat (e.g. visit streak from TherapeuticGameShell).
  streakCount?: number;
  headline?: string;
  subtitle?: string;
  // Primary CTA (defaults to "Back to practices" wired by the caller).
  primary: CompletionAction;
  // Optional reset CTA shown above the primary.
  onReset?: () => void;
  resetLabel?: string;
  // Slot for the Phase 3 NextToolHandoff card.
  extra?: ReactNode;
}

const DEFAULT_HEADLINE = "You showed up for yourself";
const DEFAULT_SUBTITLE =
  "Take a slow breath. Nothing here is judging you — you can leave this screen whenever you like.";

// Unified completion typography:
//   - Serif-display italic headline (Fraunces)
//   - Caveat (script) XP number
//   - Tone prop swaps palette only.
export default function CompletionScreen({
  tone,
  accent,
  xp,
  streakCount,
  headline = DEFAULT_HEADLINE,
  subtitle = DEFAULT_SUBTITLE,
  primary,
  onReset,
  resetLabel = "Go through it again",
  extra,
}: CompletionScreenProps) {
  const isWarm = tone === "warm";

  return (
    <motion.div
      className="relative z-10 w-full max-w-md mx-auto px-6 min-h-screen flex flex-col items-center justify-center pb-20 pt-16"
      initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ type: "spring", stiffness: 36, damping: 38, mass: 1.25 }}
    >
      <div
        aria-hidden
        className={
          isWarm
            ? "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] rounded-full blur-[100px] opacity-[0.22] pointer-events-none"
            : "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] rounded-full blur-[80px] opacity-[0.16] pointer-events-none"
        }
        style={{ backgroundColor: accent.hex }}
      />

      <div
        className={
          isWarm
            ? "w-24 h-24 rounded-full bg-[#FBF6EC] border border-black/5 flex items-center justify-center mx-auto mb-8 shadow-[0_10px_28px_-12px_rgba(80,60,40,0.18)] relative"
            : "w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-8 backdrop-blur-md relative"
        }
      >
        <Star
          className={`w-10 h-10 ${accent.text} relative z-10 ${isWarm ? "" : "drop-shadow-lg"}`}
          fill="currentColor"
        />
      </div>

      <h2
        className={
          isWarm
            ? "font-serif-display italic text-[2rem] sm:text-[2.4rem] font-light mb-3 text-[#2a1c14] tracking-tight text-center leading-tight"
            : "font-serif-display italic text-[2rem] sm:text-[2.4rem] font-light mb-3 text-white tracking-tight text-center leading-tight drop-shadow-md"
        }
      >
        {headline}
      </h2>

      <div
        className={
          isWarm
            ? "flex flex-col items-center justify-center bg-[#FBF6EC]/85 rounded-2xl px-8 py-5 border border-black/5 mb-8 shadow-[0_8px_24px_-14px_rgba(80,60,40,0.18)] backdrop-blur-sm"
            : "flex flex-col items-center justify-center bg-white/5 rounded-2xl px-8 py-5 border border-white/10 mb-8 shadow-inner backdrop-blur-sm"
        }
      >
        <p
          className={
            isWarm
              ? "text-[#9a8674] text-[11px] font-medium uppercase tracking-[0.22em] mb-1"
              : "text-white/50 text-[11px] font-medium uppercase tracking-[0.22em] mb-1"
          }
        >
          A small acknowledgment
        </p>
        <p
          className={`text-[2.2rem] ${accent.text}`}
          style={{ fontFamily: "var(--font-script), cursive", lineHeight: 1.1 }}
        >
          +{xp} gentle points
        </p>
        {streakCount != null && (
          <p
            className={
              isWarm
                ? "mt-2 text-[12px] text-[#5b4a3e]/70 tracking-wide"
                : "mt-2 text-[12px] text-white/55 tracking-wide"
            }
          >
            {streakCount} {streakCount === 1 ? "visit" : "visits"} in a row
          </p>
        )}
      </div>

      <p
        className={
          isWarm
            ? "text-[#5b4a3e] text-[14px] font-normal mb-10 text-center max-w-[300px] leading-relaxed"
            : "text-white/55 text-[14px] font-light mb-10 text-center max-w-[300px] leading-relaxed"
        }
      >
        {subtitle}
      </p>

      {extra && <div className="w-full mb-6">{extra}</div>}

      <div className="w-full space-y-3 relative z-10">
        {onReset && (
          <Button
            onClick={onReset}
            variant="outline"
            className={
              isWarm
                ? "w-full rounded-full border-black/10 bg-white/70 text-[#2a1c14] hover:bg-white hover:border-black/15 h-14 font-medium transition-colors duration-base"
                : "w-full rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:border-white/25 h-14 font-medium transition-colors duration-base"
            }
          >
            <RotateCcw className="w-4 h-4 mr-2 opacity-70" />
            {resetLabel}
          </Button>
        )}
        <Button
          onClick={primary.onClick}
          className={
            isWarm
              ? "w-full rounded-full bg-[#4f6b3f] hover:bg-[#3f5833] text-white font-medium h-14 shadow-[0_6px_20px_rgba(79,107,63,0.28)] transition-colors duration-base"
              : `w-full rounded-full ${accent.bg} hover:brightness-110 text-black font-medium h-14 shadow-lg transition-colors duration-base`
          }
        >
          {primary.icon && <span className="mr-2 inline-flex">{primary.icon}</span>}
          {primary.label}
        </Button>
      </div>
    </motion.div>
  );
}
