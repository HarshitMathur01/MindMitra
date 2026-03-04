/**
 * SoftCheck — inline amber-toned nudge for medium-level distress.
 * Displayed within the current act, not as a full-screen overlay.
 */

import React from 'react';
import { motion } from 'framer-motion';

interface SoftCheckProps {
  language: 'en' | 'hi';
  onDismiss: () => void;
}

export default function SoftCheck({ language, onDismiss }: SoftCheckProps) {
  const message = language === 'hi'
    ? 'लगता है तुम बहुत कुछ संभाल रहे हो। जब भी तुम तैयार हो, मैं यहाँ हूं।'
    : "That sounds like a lot to carry. I'm here whenever you're ready.";

  const dismiss = language === 'hi' ? 'शुक्रिया — जारी रखते हैं' : "Thank you — let's continue";

  return (
    <motion.div
      className="w-full max-w-lg mx-auto rounded-xl px-5 py-4 flex items-start justify-between gap-4"
      style={{
        background: 'rgba(251,191,36,0.06)',
        border: '1px solid rgba(251,191,36,0.2)',
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.3 }}
    >
      <p className="text-amber-200/70 text-sm leading-relaxed">{message}</p>
      <button
        onClick={onDismiss}
        className="text-amber-400/60 hover:text-amber-400/90 text-xs whitespace-nowrap flex-shrink-0 transition-colors pt-0.5"
      >
        {dismiss}
      </button>
    </motion.div>
  );
}
