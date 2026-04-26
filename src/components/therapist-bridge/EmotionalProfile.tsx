import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockProfile } from "@/lib/mock/therapist-bridge";
import { MoodChart } from "./MoodChart";
import { PatternsCard } from "./PatternsCard";
import { TopicCloud } from "./TopicCloud";
import { AssessmentScores } from "./AssessmentScores";
import { Activity, Brain, Hash, ClipboardList } from "lucide-react";

function Panel({
  icon: Icon,
  title,
  children,
  className = "",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`tb-shadow-card rounded-2xl border-border/60 ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function EmotionalProfileSection() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Panel icon={Activity} title="Mood — last 7 days" className="lg:col-span-2">
        <MoodChart data={mockProfile.mood7d} />
      </Panel>
      <Panel icon={Brain} title="Top patterns">
        <PatternsCard patterns={mockProfile.patterns} />
      </Panel>
      <Panel icon={ClipboardList} title="Assessments">
        <AssessmentScores scores={mockProfile.assessments} />
      </Panel>
      <Panel icon={Hash} title="What you've been talking about" className="lg:col-span-4">
        <TopicCloud topics={mockProfile.topics} />
      </Panel>
    </div>
  );
}
