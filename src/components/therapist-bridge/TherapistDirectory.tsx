import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import FilterBar from "@/components/therapist-bridge/FilterBar";
import TherapistCard from "@/components/therapist-bridge/TherapistCard";
import { Therapist, TherapistFilters, defaultFilters } from "@/lib/types/therapist-bridge";

interface TherapistDirectoryProps {
  therapists: Therapist[];
  onBook: (therapist: Therapist) => void;
  booking: boolean;
  userTopics?: Array<{ topic: string; frequency: number }>;
  /** Filters seeded from the intake form. Updates re-apply the filter state. */
  initialFilters?: TherapistFilters;
  /**
   * Bumped whenever the parent wants to force-sync `initialFilters` into
   * the local filter state (e.g. after an intake "Apply" or "Reset").
   */
  filtersRevision?: number;
}

const matchesFilter = (therapist: Therapist, filters: TherapistFilters) => {
  const languagePass = !filters.languages.length || filters.languages.some((language) => therapist.languages.includes(language));
  const specializationPass =
    !filters.specializations.length || filters.specializations.some((specialization) => therapist.specializations.includes(specialization));
  const locationPass = !filters.location.length || filters.location.some((location) => therapist.location.includes(location));
  const availabilityPass =
    !filters.availability.length || filters.availability.some((availability) => therapist.availability.includes(availability));
  const pricePass = therapist.sessionFee >= filters.priceRange.min && therapist.sessionFee <= filters.priceRange.max;

  return languagePass && specializationPass && locationPass && availabilityPass && pricePass;
};

const TherapistDirectory = ({
  therapists,
  onBook,
  booking,
  userTopics,
  initialFilters,
  filtersRevision = 0,
}: TherapistDirectoryProps) => {
  const [filters, setFilters] = useState<TherapistFilters>(initialFilters ?? defaultFilters);
  const [debouncedFilters, setDebouncedFilters] = useState<TherapistFilters>(initialFilters ?? defaultFilters);
  const [visibleCount, setVisibleCount] = useState(6);

  // When the parent pushes a new intake-derived filter set (revision bumps),
  // adopt it instantly so the directory reflects the user's stated intent.
  useEffect(() => {
    if (!initialFilters) return;
    setFilters(initialFilters);
    setDebouncedFilters(initialFilters);
    setVisibleCount(6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersRevision]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 250);

    return () => clearTimeout(timeout);
  }, [filters]);

  const isRecommended = (therapist: Therapist) => {
    if (!userTopics || userTopics.length === 0) return false;

    return therapist.specializations.some((spec) =>
      userTopics.some(
        (topic) =>
          topic.topic.toLowerCase().includes(spec.toLowerCase()) ||
          spec.toLowerCase().includes(topic.topic.toLowerCase()),
      ),
    );
  };

  const options = useMemo(() => {
    const languages = Array.from(new Set(therapists.flatMap((therapist) => therapist.languages))).sort();
    const specializations = Array.from(new Set(therapists.flatMap((therapist) => therapist.specializations))).sort();
    const locations = Array.from(new Set(therapists.flatMap((therapist) => therapist.location))).sort();
    const availability = Array.from(new Set(therapists.flatMap((therapist) => therapist.availability))).sort();

    return { languages, specializations, locations, availability };
  }, [therapists]);

  const filteredTherapists = useMemo(() => {
    const filtered = therapists.filter((therapist) => matchesFilter(therapist, debouncedFilters));

    return filtered.sort((a, b) => {
      const aRecommended = isRecommended(a);
      const bRecommended = isRecommended(b);
      if (aRecommended && !bRecommended) return -1;
      if (!aRecommended && bRecommended) return 1;
      return 0;
    });
  }, [therapists, debouncedFilters, userTopics]);

  const visibleTherapists = filteredTherapists.slice(0, visibleCount);

  return (
    <section id="find-therapist" className="mb-12">
      <header className="mb-8 space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-5">Directory</p>
        <h2 className="font-display text-2xl font-normal tracking-tight text-ink-8 md:text-3xl">Find your therapist</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-ink-5">
          Filter by language, focus, and availability. Recommended matches align with themes you&apos;ve explored in MindMitra.
        </p>
      </header>
      <FilterBar filters={filters} options={options} onChange={setFilters} />

      {!filteredTherapists.length ? (
        <p className="text-muted-foreground">No therapists found with current filters. Try clearing filters.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleTherapists.map((therapist) => (
              <TherapistCard
                key={therapist.id}
                therapist={therapist}
                onBook={onBook}
                booking={booking}
                isRecommended={isRecommended(therapist)}
              />
            ))}
          </div>

          {filteredTherapists.length > visibleCount && (
            <div className="mt-6 text-center">
              <Button variant="outline" onClick={() => setVisibleCount((count) => count + 6)}>
                Load More Therapists
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default TherapistDirectory;