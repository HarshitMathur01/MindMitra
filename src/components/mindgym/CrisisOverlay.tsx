import { motion, AnimatePresence } from "framer-motion";
import { Phone, MessageSquare, X, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface CrisisOverlayProps {
  open: boolean;
  onClose: () => void;
}

export default function CrisisOverlay({ open, onClose }: CrisisOverlayProps) {
  const navigate = useNavigate();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            className="relative w-full max-w-md rounded-[28px] bg-[hsl(var(--warmth-50))] p-8 text-center shadow-none"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 42, damping: 38, mass: 1.2 }}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <Heart className="w-11 h-11 text-[hsl(var(--warmth-500))] mx-auto mb-4" strokeWidth={1.5} />
            <h2 className="font-display text-xl font-normal text-ink-8 mb-2">
              You matter. Help is here.
            </h2>
            <p className="text-ink-6 text-sm mb-6 leading-relaxed">
              If you&apos;re going through a tough time, reaching out is a brave step. You don&apos;t
              have to face this alone.
            </p>

            <div className="space-y-3 mb-6">
              <a
                href="tel:9152987821"
                className="flex items-center gap-3 p-4 rounded-2xl bg-white/70 border border-[hsl(var(--warmth-200))] hover:bg-white/90 transition-colors duration-base"
              >
                <Phone className="w-5 h-5 text-[hsl(var(--warmth-500))] shrink-0" strokeWidth={1.8} />
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">iCall Helpline</p>
                  <p className="text-xs text-muted-foreground">9152987821 (Mon–Sat, 8am–10pm)</p>
                </div>
              </a>
              <a
                href="tel:08046110007"
                className="flex items-center gap-3 p-4 rounded-2xl bg-[hsl(var(--accent-100))] border border-[hsl(var(--accent-200))] hover:bg-[hsl(var(--accent-100))]/90 transition-colors duration-base"
              >
                <Phone className="w-5 h-5 text-[hsl(var(--accent-600))] shrink-0" strokeWidth={1.8} />
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">NIMHANS Helpline</p>
                  <p className="text-xs text-muted-foreground">080-46110007 (24/7)</p>
                </div>
              </a>
            </div>

            <Button
              onClick={() => { onClose(); navigate("/chat"); }}
              className="w-full rounded-full h-12"
            >
              <MessageSquare className="w-4 h-4 mr-2" strokeWidth={1.8} />
              Open chat when you&apos;re ready
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
