import { useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronDown, ChevronUp, Star, RotateCcw, Phone, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import CrisisOverlay from "./CrisisOverlay";
import { recordCompletion } from "@/lib/mindgym/storage";
import { syncMindGymClinicalDataToSupabase } from "@/lib/api/syncMindGymClinicalData";
import type { ToolId } from "@/lib/mindgym/types";

// Generate soothing background particles once per mount
const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2 + 1,
  duration: Math.random() * 20 + 20,
  delay: Math.random() * 15,
  opacity: Math.random() * 0.15 + 0.05,
}));

interface ToolShellProps {
  toolId: ToolId;
  title: string;
  clinicalBasis: string;
  xp: number;
  children: ReactNode;
  completed?: boolean;
  onReset?: () => void;
  totalSteps?: number;
  currentStep?: number;
  onAvatarCue?: (text: string, emotion: string) => void;
  // Optional theming prop to allow individual tools to inject specific color palettes (e.g. Amber for worry vault)
  themeColor?: string;
  themeAccent?: "teal" | "purple" | "indigo" | "rose" | "amber" | "sky" | "emerald";
  surfaceTone?: "dark" | "warm";
  showChrome?: boolean;
  showCompletionScreen?: boolean;
  showParticles?: boolean;
  showSupportButton?: boolean;
  contentPlacement?: "center" | "top";
}

