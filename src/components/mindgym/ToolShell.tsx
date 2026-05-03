import { useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronDown, ChevronUp, Star, RotateCcw, Phone, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import CrisisOverlay from "./CrisisOverlay";
import MindGymBackdrop, { type MindGymScene } from "./MindGymBackdrop";
import { recordCompletion } from "@/lib/mindgym/storage";
import { syncMindGymClinicalDataToSupabase } from "@/lib/api/syncMindGymClinicalData";
import type { ToolId } from "@/lib/mindgym/types";

// Generate soothing background motes once per mount
const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2 + 1,
  duration: Math.random() * 20 + 20,
  delay: Math.random() * 15,
  opacity: Math.random() * 0.15 + 0.05,
}));

type ThemeAccent = "teal" | "purple" | "indigo" | "rose" | "amber" | "sky" | "emerald" | "clay";

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
  themeColor?: string;
  themeAccent?: ThemeAccent;
  surfaceTone?: "dark" | "warm";
  showChrome?: boolean;
  showCompletionScreen?: boolean;
  showParticles?: boolean;
  showSupportButton?: boolean;
  contentPlacement?: "center" | "top";
  backdropScene?: MindGymScene;
}

// Warm "Quiet Companion" accent palette — sage / peach / honey / blush.
// These replace the neon Tailwind 400-shades that the dark surface used.
const WARM_ACCENTS: Record<ThemeAccent, { text: string; bg: string; hex: string }> = {
  teal: { text: "text-[#3F6B47]", bg: "bg-[#9CAF88]", hex: "#9CAF88" },
  emerald: { text: "text-[#4f6b3f]", bg: "bg-[#8FB07A]", hex: "#8FB07A" },
  amber: { text: "text-[#a06b1f]", bg: "bg-[#E8C97A]", hex: "#E8C97A" },
  rose: { text: "text-[#a04a52]", bg: "bg-[#E8938A]", hex: "#E8938A" },
  purple: { text: "text-[#5b4a82]", bg: "bg-[#B8A6D9]", hex: "#B8A6D9" },
  indigo: { text: "text-[#3a4a6b]", bg: "bg-[#8FA0C2]", hex: "#8FA0C2" },
  sky: { text: "text-[#7a5a3a]", bg: "bg-[#E8D5B8]", hex: "#E8D5B8" },
  clay: { text: "text-[#b2613a]", bg: "bg-[#E8B98A]", hex: "#E8B98A" },
};

