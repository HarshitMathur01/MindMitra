import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { mockProfile, type ConsentState } from "@/lib/mock/therapist-bridge";
import { CheckCircle2, XCircle } from "lucide-react";

export default function DataPreviewModal({
  open,
  onOpenChange,
  consent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  consent: ConsentState;
}) {
  const Row = ({ on, label, children }: { on: boolean; label: string; children: React.ReactNode }) => (
    <div className="rounded-xl border bg-background/40 p-4">
      <div className="mb-2 flex items-center gap-2">
        {on ? (
          <CheckCircle2 className="h-4 w-4 text-primary" />
        ) : (
          <XCircle className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-sm font-medium text-foreground">{label}</span>
        <Badge variant={on ? "default" : "secondary"} className="ml-auto">
          {on ? "Shared" : "Hidden"}
        </Badge>
      </div>
      <div className={on ? "" : "opacity-40 blur-sm select-none"}>{children}</div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>What your therapist will see</DialogTitle>
          <DialogDescription>
            Live preview based on your consent toggles.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Row on={consent.contactInfo} label="Contact information">
            <p className="text-sm text-muted-foreground">Alex Sharma · alex@example.com</p>
          </Row>
          <Row on={consent.assessments} label="Assessments">
            <ul className="space-y-1 text-sm text-muted-foreground">
              {mockProfile.assessments.map((a) => (
                <li key={a.name}>
                  {a.name}: {a.score}/{a.max} ({a.severity})
                </li>
              ))}
            </ul>
          </Row>
          <Row on={consent.fullProfile} label="Emotional profile">
            <p className="text-sm text-muted-foreground">
              7-day mood trend, top patterns ({mockProfile.patterns.length}), and topic distribution.
            </p>
          </Row>
          <Row on={consent.sessionSummaries} label="Session summaries">
            <p className="text-sm text-muted-foreground">
              "Reported elevated stress around work deadlines; sleep onset delayed by 90 min on weekdays…"
            </p>
          </Row>
        </div>
      </DialogContent>
    </Dialog>
  );
}
