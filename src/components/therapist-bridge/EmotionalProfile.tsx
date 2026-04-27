import { mockProfile } from "@/lib/mock/therapist-bridge";
import { MoodChart } from "./MoodChart";
import { PatternsCard } from "./PatternsCard";
import { TopicCloud } from "./TopicCloud";
import { AssessmentScores } from "./AssessmentScores";

function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-[rgba(0,0,0,0.04)] bg-[#FBF6EC] p-8 shadow-[0_1px_3px_rgba(0,0,0,0.03)] ${className}`}
    >
      <p className="qc-eyebrow">{title}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function EmotionalProfileSection() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Panel title="Mood — last seven days" className="lg:col-span-2">
        <MoodChart data={mockProfile.mood7d} />
      </Panel>
      <Panel title="Top patterns">
        <PatternsCard patterns={mockProfile.patterns} />
      </Panel>
      <Panel title="Assessments">
        <AssessmentScores scores={mockProfile.assessments} />
      </Panel>
      <Panel title="What you've been talking about" className="lg:col-span-4">
        <TopicCloud topics={mockProfile.topics} />
      </Panel>
    </div>
  );
}
