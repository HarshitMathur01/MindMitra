import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import MindGymLanding from "@/components/mindgym/MindGymLanding";
import MindGymHubView from "@/components/mindgym/MindGymHubView";

const ENTERED_KEY = "mindmitra_mindgym_entered_session";

export default function MindGymHub() {
  const [entered, setEntered] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(ENTERED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const handleEnter = () => {
    try {
      sessionStorage.setItem(ENTERED_KEY, "1");
    } catch {
      /* ignore */
    }
    setEntered(true);
  };

  return (
    <AnimatePresence mode="wait">
      {entered ? (
        <motion.div
          key="hub"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <MindGymHubView />
        </motion.div>
      ) : (
        <motion.div
          key="landing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <MindGymLanding onEnter={handleEnter} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
