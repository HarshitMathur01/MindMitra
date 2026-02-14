import { EmotionalProfile, mockProfile } from "@/lib/types/therapist-bridge";

export const generateEmotionalProfile = async (userId: string): Promise<EmotionalProfile> => {
  if (!userId) {
    throw new Error("Missing user id for profile generation");
  }

  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    ...mockProfile,
    moodTrends: mockProfile.moodTrends.map((entry, index) => ({
      ...entry,
      mood: Math.min(10, Math.max(1, entry.mood + (index % 5 === 0 ? 1 : 0))),
    })),
  };
};

export const getAssessmentMaxScore = (type: EmotionalProfile["assessments"][number]["type"]) => {
  if (type === "PHQ-9") return 27;
  if (type === "GAD-7") return 21;
  return 70;
};

export const getAssessmentSeverityColor = (severity: string) => {
  const normalized = severity.toLowerCase();
  if (normalized.includes("moderate") || normalized.includes("below")) return "bg-yellow-500";
  if (normalized.includes("severe") || normalized.includes("high")) return "bg-red-500";
  return "bg-green-500";
};