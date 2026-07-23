import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { SurfaceTone } from "@/lib/mindgym/theme";

interface ConfirmLeaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  onLeave: () => void;
  tone?: SurfaceTone;
}

// Guards the HeaderPill back button while a game is in progress — a stray tap
// shouldn't throw away a session the user has invested minutes in.
export default function ConfirmLeaveDialog({
  open,
  onOpenChange,
  message,
  onLeave,
  tone = "warm",
}: ConfirmLeaveDialogProps) {
  const isWarm = tone === "warm";
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className={
          isWarm
            ? "max-w-sm bg-white/90 backdrop-blur-xl border-border rounded-2xl"
            : "max-w-sm bg-black/60 backdrop-blur-2xl border-white/10 rounded-2xl text-white"
        }
      >
        <AlertDialogHeader>
          <AlertDialogTitle
            className={isWarm ? "font-serif-display font-normal text-[#2a1c14]" : "font-serif-display font-normal text-white/95"}
          >
            Leave this game?
          </AlertDialogTitle>
          <AlertDialogDescription className={isWarm ? undefined : "text-white/60"}>
            {message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep playing</AlertDialogCancel>
          <AlertDialogAction onClick={onLeave}>Leave</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