const DARK_ACCENTS: Record<ThemeAccent, { text: string; bg: string; hex: string }> = {
  teal: { text: "text-teal-400", bg: "bg-teal-400", hex: "#2dd4bf" },
  emerald: { text: "text-emerald-400", bg: "bg-emerald-400", hex: "#34d399" },
  amber: { text: "text-amber-400", bg: "bg-amber-400", hex: "#fbbf24" },
  rose: { text: "text-rose-400", bg: "bg-rose-400", hex: "#fb7185" },
  purple: { text: "text-purple-400", bg: "bg-purple-400", hex: "#c084fc" },
  indigo: { text: "text-indigo-400", bg: "bg-indigo-400", hex: "#818cf8" },
  sky: { text: "text-sky-400", bg: "bg-sky-400", hex: "#38bdf8" },
  clay: { text: "text-orange-400", bg: "bg-orange-400", hex: "#fb923c" },
};

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
  themeColor,
  themeAccent = "teal",
  surfaceTone = "warm",
  showChrome = true,
  showCompletionScreen = true,
  showParticles = true,
  showSupportButton = true,
  contentPlacement = "center",
  backdropScene,
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

  const isWarmTone = surfaceTone === "warm";
  const theme = isWarmTone ? WARM_ACCENTS[themeAccent] : DARK_ACCENTS[themeAccent];
  const resolvedThemeColor =
    themeColor ?? (isWarmTone
      ? "from-[#FAF6EC] via-[#F5EDE0] to-[#F3E7D2]"
      : "from-slate-900 via-[#111822] to-slate-900");
  const rootStyle = isWarmTone ? { color: "hsl(var(--text-primary))" } : undefined;
  const shouldRenderCompletion = showCompletionScreen && completed;
  const contentClasses = contentPlacement === "top"
    ? "flex-1 w-full flex flex-col justify-start items-stretch z-10 relative pt-6 pb-8 min-h-[calc(100vh-100px)]"
    : "flex-1 w-full flex flex-col justify-center items-center z-10 relative pt-24 pb-8 min-h-[calc(100vh-100px)]";

  return (
    <div
      className={`qc-tone mindgym-root min-h-screen relative overflow-hidden flex flex-col items-center select-none bg-gradient-to-b ${resolvedThemeColor} transition-colors duration-[2s] ${isWarmTone ? "text-foreground" : ""}`}
      style={rootStyle}
    >
      {/* Handcrafted backdrop — sits behind the gradient, ahead of nothing */}
      {backdropScene && isWarmTone && (
        <MindGymBackdrop scene={backdropScene} variant="faded" />
      )}

      {/* Background motes layer */}
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

      {/* Floating glass pill navigation */}
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
                <h1 className={isWarmTone ? "font-serif-display text-[15px] font-normal text-[#2a1c14] truncate w-full text-center tracking-tight" : "text-sm font-medium text-white/90 drop-shadow-sm truncate w-full text-center tracking-wide"}>{title}</h1>
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
                    <div className={`p-2 rounded-xl ${isWarmTone ? 'bg-primary/10' : 'bg-white/5'} ${theme.text}`}>
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

      {/* Main content area */}
      <AnimatePresence mode="wait">
        {shouldRenderCompletion ? (
          <motion.div
            key="completion"
            className="relative z-10 w-full max-w-md mx-auto px-6 h-screen flex flex-col items-center justify-center pb-20 pt-16"
            initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ type: "spring", stiffness: 36, damping: 38, mass: 1.25 }}
          >
            {isWarmTone ? (
              <>
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] rounded-full blur-[100px] opacity-[0.22] pointer-events-none"
                  style={{ backgroundColor: theme.hex }}
                  aria-hidden
                />

                <div
                  className="w-24 h-24 rounded-full bg-[#FBF6EC] border border-black/5 flex items-center justify-center mx-auto mb-8 shadow-[0_10px_28px_-12px_rgba(80,60,40,0.18)] relative"
                >
                  <Star className={`w-10 h-10 ${theme.text} relative z-10`} fill="currentColor" />
                </div>

                <h2 className="font-serif-display italic text-[2rem] sm:text-[2.4rem] font-light mb-3 text-[#2a1c14] tracking-tight text-center leading-tight">
                  You showed up for yourself
                </h2>

                <div className="flex flex-col items-center justify-center bg-[#FBF6EC]/85 rounded-2xl px-8 py-5 border border-black/5 mb-10 shadow-[0_8px_24px_-14px_rgba(80,60,40,0.18)] backdrop-blur-sm">
                  <p className="text-[#9a8674] text-[11px] font-medium uppercase tracking-[0.22em] mb-1">A small acknowledgment</p>
                  <p
                    className={`text-[2.2rem] ${theme.text}`}
                    style={{ fontFamily: "var(--font-script), cursive", lineHeight: 1.1 }}
                  >
                    +{xp} gentle points
                  </p>
                </div>

                <p className="text-[#5b4a3e] text-[14px] font-normal mb-10 text-center max-w-[300px] leading-relaxed">
                  Take a slow breath. Nothing here is judging you — you can leave this screen whenever you like.
                </p>

                <div className="w-full space-y-3 relative z-10">
                  {onReset && (
                    <Button
                      onClick={() => { setHasRecorded(false); onReset(); }}
                      variant="outline"
                      className="w-full rounded-full border-black/10 bg-white/70 text-[#2a1c14] hover:bg-white hover:border-black/15 h-14 font-medium transition-colors duration-base"
                    >
                      <RotateCcw className="w-4 h-4 mr-2 opacity-70" />
                      Go through it again
                    </Button>
                  )}
                  <Button
                    onClick={() => navigate("/mindgym")}
                    className="w-full rounded-full bg-[#4f6b3f] hover:bg-[#3f5833] text-white font-medium h-14 shadow-[0_6px_20px_rgba(79,107,63,0.28)] transition-colors duration-base"
                  >
                    Back to practices
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div
                  className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] rounded-full blur-[80px] opacity-[0.14] pointer-events-none ${theme.bg}`}
                  aria-hidden
                />

                <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-8 backdrop-blur-md relative">
                  <Star className={`w-10 h-10 ${theme.text} drop-shadow-lg relative z-10`} fill="currentColor" />
                </div>

                <h2 className="font-display text-2xl sm:text-3xl font-normal mb-3 text-white tracking-tight drop-shadow-md text-center">You showed up for yourself</h2>
                <div className="flex flex-col items-center justify-center bg-black/20 rounded-2xl px-8 py-5 border border-white/5 mb-10 shadow-inner backdrop-blur-sm">
                  <p className="text-white/45 text-[12px] font-medium mb-1">A small acknowledgment</p>
                  <p className={`text-3xl font-medium ${theme.text} drop-shadow-[0_0_15px_rgba(255,255,255,0.08)]`}>+{xp} gentle points</p>
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
              </>
            )}
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
