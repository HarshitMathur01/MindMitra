import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { ConsentState } from "@/lib/mock/therapist-bridge";

const items: { key: keyof ConsentState; label: string; desc: string }[] = [
  { key: "assessments", label: "Share assessments", desc: "A simple snapshot of how you've been feeling lately." },
  { key: "fullProfile", label: "Share full emotional profile", desc: "The bigger picture — your moods, themes, and gentle patterns." },
  { key: "sessionSummaries", label: "Share session summaries", desc: "Soft notes from your reflections, in your own rhythm." },
  { key: "contactInfo", label: "Share contact information", desc: "Just your name and email, so they can reach out." },
];

export function ConsentForm({
  consent,
  onChange,
}: {
  consent: ConsentState;
  onChange: (c: ConsentState) => void;
}) {
  return (
    <div className="rounded-3xl border border-[rgba(0,0,0,0.04)] bg-[#FBF6EC] p-12 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <h3 className="qc-display text-2xl text-[#2D2A24]">What you'd like to share</h3>
      <p className="mt-3 max-w-[60ch] text-[15px] italic leading-[1.6] text-[#4A4640]">
        take your time. share only what feels right — you can change your mind anytime.
      </p>
      <div className="mt-8">
        {items.map((it, idx) => (
          <div
            key={it.key}
            className={`flex items-start justify-between gap-6 py-6 ${
              idx < items.length - 1 ? "border-b border-[rgba(0,0,0,0.04)]" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <Label
                htmlFor={`c-${it.key}`}
                className="text-[15px] font-medium text-[#2D2A24]"
              >
                {it.label}
              </Label>
              <p className="mt-1 text-[13.5px] leading-[1.6] text-[#7A736A]">{it.desc}</p>
            </div>
            <Switch
              id={`c-${it.key}`}
              checked={consent[it.key]}
              onCheckedChange={(v) => onChange({ ...consent, [it.key]: v })}
              className="data-[state=checked]:bg-[#3F6B47]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
