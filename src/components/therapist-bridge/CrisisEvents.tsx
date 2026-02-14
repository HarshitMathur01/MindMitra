import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmotionalProfile } from "@/lib/types/therapist-bridge";

interface CrisisEventsProps {
  events: EmotionalProfile["crisisEvents"];
}

const CrisisEvents = ({ events }: CrisisEventsProps) => {
  if (!events.length) {
    return (
      <Card className="p-6 shadow-md">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-green-600" aria-hidden="true" />
          <p className="font-semibold">No crisis events detected in this period.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 shadow-md border-yellow-400/50">
      <div className="flex items-start gap-3 mb-3">
        <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" aria-hidden="true" />
        <div>
          <h3 className="font-bold">Crisis Events</h3>
          <p className="text-sm text-muted-foreground">
            {events.length} instances of acute distress (safely managed). Immediate support provided and escalated when needed.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {events.map((event) => (
          <div key={`${event.date}-${event.actionTaken}`} className="rounded-md bg-yellow-50 p-3 text-sm">
            <p className="font-medium">{event.date}</p>
            <p className="text-muted-foreground">Severity: {event.severity}</p>
            <p className="text-muted-foreground">Action: {event.actionTaken}</p>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default CrisisEvents;