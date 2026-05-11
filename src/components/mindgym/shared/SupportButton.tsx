import { useState } from "react";
import { Phone } from "lucide-react";
import CrisisOverlay from "../CrisisOverlay";
import type { SurfaceTone } from "@/lib/mindgym/theme";

interface SupportButtonProps {
  tone: SurfaceTone;
}

// Persistent crisis-support affordance. Mount once per shell — provides both the
// floating button and the overlay it opens.
export default function SupportButton({ tone }: SupportButtonProps) {
  const [open, setOpen] = useState(false);
  const isWarm = tone === "warm";

  return (
    <>
      <div className="fixed bottom-safe right-4 z-40 pb-4">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open crisis support"
          className={
            isWarm
              ? "flex items-center gap-2 px-4 py-2.5 rounded-full bg-rose-500/10 backdrop-blur-md border border-rose-500/20 text-rose-700 text-xs font-semibold hover:bg-rose-500/20 shadow-lg transition-all"
              : "flex items-center gap-2 px-4 py-2.5 rounded-full bg-rose-500/15 backdrop-blur-md border border-rose-400/30 text-rose-200 text-xs font-semibold hover:bg-rose-500/25 shadow-lg transition-all"
          }
        >
          <Phone className="w-3.5 h-3.5" />
          Support
        </button>
      </div>

      <CrisisOverlay open={open} onClose={() => setOpen(false)} />
    </>
  );
}
