import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Star, Video, MapPin, Clock } from "lucide-react";
import type { Therapist } from "@/lib/mock/therapist-bridge";

export function TherapistCard({
  therapist,
  onBook,
}: {
  therapist: Therapist;
  onBook: (t: Therapist) => void;
}) {
  const initials = therapist.name
    .replace(/Dr\.?\s*/, "")
    .split(/\s|,/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("");

  return (
    <Card className="group flex h-full flex-col rounded-2xl border-border/60 tb-shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <CardContent className="flex h-full flex-col p-5">
        <div className="flex items-start gap-3">
          <img
            src={therapist.photo}
            alt={`Portrait of ${therapist.name}`}
            loading="lazy"
            className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-accent/60"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          <span className="sr-only">{initials}</span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-foreground">{therapist.name}</h3>
            <p className="truncate text-xs text-muted-foreground">{therapist.credentials}</p>
          </div>
          <div className="flex items-center gap-1 text-xs font-medium text-foreground">
            <Star className="h-3.5 w-3.5 fill-primary text-primary" />
            {therapist.rating}
            <span className="text-muted-foreground">({therapist.reviews})</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {therapist.specialties.map((s) => (
            <Badge key={s} variant="secondary" className="font-normal">
              {s}
            </Badge>
          ))}
        </div>

        <p className="mt-3 text-sm text-muted-foreground">{therapist.bio}</p>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            {therapist.modality.includes("virtual") ? (
              <Video className="h-3.5 w-3.5" />
            ) : (
              <MapPin className="h-3.5 w-3.5" />
            )}
            {therapist.modality.join(" · ")}
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {therapist.nextAvailable}
          </div>
        </div>

        <div className="mt-auto flex items-end justify-between pt-5">
          <div>
            <p className="text-xs text-muted-foreground">Per session</p>
            <p className="text-lg font-semibold text-foreground">₹{therapist.pricePerSession}</p>
          </div>
          <Button onClick={() => onBook(therapist)}>Book</Button>
        </div>
      </CardContent>
    </Card>
  );
}
