import { Card } from "@/components/ui/card";
import { EmotionalProfile as EmotionalProfileType } from "@/lib/types/therapist-bridge";
import MoodChart from "@/components/therapist-bridge/MoodChart";
import PatternsCard from "@/components/therapist-bridge/PatternsCard";
import TopicCloud from "@/components/therapist-bridge/TopicCloud";
import AssessmentScores from "@/components/therapist-bridge/AssessmentScores";
import CrisisEvents from "@/components/therapist-bridge/CrisisEvents";

interface EmotionalProfileProps {
  profile: EmotionalProfileType;
}

const EmotionalProfile = ({ profile }: EmotionalProfileProps) => {
  return (
    <section id="emotional-profile" className="mb-12">
      <h2 className="text-2xl md:text-3xl font-bold mb-6">Your Emotional Profile</h2>

      <Card className="p-6 mb-6 shadow-md hover:shadow-lg transition-shadow">
        <h3 className="text-xl font-bold mb-4">Mood Trends (Last 30 Days)</h3>
        <MoodChart data={profile.moodTrends} />
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <PatternsCard patterns={profile.patterns} />
        <TopicCloud topics={profile.topics} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <AssessmentScores assessments={profile.assessments} />
        <CrisisEvents events={profile.crisisEvents} />
      </div>
    </section>
  );
};

export default EmotionalProfile;