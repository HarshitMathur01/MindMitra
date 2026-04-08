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
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
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
