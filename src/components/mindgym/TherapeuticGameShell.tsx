import { useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, BookOpen, VolumeX, CloudRain, Trees, Wind } from "lucide-react";
import { useNavigate } from "react-router-dom";
import HeaderPill from "./shared/HeaderPill";
import CompletionScreen from "./shared/CompletionScreen";
import ParticleField from "./shared/ParticleField";
import SupportButton from "./shared/SupportButton";
import Breadcrumb from "./shared/Breadcrumb";
import NextToolHandoff from "./shared/NextToolHandoff";
import { useAmbientAudio, type AudioTrack } from "./shared/useAmbientAudio";
import {
  GAME_PHASE_GRADIENTS,
  getAccent,
  type GamePhase,
  type ThemeAccent,
} from "@/lib/mindgym/theme";
import { MINDGYM_TOOLS, MINDGYM_SECTIONS } from "@/lib/mindgym/catalog";
import { TOOL_IDS, type ToolId } from "@/lib/mindgym/types";
import { trackMindGymEvent } from "@/lib/mindgym/analytics";

interface TherapeuticGameShellProps {
  title: string;
  gameId: string;
  xp?: number;
  completed?: boolean;
  onReset?: () => void;
  children: ReactNode;
  themePhase?: GamePhase;
  themeAccent?: ThemeAccent;
  streakCount?: number;
  fitViewport?: boolean;
}

const THEME_AFFIRMATIONS = [
  "You are doing your best, and that is enough.",
  "Every small step is progress.",
  "Let go of perfection. Be here now.",
  "Your mind is a sky; thoughts are just clouds passing by.",
  "Breathe in calm, breathe out tension.",
];

export default function TherapeuticGameShell({
  title,
  gameId,
  xp = 10,
  completed = false,
  onReset,
  children,
  themePhase = "idle",
  themeAccent = "teal",
  streakCount = 1,
  fitViewport = false,
}: TherapeuticGameShellProps) {
  const navigate = useNavigate();
  const [audioTrack, setAudioTrack] = useState<AudioTrack>("none");
  const [quoteIdx, setQuoteIdx] = useState(0);

  const tool = MINDGYM_TOOLS.find((t) => t.id === gameId);
  const section = tool ? MINDGYM_SECTIONS.find((s) => s.id === tool.section) : undefined;
  const breadcrumbTrail = section ? ["Mind Gym", section.title, title] : ["Mind Gym", title];
  const knownToolId = (TOOL_IDS as readonly string[]).includes(gameId)
    ? (gameId as ToolId)
    : null;

  useEffect(() => {
    if (knownToolId) trackMindGymEvent("tool_started", { toolId: knownToolId });
  }, [knownToolId]);

  useEffect(() => {
    if (completed && knownToolId) {
      trackMindGymEvent("tool_completed", { toolId: knownToolId, xp });
    }
  }, [completed, knownToolId, xp]);

  useAmbientAudio(audioTrack);

  useEffect(() => {
    if (completed) return;
    const int = setInterval(() => {
      setQuoteIdx((prev) => (prev + 1) % THEME_AFFIRMATIONS.length);
    }, 15000);
    return () => clearInterval(int);
  }, [completed]);

  const accent = getAccent("dark", themeAccent);

  const audioToggle = (
    <button
      onClick={() =>
        setAudioTrack((prev) => {
          if (prev === "none") return "brown-noise";
          if (prev === "brown-noise") return "rain";
          if (prev === "rain") return "forest";
          return "none";
        })
      }
      aria-label="Cycle ambient audio"
      className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 transition-colors"
    >
      {audioTrack === "none" && <VolumeX className="w-4 h-4 text-white/50" />}
      {audioTrack === "brown-noise" && <Wind className="w-4 h-4 text-teal-400" />}
      {audioTrack === "rain" && <CloudRain className="w-4 h-4 text-blue-400" />}
      {audioTrack === "forest" && <Trees className="w-4 h-4 text-green-400" />}
    </button>
  );

  // TGS uses a labeled back affordance ("MindGym" alongside the arrow).
  const backControl = (
    <button
      onClick={() => navigate("/mindgym")}
      className="flex items-center gap-2 text-white/70 hover:text-white transition-colors px-2 h-10 rounded-full"
    >
      <ArrowLeft className="w-4 h-4" />
      <span className="text-[13px] font-medium tracking-wide">MindGym</span>
    </button>
  );

  return (
    <div
      className={`relative ${fitViewport ? "flex h-screen flex-col" : "min-h-screen"} bg-gradient-to-b ${GAME_PHASE_GRADIENTS[themePhase]} transition-colors duration-1000 overflow-hidden font-sans text-white/90`}
    >
      <ParticleField tone="dark" count={28} motion="rising" />

      <HeaderPill
        title={title}
        tone="dark"
        accent={accent}
        right={audioToggle}
        back={backControl}
        breadcrumb={<Breadcrumb trail={breadcrumbTrail} tone="dark" />}
      />

      <AnimatePresence mode="wait">
        {!completed && (
          <motion.div
            key={quoteIdx}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 1 }}
            className={`max-w-2xl mx-auto px-6 text-center z-20 relative ${fitViewport ? "mt-24" : "mt-28"}`}
          >
            <p className="text-xs text-white/40 italic tracking-wide">
              {THEME_AFFIRMATIONS[quoteIdx]}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <main
        className={`max-w-2xl mx-auto px-4 z-10 relative flex w-full flex-col justify-center ${
          fitViewport ? "min-h-0 flex-1 overflow-hidden pt-3 pb-4" : "min-h-[60vh] pt-6 pb-24"
        }`}
      >
        <AnimatePresence mode="wait">
          {completed ? (
            <CompletionScreen
              key="completion"
              tone="dark"
              accent={accent}
              xp={xp}
              streakCount={streakCount}
              subtitle="Take a moment to notice how your mind and body feel right now."
              primary={{
                label: "Write in journal",
                onClick: () => navigate("/journal"),
                icon: <BookOpen className="w-5 h-5" />,
              }}
              onReset={onReset}
              resetLabel="Try again"
              extra={
                knownToolId ? (
                  <NextToolHandoff currentToolId={knownToolId} tone="dark" />
                ) : undefined
              }
            />
          ) : (
            <motion.div
              key="game"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ type: "spring", stiffness: 44, damping: 38, mass: 1.15 }}
              className="w-full"
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <SupportButton tone="dark" />
    </div>
  );
}
