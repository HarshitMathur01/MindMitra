/**
 * CrisisInterrupt — full-screen overlay for critical / high crisis.
 *
 * - "I hear you." warm header
 * - Critical: 3 Indian helplines with tel: links
 * - "Talk to my AI companion" primary CTA
 * - "Continue setup — I'm okay" secondary
 * - AI disclaimer
 */

import React from 'react';
import { motion } from 'framer-motion';

interface CrisisInterruptProps {
  level: 'critical' | 'high';
  language: 'en' | 'hi';
  onTalkToCompanion: () => void;
  onContinueSetup: () => void;
}

const HELPLINES = [
  { name: 'iCall',                 number: '9152987821',    hours: 'Mon–Sat 8 am – 10 pm' },
  { name: 'Vandrevala Foundation', number: '1800-599-0019', hours: '24 / 7'                },
  { name: 'NIMHANS',               number: '080-46110007',  hours: 'Mon–Sat 9:30 am – 4:30 pm' },
];

export default function CrisisInterrupt({
  level,
  language,
  onTalkToCompanion,
  onContinueSetup,
}: CrisisInterruptProps) {
  const header = language === 'hi' ? 'मैं सुन रही हूं।' : 'I hear you.';

  const body =
    level === 'critical'
      ? language === 'hi'
        ? 'जो तुम अभी महसूस कर रहे हो वह सच है — और तुम्हें इसे अकेले सहना नहीं है। कृपया इनमें से किसी से संपर्क करो:'
        : "What you're feeling right now is real — and you don't have to face it alone. Please reach out to one of these people:"
      : language === 'hi'
        ? 'लगता है तुम बहुत मुश्किल दौर से गुजर रहे हो। इसमें तुम अकेले नहीं हो।'
        : "It sounds like you're going through something really hard. You're not alone in this.";

  const disclaimer = language === 'hi'
    ? 'मैं एक AI हूं — एक असली इंसान ज़्यादा मदद कर सकता है।'
    : "I'm an AI — a real person can help more.";

  const talkCTA     = language === 'hi' ? 'इस बारे में मेरे AI साथी से बात करो' : 'Talk to my AI companion about this';
  const continueCTA = language === 'hi' ? 'सेटअप जारी रखो — मैं अभी ठीक हूं'   : "Continue setup — I'm okay right now";

  return (
    <motion.div
      className="fixed inset-0 bg-slate-950/95 backdrop-blur-sm flex flex-col items-center justify-center z-[200] p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <div className="w-full max-w-md flex flex-col gap-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-white text-3xl font-light mb-3">{header}</h1>
          <p className="text-white/60 text-base leading-relaxed">{body}</p>
        </div>

        {/* Helplines — critical only */}
        {level === 'critical' && (
          <div className="flex flex-col gap-2">
            {HELPLINES.map(h => (
              <a
                key={h.name}
                href={`tel:${h.number.replace(/-/g, '')}`}
                className="flex items-center justify-between rounded-xl px-4 py-3.5 transition-opacity hover:opacity-80"
                style={{
                  background: 'rgba(239,68,68,0.07)',
                  border: '1px solid rgba(239,68,68,0.2)',
                }}
              >
                <div>
                  <p className="text-white text-sm font-medium">{h.name}</p>
                  <p className="text-white/35 text-xs">{h.hours}</p>
                </div>
                <span className="text-red-300 text-sm font-medium">{h.number}</span>
              </a>
            ))}
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-center text-white/30 text-xs">{disclaimer}</p>

        {/* CTAs */}
        <div className="flex flex-col gap-3">
          <button
            onClick={onTalkToCompanion}
            className="w-full py-3.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors"
          >
            {talkCTA}
          </button>
          <button
            onClick={onContinueSetup}
            className="text-white/40 hover:text-white/60 text-sm text-center py-1 transition-colors"
          >
            {continueCTA}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
