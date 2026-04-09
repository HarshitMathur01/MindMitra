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
        >
          <motion.div
            className="relative w-full max-w-md rounded-3xl bg-card/95 border border-border p-8 text-center shadow-overlay"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 25 }}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <Heart className="w-12 h-12 text-rose-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              You matter. Help is here.
            </h2>
            <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
              If you&apos;re going through a tough time, please reach out. You don&apos;t
              have to face this alone.
            </p>

            <div className="space-y-3 mb-6">
              <a
                href="tel:9152987821"
                className="flex items-center gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-200 hover:bg-rose-500/15 transition-colors"
              >
                <Phone className="w-5 h-5 text-rose-500 shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">iCall Helpline</p>
                  <p className="text-xs text-muted-foreground">9152987821 (Mon–Sat, 8am–10pm)</p>
                </div>
              </a>
              <a
                href="tel:08046110007"
                className="flex items-center gap-3 p-4 rounded-2xl bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors"
              >
                <Phone className="w-5 h-5 text-primary shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">NIMHANS Helpline</p>
                  <p className="text-xs text-muted-foreground">080-46110007 (24/7)</p>
                </div>
              </a>
            </div>

            <Button
              onClick={() => { onClose(); navigate("/chat"); }}
              className="w-full rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground h-12 shadow-card-hover"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Talk to MindMitra AI
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
