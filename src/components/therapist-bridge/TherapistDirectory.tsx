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
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          {list.length} {list.length === 1 ? "match" : "matches"}
        </h3>
        <span className="text-xs text-muted-foreground">Sorted by best fit</span>
      </div>
      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/30 p-10 text-center">
          <p className="text-sm font-medium text-foreground">No therapists match your filters.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try widening your budget or removing a concern.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => (
            <TherapistCard key={t.id} therapist={t} onBook={onBook} />
          ))}
        </div>
      )}
    </div>
  );
}
