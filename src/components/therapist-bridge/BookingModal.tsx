import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Video, MapPin } from "lucide-react";
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Confirm your session
          </DialogTitle>
          <DialogDescription>
            We'll send the confirmation and prep notes to your inbox (mock).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 rounded-xl border bg-muted/30 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Therapist</span>
            <span className="font-medium text-foreground">{therapist.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">When</span>
            <span className="font-medium text-foreground">{therapist.nextAvailable}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Format</span>
            <span className="flex items-center gap-1 font-medium text-foreground">
              {therapist.modality.includes("virtual") ? (
                <Video className="h-3.5 w-3.5" />
              ) : (
                <MapPin className="h-3.5 w-3.5" />
              )}
              {therapist.modality[0]}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fee</span>
            <span className="font-medium text-foreground">₹{therapist.pricePerSession}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={confirming}>
            {confirming ? "Booking…" : "Confirm booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
