import { lazy, Suspense } from "react";
import { useParams, Navigate } from "react-router-dom";
import { TOOL_IDS, type ToolId } from "@/lib/mindgym/types";

const TOOL_COMPONENTS: Record<ToolId, ReturnType<typeof lazy>> = {
  "breath-sphere": lazy(() => import("./tools/BreathSphere")),
  "thought-trap": lazy(() => import("./tools/ThoughtTrap")),
  "emotion-compass": lazy(() => import("./tools/EmotionCompass")),
  "worry-vault": lazy(() => import("./tools/WorryVault")),
  "mood-weather": lazy(() => import("./tools/MoodWeather")),
  "five-senses": lazy(() => import("./tools/FiveSenses")),
  "inner-critic": lazy(() => import("./tools/InnerCritic")),
  "gratitude-garden": lazy(() => import("./tools/GratitudeGarden")),
  "focus-flow": lazy(() => import("./tools/FocusFlow")),
};

function Loader() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6">
      <div
        className="h-9 w-9 rounded-full border-2 border-[hsl(var(--accent-200))] border-t-[hsl(var(--accent-500))] animate-spin"
        style={{ animationDuration: "1.1s" }}
        aria-hidden
      />
      <p className="text-[14px] text-ink-6 text-center">Opening this practice…</p>
    </div>
  );
}

export default function MindGymToolPage() {
  const { toolId } = useParams<{ toolId: string }>();

  if (!toolId || !TOOL_IDS.includes(toolId as ToolId)) {
    return <Navigate to="/mindgym" replace />;
  }

  const Component = TOOL_COMPONENTS[toolId as ToolId];

  return (
    <Suspense fallback={<Loader />}>
      <Component />
    </Suspense>
  );
}
