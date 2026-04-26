import { Button } from "@/components/ui/button";
import { Watch, FileDown, Eye } from "lucide-react";
import { toast } from "sonner";

export function ClinicalActions({ onPreview }: { onPreview: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 tb-shadow-card">
      <div>
        <p className="text-sm font-semibold text-foreground">Clinical sync &amp; export</p>
        <p className="text-xs text-muted-foreground">
          Pull wearable signals or export a one-page clinician summary.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => toast.success("Wearable connected", { description: "Mock sync complete." })}
        >
          <Watch className="h-4 w-4" /> Sync device
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => toast("PDF export queued", { description: "Demo only — no file generated." })}
        >
          <FileDown className="h-4 w-4" /> Export PDF
        </Button>
        <Button size="sm" onClick={onPreview}>
          <Eye className="h-4 w-4" /> Preview what therapist sees
        </Button>
      </div>
    </div>
  );
}
