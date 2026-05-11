import { type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { AccentSwatch, SurfaceTone } from "@/lib/mindgym/theme";

interface HeaderPillProps {
  title: string;
  tone: SurfaceTone;
  accent: AccentSwatch;
  // Optional step progress bar (only renders when both are provided).
  currentStep?: number;
  totalSteps?: number;
  // Slot for a right-side control (e.g. why-toggle, audio toggle).
  right?: ReactNode;
  // Custom back content — defaults to a circular arrow button to /mindgym.
  back?: ReactNode;
  // Soft breadcrumb slot rendered below the pill (Phase 3 wires this in).
  breadcrumb?: ReactNode;
}

export default function HeaderPill({
  title,
  tone,
  accent,
  currentStep,
  totalSteps,
  right,
  back,
  breadcrumb,
}: HeaderPillProps) {
  const navigate = useNavigate();
  const isWarm = tone === "warm";

  const defaultBack = (
    <button
      onClick={() => navigate("/mindgym")}
      aria-label="Back to MindGym"
      className={
        isWarm
          ? "flex items-center justify-center w-10 h-10 rounded-full bg-white/90 hover:bg-white text-muted-foreground hover:text-foreground transition-all shadow-sm"
          : "flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all"
      }
    >
      <ArrowLeft className="w-4 h-4" />
    </button>
  );

  return (
    <div className="fixed top-2 left-0 w-full z-40 px-4 pt-4 sm:pt-6 flex justify-center pointer-events-none">
      <div className="w-full max-w-2xl pointer-events-auto">
        <div
          className={
            isWarm
              ? "bg-white/75 backdrop-blur-xl border border-border rounded-3xl flex items-center justify-between px-3 py-2.5 shadow-[0_20px_60px_-30px_rgba(62,84,60,0.28)]"
              : "bg-white/10 backdrop-blur-md border border-white/10 rounded-3xl flex items-center justify-between px-3 py-2.5 shadow-lg"
          }
        >
          {back ?? defaultBack}

          <div className="flex flex-col items-center justify-center mx-2 flex-grow overflow-hidden">
            <h1
              className={
                isWarm
                  ? "font-serif-display text-[15px] font-normal text-[#2a1c14] truncate w-full text-center tracking-tight"
                  : "font-serif-display italic text-[15px] font-normal text-white/95 truncate w-full text-center tracking-tight drop-shadow-sm"
              }
            >
              {title}
            </h1>
            {totalSteps != null && currentStep != null && (
              <div
                className={
                  isWarm
                    ? "w-24 h-1 bg-black/10 rounded-full mt-1.5 overflow-hidden flex shadow-inner"
                    : "w-24 h-1 bg-black/20 rounded-full mt-1.5 overflow-hidden flex shadow-inner"
                }
              >
                {Array.from({ length: totalSteps }, (_, i) => (
                  <div
                    key={i}
                    className={`h-full flex-1 transition-all duration-500 ease-out border-r border-black/10 last:border-0 ${
                      i < currentStep
                        ? accent.bg
                        : i === currentStep
                          ? `${accent.bg} opacity-50`
                          : "bg-transparent"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end min-w-[40px]">
            {right}
          </div>
        </div>

        {breadcrumb && <div className="mt-2 text-center">{breadcrumb}</div>}
      </div>
    </div>
  );
}

interface WhyDrawerProps {
  open: boolean;
  clinicalBasis: string;
  tone: SurfaceTone;
  accent: AccentSwatch;
}

// Disclosure drawer that anchors below the pill. ToolShell mounts this just after HeaderPill.
export function WhyDrawer({ open, clinicalBasis, tone, accent }: WhyDrawerProps) {
  const isWarm = tone === "warm";
  return (
    <div className="fixed top-2 left-0 w-full z-30 px-4 pt-[4.75rem] sm:pt-[5.25rem] flex justify-center pointer-events-none">
      <div className="w-full max-w-2xl pointer-events-auto">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 8 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: "spring", stiffness: 48, damping: 38, mass: 1.1 }}
              className={
                isWarm
                  ? "mx-auto w-[90%] bg-white/92 backdrop-blur-2xl border border-border rounded-2xl p-4 shadow-[0_24px_80px_-40px_rgba(62,84,60,0.28)]"
                  : "mx-auto w-[90%] bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-2xl"
              }
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-xl ${isWarm ? "bg-primary/10" : "bg-white/5"} ${accent.text}`}
                >
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3
                    className={
                      isWarm
                        ? "text-[13px] font-medium text-ink-7 mb-1"
                        : "text-[13px] font-medium text-white/90 mb-1"
                    }
                  >
                    Why this helps
                  </h3>
                  <p
                    className={
                      isWarm
                        ? "text-base text-foreground/80 leading-7 font-normal max-w-prose"
                        : "text-sm text-white/70 leading-relaxed font-light"
                    }
                  >
                    {clinicalBasis}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
