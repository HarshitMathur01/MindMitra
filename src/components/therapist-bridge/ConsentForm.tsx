import { CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ConsentState } from "@/lib/types/therapist-bridge";

interface ConsentFormProps {
  consentState: ConsentState;
  setConsentState: React.Dispatch<React.SetStateAction<ConsentState>>;
  onReviewData: () => void;
}

const ConsentForm = ({ consentState, setConsentState, onReviewData }: ConsentFormProps) => {
  const setMode = (value: string) => {
    if (value === "full") {
      setConsentState((prev) => ({
        ...prev,
        shareFullProfile: true,
        shareAssessments: true,
        sharePatterns: true,
      }));
      return;
    }

    if (value === "assessments") {
      setConsentState((prev) => ({
        ...prev,
        shareFullProfile: false,
        shareAssessments: true,
        sharePatterns: false,
      }));
      return;
    }

    setConsentState((prev) => ({
      ...prev,
      shareFullProfile: false,
    }));
  };

  return (
    <section className="mb-12">
      <h2 className="text-2xl md:text-3xl font-bold mb-6">Privacy & Consent</h2>
      <Card className="p-6 shadow-md hover:shadow-lg transition-shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="font-bold mb-3">What Gets Shared</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" /> Emotional mood trends and patterns</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" /> Assessment scores (PHQ-9, GAD-7, etc.)</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" /> Key conversation themes (not full transcripts)</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" /> Crisis alerts (if any occurred)</li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold mb-3">What Doesn't Get Shared</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2"><XCircle className="h-4 w-4 text-red-600 mt-0.5" /> Your identity (shared anonymously unless you choose)</li>
              <li className="flex items-start gap-2"><XCircle className="h-4 w-4 text-red-600 mt-0.5" /> Specific conversation details</li>
              <li className="flex items-start gap-2"><XCircle className="h-4 w-4 text-red-600 mt-0.5" /> Anything you marked as "private"</li>
            </ul>
          </div>
        </div>

        <div className="rounded-lg border p-4 mb-6">
          <h4 className="font-semibold mb-3">Choose Sharing Mode</h4>
          <RadioGroup
            defaultValue="full"
            onValueChange={setMode}
            className="space-y-3"
            aria-label="Data sharing mode"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="full" id="full-profile" />
              <Label htmlFor="full-profile">Share full emotional profile (recommended)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="assessments" id="assessment-only" />
              <Label htmlFor="assessment-only">Share only assessment scores</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="custom" id="custom-share" />
              <Label htmlFor="custom-share">Let me choose what to share (custom)</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Checkbox
              id="share-assessments"
              checked={consentState.shareAssessments}
              onCheckedChange={(checked) =>
                setConsentState((prev) => ({ ...prev, shareAssessments: Boolean(checked) }))
              }
            />
            <Label htmlFor="share-assessments">Share assessments</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="share-patterns"
              checked={consentState.sharePatterns}
              onCheckedChange={(checked) =>
                setConsentState((prev) => ({ ...prev, sharePatterns: Boolean(checked) }))
              }
            />
            <Label htmlFor="share-patterns">Share patterns and topics</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="share-anon"
              checked={consentState.shareAnonymously}
              onCheckedChange={(checked) =>
                setConsentState((prev) => ({ ...prev, shareAnonymously: Boolean(checked) }))
              }
            />
            <Label htmlFor="share-anon">Share anonymously</Label>
          </div>
        </div>

        <Button variant="outline" className="transition-all duration-300" onClick={onReviewData}>
          Review Data Before Sharing
        </Button>
      </Card>
    </section>
  );
};

export default ConsentForm;