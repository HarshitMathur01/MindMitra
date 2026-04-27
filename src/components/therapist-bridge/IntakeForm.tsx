import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  concernOptions,
  defaultIntake,
  languageOptions,
  type IntakePrefs,
} from "@/lib/mock/therapist-bridge";
import { toast } from "sonner";

const selectTriggerClass =
  "h-10 w-full rounded-none border-0 border-b border-[rgba(0,0,0,0.12)] bg-transparent px-0 text-[15px] text-[#2D2A24] shadow-none ring-0 focus:border-[#3F6B47] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:border-[#3F6B47]";

export function IntakeForm({ onApply }: { onApply: (prefs: IntakePrefs) => void }) {
  const [prefs, setPrefs] = useState<IntakePrefs>(defaultIntake);

  const toggleConcern = (c: string) => {
    setPrefs((p) => ({
      ...p,
      concerns: p.concerns.includes(c) ? p.concerns.filter((x) => x !== c) : [...p.concerns, c],
    }));
  };

  return (
    <div className="rounded-3xl border border-[rgba(0,0,0,0.04)] bg-[#FBF6EC] p-12 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <h3 className="qc-display text-2xl text-[#2D2A24]">What would feel supportive?</h3>
      <p className="mt-3 max-w-[60ch] text-[15px] italic leading-[1.6] text-[#4A4640]">
        we'll gently shape the suggestions below. nothing you choose here is shared with anyone.
      </p>
      <div className="mt-10 space-y-10">
        <div>
          <Label className="qc-eyebrow mb-4 block">What's on your mind</Label>
          <div className="flex flex-wrap gap-2">
            {concernOptions.map((c) => {
              const active = prefs.concerns.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleConcern(c)}
                  className={`rounded-full border px-4 py-1.5 text-[13px] font-medium transition-colors ${
                    active
                      ? "border-[#3F6B47] bg-[#3F6B47] text-[#F5EDE0]"
                      : "border-[rgba(0,0,0,0.08)] bg-transparent text-[#4A4640] hover:border-[#3F6B47] hover:text-[#3F6B47]"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <Label className="qc-eyebrow mb-3 block">How you'd like to meet</Label>
            <Select
              value={prefs.modality}
              onValueChange={(v) => setPrefs((p) => ({ ...p, modality: v as IntakePrefs["modality"] }))}
            >
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="virtual">Virtual</SelectItem>
                <SelectItem value="in-person">In-person</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="qc-eyebrow mb-3 block">Language</Label>
            <Select
              value={prefs.language}
              onValueChange={(v) => setPrefs((p) => ({ ...p, language: v }))}
            >
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                {languageOptions.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="qc-eyebrow mb-3 block">Therapist you'd feel at ease with</Label>
            <Select
              value={prefs.gender}
              onValueChange={(v) => setPrefs((p) => ({ ...p, gender: v as IntakePrefs["gender"] }))}
            >
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">No preference</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="non-binary">Non-binary</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-baseline justify-between">
            <Label className="qc-eyebrow">What feels comfortable per session</Label>
            <span className="qc-display text-xl text-[#2D2A24]">₹{prefs.budget}</span>
          </div>
          <Slider
            value={[prefs.budget]}
            min={1000}
            max={4000}
            step={100}
            onValueChange={([v]) => setPrefs((p) => ({ ...p, budget: v }))}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <button
            type="button"
            onClick={() => setPrefs(defaultIntake)}
            className="text-[13px] italic text-[#7A736A] underline-offset-[6px] hover:text-[#4A4640] hover:underline"
          >
            reset
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(prefs);
              toast.success("Updated gently", { description: "Take a look at the people below." });
            }}
            className="inline-flex items-center justify-center rounded-full bg-[#3F6B47] px-7 py-3 text-[14px] font-medium text-[#F5EDE0] transition-[transform,filter] duration-200 ease-out hover:-translate-y-px hover:brightness-[0.92] motion-reduce:hover:transform-none motion-reduce:transition-none"
          >
            Show me people who fit
          </button>
        </div>
      </div>
    </div>
  );
}
