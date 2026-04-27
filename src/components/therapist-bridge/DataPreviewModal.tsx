import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import { mockProfile, type ConsentState } from "@/lib/mock/therapist-bridge";

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
    <div className="border-b border-[rgba(0,0,0,0.04)] py-6 last:border-b-0">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <span className="qc-eyebrow">{label}</span>
        <span
          className={`text-[12px] italic ${
            on ? "text-[#3F6B47]" : "text-[#7A736A]"
          }`}
        >
          {on ? "shared" : "hidden"}
        </span>
      </div>
      <div className={on ? "text-[14px] leading-[1.6] text-[#4A4640]" : "select-none text-[14px] leading-[1.6] text-[#4A4640] opacity-30 blur-[1px]"}>
        {children}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto rounded-3xl border-[rgba(0,0,0,0.04)] bg-[#FBF6EC] p-10 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <DialogHeader className="text-left">
          <p className="qc-eyebrow">A live preview</p>
          <h2 className="qc-display mt-3 text-3xl text-[#2D2A24]">
            What your therapist will see
          </h2>
          <p className="mt-3 text-[14px] italic leading-[1.6] text-[#7A736A]">
            updates with your consent toggles.
          </p>
        </DialogHeader>
        <div className="mt-6">
          <Row on={consent.contactInfo} label="Contact information">
            Alex Sharma · alex@example.com
          </Row>
          <Row on={consent.assessments} label="Assessments">
            <ul className="space-y-1">
              {mockProfile.assessments.map((a) => (
                <li key={a.name}>
                  {a.name}: {a.score}/{a.max} ({a.severity})
                </li>
              ))}
            </ul>
          </Row>
          <Row on={consent.fullProfile} label="Emotional profile">
            7-day mood trend, top patterns ({mockProfile.patterns.length}), and topic distribution.
          </Row>
          <Row on={consent.sessionSummaries} label="Session summaries">
            "Reported elevated stress around work deadlines; sleep onset delayed by 90 min on weekdays…"
          </Row>
        </div>
      </DialogContent>
    </Dialog>
  );
}
