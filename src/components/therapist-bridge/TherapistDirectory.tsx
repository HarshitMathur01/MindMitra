import { useMemo } from "react";
import { mockTherapists, type IntakePrefs, type Therapist } from "@/lib/mock/therapist-bridge";
import { TherapistCard } from "./TherapistCard";

function matches(t: Therapist, p: IntakePrefs) {
  if (p.modality !== "any" && !t.modality.includes(p.modality)) return false;
  if (p.language !== "any" && !t.languages.includes(p.language)) return false;
  if (p.gender !== "any" && t.gender !== p.gender) return false;
  if (t.pricePerSession > p.budget) return false;
  if (p.concerns.length > 0) {
    const lower = t.specialties.map((s) => s.toLowerCase());
    const any = p.concerns.some((c) => lower.some((s) => s.includes(c.toLowerCase())));
    if (!any) return false;
  }
  return true;
}

export default function TherapistDirectory({
  prefs,
  onBook,
}: {
  prefs: IntakePrefs;
  onBook: (t: Therapist) => void;
}) {
  const list = useMemo(() => mockTherapists.filter((t) => matches(t, prefs)), [prefs]);

  return (
    <div>
      <div className="mb-8 flex items-baseline justify-between">
        <p className="qc-display text-2xl text-[#2D2A24]">
          {list.length} {list.length === 1 ? "match" : "matches"}
        </p>
        <span className="text-xs italic text-[#7A736A]">sorted by best fit</span>
      </div>
      {list.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[rgba(0,0,0,0.08)] bg-[#FBF6EC] p-12 text-center">
          <p className="qc-display text-xl text-[#2D2A24]">No one quite fits, yet.</p>
          <p className="mt-3 text-[14px] italic leading-[1.6] text-[#7A736A]">
            try widening your budget or removing a concern.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => (
            <TherapistCard key={t.id} therapist={t} onBook={onBook} />
          ))}
        </div>
      )}
    </div>
  );
}
