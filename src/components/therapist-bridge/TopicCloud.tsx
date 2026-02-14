import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmotionalProfile } from "@/lib/types/therapist-bridge";

interface TopicCloudProps {
  topics: EmotionalProfile["topics"];
}

const sentimentClass = (sentiment: number) => {
  if (sentiment <= -0.45) return "bg-red-100 text-red-700";
  if (sentiment <= -0.2) return "bg-yellow-100 text-yellow-700";
  return "bg-green-100 text-green-700";
};

const TopicCloud = ({ topics }: TopicCloudProps) => {
  const max = Math.max(...topics.map((topic) => topic.frequency), 1);

  return (
    <Card className="p-6 shadow-md hover:shadow-lg transition-shadow">
      <h3 className="text-xl font-bold mb-4">Topic Cloud</h3>
      <div className="flex flex-wrap gap-3">
        {topics.map((topic) => {
          const size = 0.8 + topic.frequency / max;
          return (
            <Badge
              key={topic.topic}
              className={`px-3 py-2 font-medium ${sentimentClass(topic.sentiment)}`}
              style={{ fontSize: `${size}rem` }}
            >
              {topic.topic}
            </Badge>
          );
        })}
      </div>
    </Card>
  );
};

export default TopicCloud;