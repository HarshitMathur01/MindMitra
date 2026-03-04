/**
 * GlobalSkip — fixed bottom-right "Skip to app →" button.
 *
 * - Always visible during onboarding
 * - If currentAct >= 2, shows a soft confirmation dialog before skipping
 */

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface GlobalSkipProps {
  /** -1 = consent screen, 0–5 = act index */
  currentAct: number;
  language: 'en' | 'hi';
  onSkip: () => void;
}

export default function GlobalSkip({ currentAct, language, onSkip }: GlobalSkipProps) {
  const [confirming, setConfirming] = useState(false);

  const skipLabel       = language === 'hi' ? 'ऐप पर जाओ →'                           : 'Skip to app →';
  const confirmQuestion = language === 'hi' ? 'सेटअप छोड़ना चाहते हो? प्रगति सेव रहेगी।' : 'Leave setup? Your progress will be saved.';
  const confirmYes      = language === 'hi' ? 'हाँ, छोड़ो'                               : 'Yes, skip';
  const confirmNo       = language === 'hi' ? 'वापस जाओ'                                : 'Keep going';

  const handleClick = () => {
    if (currentAct >= 2) {
      setConfirming(true);
    } else {
      onSkip();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[150] flex flex-col items-end gap-2">
      <AnimatePresence>
        {confirming && (
          <motion.div
            className="bg-slate-800 border border-white/10 rounded-2xl p-4 flex flex-col gap-3 shadow-xl w-56"
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.18 }}
          >
            <p className="text-white/70 text-sm leading-snug">{confirmQuestion}</p>
            <div className="flex gap-2">
              <button
                onClick={onSkip}
                className="flex-1 py-2 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-sm transition-colors"
              >
                {confirmYes}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 py-2 rounded-full border border-white/15 text-white/60 hover:text-white/80 text-sm transition-colors"
              >
                {confirmNo}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={handleClick}
        className="text-white/30 hover:text-white/55 text-sm transition-colors px-3 py-1.5 rounded-full border border-white/10 hover:border-white/20 backdrop-blur-sm"
      >
        {skipLabel}
      </button>
    </div>
  );
}
