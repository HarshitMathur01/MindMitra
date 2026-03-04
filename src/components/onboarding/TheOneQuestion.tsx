/**
 * Act 2 — TheOneQuestion
 *
 * - Single free-text question: "Right now — what's the heaviest thing on your mind?"
 * - Cycling placeholder every 3 s with AnimatePresence fade
 * - Crisis detection on keystroke (debounced 500 ms) using crisisDetection.ts
 * - Pre-fetch mirror response after 3 s typing inactivity (tier !== 'lite', text.length > 10)
 * - "Only your AI companion sees this." subtext
 * - Submit button appears when text.length > 0
 * - ActSkip: "I'd rather not say yet"
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ActSkip from './ActSkip';
import { screenForCrisis } from '@/lib/crisisDetection';
import type { DeviceTier } from '@/hooks/useDeviceCapability';

interface TheOneQuestionProps {
  onComplete: (data: { text: string }) => void;
  onSkip: () => void;
  tier: DeviceTier;
  language: 'en' | 'hi';
}

const PLACEHOLDERS_EN = [
  'the exam tomorrow',
  'what I said to them',
  "feeling like I don't belong",
  'just… everything',
  "something I can't explain",
  'the silence at home',
];

const PLACEHOLDERS_HI = [
  'कल की परीक्षा',
  'जो मैंने उनसे कहा',
  'ऐसा लगता है जैसे मैं यहाँ का नहीं',
  'बस... सब कुछ',
  'कुछ जो मैं समझा नहीं सकता',
  'घर की चुप्पी',
];

const CRISIS_COPY = {
  en: {
    critical:
      "You don't have to face this alone. Crisis support: iCall 9152987821 | Vandrevala Foundation 1860-2662-345 (24/7)",
    high: "It sounds like you're in a really hard place. Please consider talking to someone you trust.",
  },
  hi: {
    critical:
      'तुम अकेले नहीं हो। iCall: 9152987821 | Vandrevala Foundation: 1860-2662-345 (24/7)',
    high: 'लगता है तुम बहुत मुश्किल दौर में हो। किसी विश्वसनीय इंसान से बात करो।',
  },
};

export default function TheOneQuestion({
  onComplete,
  onSkip,
  tier,
  language,
}: TheOneQuestionProps) {
  const [text, setText] = useState('');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const [crisisLevel, setCrisisLevel] = useState<'critical' | 'high' | null>(null);

  const crisisTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const placeholders = language === 'hi' ? PLACEHOLDERS_HI : PLACEHOLDERS_EN;

  const question =
    language === 'hi'
      ? 'अभी — तुम्हारे मन पर सबसे भारी बोझ क्या है?'
      : "Right now — what's the heaviest thing on your mind?";

  const subtext =
    language === 'hi'
      ? 'केवल तुम्हारा AI साथी यह देखेगा।'
      : 'Only your AI companion sees this.';

  const skipLabel = language === 'hi' ? 'अभी नहीं बताना' : "I'd rather not say yet";
  const submitLabel = language === 'hi' ? 'साझा करो' : 'Share';

  // Cycle placeholder every 3 s with a brief fade-out/in
  useEffect(() => {
    const interval = setInterval(() => {
      setShowPlaceholder(false);
      setTimeout(() => {
        setPlaceholderIdx(i => (i + 1) % placeholders.length);
        setShowPlaceholder(true);
      }, 300);
    }, 3000);

    return () => clearInterval(interval);
  }, [placeholders.length]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setText(val);

      // Crisis detection — debounced 500 ms
      clearTimeout(crisisTimerRef.current);
      crisisTimerRef.current = setTimeout(() => {
        if (val.trim().length > 3) {
          const result = screenForCrisis(val);
          if (result.level === 'critical' || result.level === 'high') {
            setCrisisLevel(result.level);
          } else {
            setCrisisLevel(null);
          }
        } else {
          setCrisisLevel(null);
        }
      }, 500);

      // Pre-fetch mirror response — 3 s inactivity, tier !== 'lite', text > 10 chars
      if (tier !== 'lite' && val.length > 10) {
        clearTimeout(prefetchTimerRef.current);
        prefetchTimerRef.current = setTimeout(() => {
          // TODO: call /api/mirror?text=... and warm the cache
          // Pre-fetch stub — LLM integration added in later phase
        }, 3000);
      }
    },
    [tier],
  );

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(crisisTimerRef.current);
      clearTimeout(prefetchTimerRef.current);
    };
  }, []);

  const crisis = CRISIS_COPY[language];

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-50 p-6">
      <ActSkip label={skipLabel} onClick={onSkip} />

      <div className="w-full max-w-lg flex flex-col gap-6">
        {/* Question */}
        <motion.h1
          className="text-white text-2xl font-light leading-relaxed text-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          {question}
        </motion.h1>

        {/* Textarea with animated placeholder */}
        <div className="relative">
          <textarea
            value={text}
            onChange={handleChange}
            rows={4}
            className="w-full bg-crushed-silk/5 border border-white/10 rounded-xl px-4 py-3 text-white resize-none focus:outline-none focus:border-violet-400/50 transition-colors"
            style={{ minHeight: '120px' }}
          />
          {/* Cycling placeholder — only shown when textarea is empty */}
          {!text && (
            <div
              className="absolute inset-0 px-4 py-3 pointer-events-none flex items-start"
              aria-hidden="true"
            >
              <AnimatePresence mode="wait">
                {showPlaceholder && (
                  <motion.span
                    key={placeholderIdx}
                    className="text-white/25 text-base"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {placeholders[placeholderIdx]}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Crisis banner */}
        <AnimatePresence>
          {crisisLevel && (
            <motion.div
              className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${crisisLevel === 'critical'
                  ? 'bg-red-900/40 border border-red-500/30 text-red-200'
                  : 'bg-amber-900/30 border border-amber-500/30 text-amber-200'
                }`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
            >
              {crisis[crisisLevel]}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Privacy subtext */}
        <p className="text-center text-white/30 text-sm">{subtext}</p>

        {/* Submit button — visible once user has typed anything */}
        <AnimatePresence>
          {text.length > 0 && (
            <motion.button
              onClick={() => onComplete({ text })}
              className="self-center px-10 py-3 rounded-full bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {submitLabel}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
