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
    <div className="flex h-full flex-col rounded-3xl border border-[rgba(0,0,0,0.04)] bg-[#FBF6EC] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <div className="flex items-start gap-3">
        <img
          src={therapist.photo}
          alt={`Portrait of ${therapist.name}`}
          loading="lazy"
          className="h-12 w-12 shrink-0 rounded-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
        <span className="sr-only">{initials}</span>
        <div className="min-w-0 flex-1">
          <h3 className="qc-display truncate text-lg text-[#2D2A24]">{therapist.name}</h3>
          <p className="truncate text-xs text-[#7A736A]">{therapist.credentials}</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-[#4A4640]">
          <Star className="h-3.5 w-3.5 fill-[#3F6B47] text-[#3F6B47]" />
          {therapist.rating}
          <span className="text-[#7A736A]">({therapist.reviews})</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {therapist.specialties.map((s) => (
          <span
            key={s}
            className="rounded-full border border-[rgba(0,0,0,0.06)] px-2.5 py-0.5 text-[11px] font-normal text-[#4A4640]"
          >
            {s}
          </span>
        ))}
      </div>

      <p className="mt-4 text-[14px] leading-[1.6] text-[#4A4640]">{therapist.bio}</p>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-[#7A736A]">
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

      <div className="mt-auto flex items-end justify-between pt-6">
        <div>
          <p className="text-xs text-[#7A736A]">Per session</p>
          <p className="qc-display text-2xl text-[#2D2A24]">₹{therapist.pricePerSession}</p>
        </div>
        <button
          type="button"
          onClick={() => onBook(therapist)}
          className="inline-flex items-center justify-center rounded-full bg-[#3F6B47] px-6 py-2.5 text-[13.5px] font-medium text-[#F5EDE0] transition-[transform,filter] duration-200 ease-out hover:-translate-y-px hover:brightness-[0.92] motion-reduce:hover:transform-none motion-reduce:transition-none"
        >
          Book
        </button>
      </div>
    </div>
  );
}
