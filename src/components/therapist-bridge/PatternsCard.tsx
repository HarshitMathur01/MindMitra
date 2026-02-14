import { Card } from "@/components/ui/card";
import { EmotionalProfile } from "@/lib/types/therapist-bridge";

interface PatternsCardProps {
  patterns: EmotionalProfile["patterns"];
}

const PatternsCard = ({ patterns }: PatternsCardProps) => {
  return (
    <Card className="p-6 shadow-md hover:shadow-lg transition-shadow">
      <h3 className="text-xl font-bold mb-4">Key Patterns</h3>
      <div className="space-y-4">
        {patterns.map((pattern) => (
          <div key={pattern.title} className="rounded-lg bg-muted/40 p-4">
            <p className="font-semibold mb-1">
              <span aria-hidden="true" className="mr-2">
                {pattern.icon}
              </span>
              {pattern.title}
            </p>
            <p className="text-sm text-muted-foreground">{pattern.description}</p>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default PatternsCard;