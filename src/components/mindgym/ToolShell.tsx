import { useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MindGymBackdrop, { type MindGymScene } from "./MindGymBackdrop";
import HeaderPill, { WhyDrawer } from "./shared/HeaderPill";
import CompletionScreen from "./shared/CompletionScreen";
import ParticleField from "./shared/ParticleField";
import SupportButton from "./shared/SupportButton";
import Breadcrumb from "./shared/Breadcrumb";
import NextToolHandoff from "./shared/NextToolHandoff";
import { getAccent, MINDGYM_SURFACE_GRADIENTS, type ThemeAccent } from "@/lib/mindgym/theme";
import { recordCompletion } from "@/lib/mindgym/storage";
import { syncMindGymClinicalDataToSupabase } from "@/lib/api/syncMindGymClinicalData";
import { MINDGYM_TOOLS, MINDGYM_SECTIONS } from "@/lib/mindgym/catalog";
import { trackMindGymEvent } from "@/lib/mindgym/analytics";
import type { ToolId } from "@/lib/mindgym/types";

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
  const [hasRecorded, setHasRecorded] = useState(false);

  useEffect(() => {
    trackMindGymEvent("tool_started", { toolId });
  }, [toolId]);

  useEffect(() => {
    if (!completed || hasRecorded) return;
    recordCompletion(toolId, xp);
    setHasRecorded(true);
    trackMindGymEvent("tool_completed", { toolId, xp });

    void syncMindGymClinicalDataToSupabase().then((res) => {
      if (res.success && res.synced.length > 0) {
        console.log("[TherapistBridge] Synced Clinical payload for:", res.synced);
      }
    });
  }, [completed, hasRecorded, toolId, xp]);

  const isWarmTone = surfaceTone === "warm";
  const accent = getAccent(surfaceTone, themeAccent);
  const tool = MINDGYM_TOOLS.find((t) => t.id === toolId);
  const section = tool ? MINDGYM_SECTIONS.find((s) => s.id === tool.section) : undefined;
  const breadcrumbTrail = section ? ["Mind Gym", section.title, title] : ["Mind Gym", title];
  const resolvedThemeColor =
    themeColor ?? (isWarmTone ? MINDGYM_SURFACE_GRADIENTS.warm : MINDGYM_SURFACE_GRADIENTS.dark);
  const rootStyle = isWarmTone ? { color: "hsl(var(--text-primary))" } : undefined;
  const shouldRenderCompletion = showCompletionScreen && completed;
  const contentClasses =
    contentPlacement === "top"
      ? "flex-1 w-full flex flex-col justify-start items-stretch z-10 relative pt-6 pb-8 min-h-[calc(100vh-100px)]"
      : "flex-1 w-full flex flex-col justify-center items-center z-10 relative pt-24 pb-8 min-h-[calc(100vh-100px)]";

  const whyToggle = (
    <button
      onClick={() => setWhyOpen(!whyOpen)}
      className={`flex items-center justify-center h-10 px-3 rounded-full transition-all outline-none ${
        isWarmTone
          ? whyOpen
            ? "bg-primary/12 text-primary"
            : "text-muted-foreground hover:bg-white/90 hover:text-foreground"
          : whyOpen
            ? "bg-white/10 text-white"
            : "text-white/50 hover:text-white/90"
      }`}
      title="Why this works"
    >
      {whyOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
    </button>
  );

  return (
    <div
      className={`qc-tone mindgym-root min-h-screen relative overflow-hidden flex flex-col items-center select-none bg-gradient-to-b ${resolvedThemeColor} transition-colors duration-[2s] ${isWarmTone ? "text-foreground" : ""}`}
      style={rootStyle}
    >
      {backdropScene && isWarmTone && (
        <MindGymBackdrop scene={backdropScene} variant="faded" />
      )}

      {showParticles && (
        <ParticleField tone={surfaceTone} motion="ambient" />
      )}

      {showChrome && (
        <>
          <HeaderPill
            title={title}
            tone={surfaceTone}
            accent={accent}
            currentStep={currentStep}
            totalSteps={totalSteps}
            right={whyToggle}
            breadcrumb={<Breadcrumb trail={breadcrumbTrail} tone={surfaceTone} />}
          />
          <WhyDrawer
            open={whyOpen}
            clinicalBasis={clinicalBasis}
            tone={surfaceTone}
            accent={accent}
          />
        </>
      )}

      <AnimatePresence mode="wait">
        {shouldRenderCompletion ? (
          <CompletionScreen
            key="completion"
            tone={surfaceTone}
            accent={accent}
            xp={xp}
            primary={{
              label: "Back to practices",
              onClick: () => navigate("/mindgym"),
            }}
            onReset={
              onReset
                ? () => {
                    setHasRecorded(false);
                    onReset();
                  }
                : undefined
            }
            extra={<NextToolHandoff currentToolId={toolId} tone={surfaceTone} />}
          />
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

      {showSupportButton && <SupportButton tone={surfaceTone} />}
    </div>
  );
}
