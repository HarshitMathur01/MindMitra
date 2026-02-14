import { BadgeCheck, CalendarClock, Languages, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Therapist } from "@/lib/types/therapist-bridge";

interface TherapistCardProps {
  therapist: Therapist;
  onBook: (therapist: Therapist) => void;
  booking: boolean;
}

const TherapistCard = ({ therapist, onBook, booking }: TherapistCardProps) => {
  return (
    <Card className="p-6 shadow-md hover:shadow-lg transition-shadow">
      <div className="flex items-center gap-3 mb-4">
        <img
          src={therapist.avatar}
          alt={therapist.name}
          className="h-16 w-16 rounded-full object-cover"
          loading="lazy"
        />
        <div>
          <h3 className="font-bold text-lg">{therapist.name}</h3>
          <p className="text-sm text-muted-foreground">{therapist.title}</p>
        </div>
      </div>

      <div className="space-y-2 text-sm mb-4">
        <p className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-green-600" />RCI: {therapist.rciNumber}</p>
        <p className="flex items-center gap-2"><Star className="h-4 w-4 text-yellow-500" />{therapist.rating} ({therapist.reviewCount} reviews)</p>
        <p>Experience: {therapist.experience}</p>
        <p className="flex items-center gap-2"><Languages className="h-4 w-4" />{therapist.languages.join(", ")}</p>
        <p className="flex items-center gap-2"><CalendarClock className="h-4 w-4" />Next: {therapist.nextAvailable}</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {therapist.specializations.map((specialization) => (
          <Badge key={specialization} variant="secondary">
            {specialization}
          </Badge>
        ))}
      </div>

      <p className="text-sm text-muted-foreground italic mb-4">“{therapist.testimonial}”</p>

      <div className="flex items-center justify-between">
        <p className="font-semibold">Rs {therapist.sessionFee}/session</p>
        <Button
          onClick={() => onBook(therapist)}
          disabled={booking}
          aria-label={`Book session with ${therapist.name}`}
        >
          {booking ? "Booking..." : "Book Session"}
        </Button>
      </div>
    </Card>
  );
};

export default TherapistCard;