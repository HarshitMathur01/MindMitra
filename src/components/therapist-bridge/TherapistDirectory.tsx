import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import FilterBar from "@/components/therapist-bridge/FilterBar";
import TherapistCard from "@/components/therapist-bridge/TherapistCard";
import { Therapist, TherapistFilters, defaultFilters } from "@/lib/types/therapist-bridge";

interface TherapistDirectoryProps {
  therapists: Therapist[];
  onBook: (therapist: Therapist) => void;
  booking: boolean;
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

const TherapistDirectory = ({ therapists, onBook, booking }: TherapistDirectoryProps) => {
  const [filters, setFilters] = useState<TherapistFilters>(defaultFilters);
  const [debouncedFilters, setDebouncedFilters] = useState<TherapistFilters>(defaultFilters);
  const [visibleCount, setVisibleCount] = useState(6);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 250);

    return () => clearTimeout(timeout);
  }, [filters]);

  const options = useMemo(() => {
    const languages = Array.from(new Set(therapists.flatMap((therapist) => therapist.languages))).sort();
    const specializations = Array.from(new Set(therapists.flatMap((therapist) => therapist.specializations))).sort();
    const locations = Array.from(new Set(therapists.flatMap((therapist) => therapist.location))).sort();
    const availability = Array.from(new Set(therapists.flatMap((therapist) => therapist.availability))).sort();

    return { languages, specializations, locations, availability };
  }, [therapists]);

  const filteredTherapists = useMemo(
    () => therapists.filter((therapist) => matchesFilter(therapist, debouncedFilters)),
    [therapists, debouncedFilters],
  );

  const visibleTherapists = filteredTherapists.slice(0, visibleCount);

  return (
    <section id="find-therapist" className="mb-12">
      <h2 className="text-2xl md:text-3xl font-bold mb-6">Therapist Directory</h2>
      <FilterBar filters={filters} options={options} onChange={setFilters} />

      {!filteredTherapists.length ? (
        <p className="text-muted-foreground">No therapists found with current filters. Try clearing filters.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleTherapists.map((therapist) => (
              <TherapistCard key={therapist.id} therapist={therapist} onBook={onBook} booking={booking} />
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