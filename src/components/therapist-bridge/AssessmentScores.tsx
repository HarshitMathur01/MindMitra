import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmotionalProfile } from "@/lib/types/therapist-bridge";
import { getAssessmentMaxScore, getAssessmentSeverityColor } from "@/lib/utils/emotional-profile";

interface AssessmentScoresProps {
  assessments: EmotionalProfile["assessments"];
}

const AssessmentScores = ({ assessments }: AssessmentScoresProps) => {
  return (
    <Card className="p-6 shadow-md hover:shadow-lg transition-shadow">
      <h3 className="text-xl font-bold mb-4">Assessment Scores</h3>
      <div className="space-y-5">
        {assessments.map((assessment) => {
          const maxScore = getAssessmentMaxScore(assessment.type);
          const percent = Math.round((assessment.score / maxScore) * 100);

          return (
            <div key={`${assessment.type}-${assessment.date}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold">{assessment.type}</p>
                <p className="text-sm text-muted-foreground">
                  {assessment.score}/{maxScore}
                </p>
              </div>
              <Progress value={percent} className="h-2" />
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className={`inline-block h-2 w-2 rounded-full mr-2 ${getAssessmentSeverityColor(assessment.severity)}`} />
                <span className="text-muted-foreground flex-1">{assessment.severity}</span>
                <span className="text-muted-foreground">{assessment.date}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default AssessmentScores;