export default function ToolShell({
  toolId,
  title,
  clinicalBasis,
  xp,
  children,
  completed = false,
  onReset,
  totalSteps,
  currentStep,
  themeColor = "from-slate-900 via-[#111822] to-slate-900",
  themeAccent = "teal",
  surfaceTone = "dark",
  showChrome = true,
  showCompletionScreen = true,
  showParticles = true,
  showSupportButton = true,
  contentPlacement = "center"
}: ToolShellProps) {
  const navigate = useNavigate();
  const [whyOpen, setWhyOpen] = useState(false);
  const [crisisOpen, setCrisisOpen] = useState(false);
  const [hasRecorded, setHasRecorded] = useState(false);

  useEffect(() => {
    if (!completed || hasRecorded) return;
    recordCompletion(toolId, xp);
    setHasRecorded(true);

    // ✅ NEW MINDGYM GAP BRIDGE: Immediately extract all offline tools safely to cloud backend 
    void syncMindGymClinicalDataToSupabase().then(res => {
      if (res.success && res.synced.length > 0) {
        console.log("[TherapistBridge] Synced Clinical payload for:", res.synced);
      }
    });

  }, [completed, hasRecorded, toolId, xp]);

  // Derived styling based on explicit themeAccent
  const getThemeVars = () => {
    switch (themeAccent) {
      case "amber": return { accent: "text-amber-400", bg: "bg-amber-400" };
      case "rose": return { accent: "text-rose-400", bg: "bg-rose-400" };
      case "indigo": return { accent: "text-indigo-400", bg: "bg-indigo-400" };
      case "purple": return { accent: "text-purple-400", bg: "bg-purple-400" };
      case "sky": return { accent: "text-sky-400", bg: "bg-sky-400" };
      case "emerald": return { accent: "text-emerald-400", bg: "bg-emerald-400" };
      case "teal":
      default: return { accent: "text-teal-400", bg: "bg-teal-400" };
    }
  };

  const theme = getThemeVars();
  const isWarmTone = surfaceTone === "warm";
  const rootStyle = isWarmTone ? { color: "hsl(var(--text-primary))" } : undefined;
  const shouldRenderCompletion = showCompletionScreen && completed;
  const contentClasses = contentPlacement === "top"
    ? "flex-1 w-full flex flex-col justify-start items-stretch z-10 relative pt-6 pb-8 min-h-[calc(100vh-100px)]"
    : "flex-1 w-full flex flex-col justify-center items-center z-10 relative pt-24 pb-8 min-h-[calc(100vh-100px)]";

  return (
    <div
      className={`qc-tone mindgym-root min-h-screen relative overflow-hidden flex flex-col items-center select-none bg-gradient-to-b ${themeColor} transition-colors duration-[2s] ${isWarmTone ? "text-foreground" : ""}`}
      style={rootStyle}
    >

      {/* Background Particles layer */}
      {showParticles && (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          {PARTICLES.map((p) => (
            <motion.div
              key={p.id}
              className={isWarmTone ? "absolute rounded-full bg-emerald-200/55 blur-[1px]" : "absolute rounded-full bg-white blur-[1px]"}
              style={{
                width: p.size,
                height: p.size,
                left: `${p.x}%`,
                top: `${p.y}%`,
              }}
              animate={{
                y: [0, -36, 18, 0],
                x: [0, 18, -12, 0],
                opacity: [p.opacity, p.opacity * 1.25, p.opacity],
              }}
              transition={{
                duration: p.duration * 2.4,
                repeat: Infinity,
                ease: "easeInOut",
                delay: p.delay,
              }}
            />
          ))}
          {/* Soft radial glow overlay */}
          <div
            className={isWarmTone
              ? "absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.78)_0%,rgba(255,255,255,0)_60%)] pointer-events-none"
              : "absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.02)_0%,rgba(0,0,0,0)_60%)] pointer-events-none"
            }
          />
        </div>
      )}

      {/* Floating Glass Pill Navigation */}
      {showChrome && (
        <div className="fixed top-2 left-0 w-full z-40 px-4 pt-4 sm:pt-6 flex justify-center pointer-events-none">
          <div className="w-full max-w-2xl pointer-events-auto">
            <div className={isWarmTone ? "bg-white/75 backdrop-blur-xl border border-border rounded-3xl flex items-center justify-between px-3 py-2.5 shadow-[0_20px_60px_-30px_rgba(62,84,60,0.28)]" : "bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl flex items-center justify-between px-3 py-2.5 shadow-2xl"}>
              <button
                onClick={() => navigate("/mindgym")}
                className={isWarmTone ? "flex items-center justify-center w-10 h-10 rounded-full bg-white/90 hover:bg-white text-muted-foreground hover:text-foreground transition-all shadow-sm" : "flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all"}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div className="flex flex-col items-center justify-center mx-2 flex-grow overflow-hidden">
                <h1 className={isWarmTone ? "text-sm font-medium text-foreground drop-shadow-sm truncate w-full text-center tracking-wide" : "text-sm font-medium text-white/90 drop-shadow-sm truncate w-full text-center tracking-wide"}>{title}</h1>
                {totalSteps != null && currentStep != null && (
                  <div className={isWarmTone ? "w-24 h-1 bg-black/10 rounded-full mt-1.5 overflow-hidden flex shadow-inner" : "w-24 h-1 bg-black/20 rounded-full mt-1.5 overflow-hidden flex shadow-inner"}>
                    {Array.from({ length: totalSteps }, (_, i) => (
                      <div
                        key={i}
                        className={`h-full flex-1 transition-all duration-500 ease-out border-r border-black/10 last:border-0 ${i < currentStep ? theme.bg : i === currentStep ? `${theme.bg} opacity-50` : "bg-transparent"
                          }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setWhyOpen(!whyOpen)}
                className={`flex items-center justify-center h-10 px-3 rounded-full transition-all outline-none ${isWarmTone ? (whyOpen ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-white/90 hover:text-foreground') : (whyOpen ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/90')}`}
                title="Why this works"
              >
                {whyOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            <AnimatePresence>
              {whyOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 8 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ type: "spring", stiffness: 48, damping: 38, mass: 1.1 }}
                  className={isWarmTone ? "mx-auto w-[90%] bg-white/92 backdrop-blur-2xl border border-border rounded-2xl p-4 shadow-[0_24px_80px_-40px_rgba(62,84,60,0.28)]" : "mx-auto w-[90%] bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-2xl"}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl ${isWarmTone ? 'bg-primary/10' : 'bg-white/5'} ${theme.accent}`}>
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className={isWarmTone ? "text-[13px] font-medium text-ink-7 mb-1" : "text-[13px] font-medium text-white/90 mb-1"}>Why this helps</h3>
                      <p className={isWarmTone ? "text-base text-foreground/80 leading-7 font-normal max-w-prose" : "text-sm text-white/70 leading-relaxed font-light"}>
                        {clinicalBasis}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        {shouldRenderCompletion ? (
          <motion.div
            key="completion"
            className="relative z-10 w-full max-w-md mx-auto px-6 h-screen flex flex-col items-center justify-center pb-20 pt-16"
            initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ type: "spring", stiffness: 36, damping: 38, mass: 1.25 }}
          >
            <div
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] rounded-full blur-[80px] opacity-[0.14] pointer-events-none ${theme.bg}`}
              aria-hidden
            />

            <div className={`w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-8 backdrop-blur-md relative`}>
              <Star className={`w-10 h-10 ${theme.accent} drop-shadow-lg relative z-10`} fill="currentColor" />
            </div>

            <h2 className="font-display text-2xl sm:text-3xl font-normal mb-3 text-white tracking-tight drop-shadow-md text-center">You showed up for yourself</h2>
            <div className="flex flex-col items-center justify-center bg-black/20 rounded-2xl px-8 py-5 border border-white/5 mb-10 shadow-inner backdrop-blur-sm">
              <p className="text-white/45 text-[12px] font-medium mb-1">A small acknowledgment</p>
              <p className={`text-3xl font-medium ${theme.accent} drop-shadow-[0_0_15px_rgba(255,255,255,0.08)]`}>+{xp} gentle points</p>
            </div>

            <p className="text-white/50 text-sm font-light mb-10 text-center max-w-[280px] leading-relaxed">
              Take a slow breath. Nothing here is judging you — you can leave this screen whenever you like.
            </p>

            <div className="w-full space-y-3 relative z-10">
              {onReset && (
                <Button
                  onClick={() => { setHasRecorded(false); onReset(); }}
                  variant="outline"
                  className="w-full rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20 h-14 font-medium transition-colors duration-base"
                >
                  <RotateCcw className="w-4 h-4 mr-2 opacity-70" />
                  Go through it again
                </Button>
              )}
              <Button
                onClick={() => navigate("/mindgym")}
                className={`w-full rounded-full ${theme.bg} hover:brightness-110 text-black font-medium h-14 shadow-lg transition-colors duration-base`}
              >
                Back to practices
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            className={contentClasses}
            initial={{ opacity: 0, filter: "blur(4px)", y: 8 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            exit={{ opacity: 0, filter: "blur(4px)", y: 6 }}
            transition={{ type: "spring", stiffness: 40, damping: 38, mass: 1.2 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent crisis button */}
      {showSupportButton && (
        <div className="fixed bottom-safe right-4 z-40 pb-4">
          <button
            onClick={() => setCrisisOpen(true)}
            className={isWarmTone ? "flex items-center gap-2 px-4 py-2.5 rounded-full bg-rose-500/10 backdrop-blur-md border border-rose-500/20 text-rose-700 text-xs font-semibold hover:bg-rose-500/20 shadow-lg transition-all" : "flex items-center gap-2 px-4 py-2.5 rounded-full bg-rose-500/10 backdrop-blur-md border border-rose-500/20 text-rose-300 text-xs font-semibold hover:bg-rose-500/20 shadow-lg transition-all"}
          >
            <Phone className="w-3.5 h-3.5" />
            Support
          </button>
        </div>
      )}

      {showSupportButton && <CrisisOverlay open={crisisOpen} onClose={() => setCrisisOpen(false)} />}
    </div>
  );
}
