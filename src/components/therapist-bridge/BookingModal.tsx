import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import { Video, MapPin } from "lucide-react";
import type { Therapist } from "@/lib/mock/therapist-bridge";
import { toast } from "sonner";

export function BookingModal({
  therapist,
  open,
  onOpenChange,
}: {
  therapist: Therapist | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!therapist) return null;

  const handleConfirm = () => {
    setConfirming(true);
    setTimeout(() => {
      setConfirming(false);
      onOpenChange(false);
      toast.success("Session booked", {
        description: `${therapist.name} · ${therapist.nextAvailable}`,
      });
    }, 700);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl border-[rgba(0,0,0,0.04)] bg-[#FBF6EC] p-10 shadow-[0_1px_3px_rgba(0,0,0,0.03)] sm:max-w-md">
        <DialogHeader className="text-left">
          <p className="qc-eyebrow">A small confirmation</p>
          <h2 className="qc-display mt-3 text-3xl text-[#2D2A24]">
            Confirm your session
          </h2>
          <p className="mt-3 text-[14px] italic leading-[1.6] text-[#7A736A]">
            we'll send the confirmation and prep notes to your inbox (mock).
          </p>
        </DialogHeader>
        <dl className="mt-8 space-y-5 text-[14px]">
          <div className="flex items-baseline justify-between gap-6 border-b border-[rgba(0,0,0,0.04)] pb-3">
            <dt className="qc-eyebrow">Therapist</dt>
            <dd className="text-[#2D2A24]">{therapist.name}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-6 border-b border-[rgba(0,0,0,0.04)] pb-3">
            <dt className="qc-eyebrow">When</dt>
            <dd className="text-[#2D2A24]">{therapist.nextAvailable}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-6 border-b border-[rgba(0,0,0,0.04)] pb-3">
            <dt className="qc-eyebrow">Format</dt>
            <dd className="flex items-center gap-1.5 text-[#2D2A24]">
              {therapist.modality.includes("virtual") ? (
                <Video className="h-3.5 w-3.5 text-[#7A736A]" />
              ) : (
                <MapPin className="h-3.5 w-3.5 text-[#7A736A]" />
              )}
              {therapist.modality[0]}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-6">
            <dt className="qc-eyebrow">Fee</dt>
            <dd className="qc-display text-xl text-[#2D2A24]">₹{therapist.pricePerSession}</dd>
          </div>
        </dl>
        <div className="mt-10 flex flex-wrap items-center justify-end gap-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-[13.5px] italic text-[#7A736A] hover:text-[#4A4640]"
          >
            cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirming}
            className="inline-flex items-center justify-center rounded-full bg-[#3F6B47] px-7 py-3 text-[14px] font-medium text-[#F5EDE0] transition-[transform,filter] duration-200 ease-out hover:-translate-y-px hover:brightness-[0.92] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:hover:transform-none motion-reduce:transition-none"
          >
            {confirming ? "booking…" : "Confirm booking"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
