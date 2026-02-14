import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TherapistFilters } from "@/lib/types/therapist-bridge";

interface FilterOptions {
  languages: string[];
  specializations: string[];
  locations: string[];
  availability: string[];
}

interface FilterBarProps {
  filters: TherapistFilters;
  options: FilterOptions;
  onChange: (filters: TherapistFilters) => void;
}

const appendValue = (list: string[], value: string) => {
  if (!value || value === "any") return [];
  return list.includes(value) ? list : [value];
};

const FilterBar = ({ filters, options, onChange }: FilterBarProps) => {
  return (
    <Card className="p-4 mb-6 shadow-md">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Select
          onValueChange={(value) => onChange({ ...filters, languages: appendValue(filters.languages, value) })}
        >
          <SelectTrigger aria-label="Filter by language">
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any language</SelectItem>
            {options.languages.map((language) => (
              <SelectItem key={language} value={language}>
                {language}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          onValueChange={(value) =>
            onChange({ ...filters, specializations: appendValue(filters.specializations, value) })
          }
        >
          <SelectTrigger aria-label="Filter by specialization">
            <SelectValue placeholder="Specialization" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any specialization</SelectItem>
            {options.specializations.map((spec) => (
              <SelectItem key={spec} value={spec}>
                {spec}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          onValueChange={(value) => onChange({ ...filters, location: appendValue(filters.location, value) })}
        >
          <SelectTrigger aria-label="Filter by location">
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any location</SelectItem>
            {options.locations.map((location) => (
              <SelectItem key={location} value={location}>
                {location}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          onValueChange={(value) => onChange({ ...filters, availability: appendValue(filters.availability, value) })}
        >
          <SelectTrigger aria-label="Filter by availability">
            <SelectValue placeholder="Availability" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any time</SelectItem>
            {options.availability.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          onClick={() =>
            onChange({
              languages: [],
              specializations: [],
              location: [],
              availability: [],
              priceRange: { min: 500, max: 3000 },
            })
          }
        >
          Clear Filters
        </Button>
      </div>
    </Card>
  );
};

export default FilterBar;