/**
 * ConsentGate — full-screen gate shown before any onboarding act.
 *
 * - Language toggle (EN / हि) top-right
 * - 5 bullets about what MindMitra is/isn't
 * - Privacy policy link
 * - "I understand and want to continue" primary CTA
 * - "Skip intro, go straight to the app →" secondary link
 */

import React from 'react';
import { motion } from 'framer-motion';

interface ConsentGateProps {
  language: 'en' | 'hi';
  onLanguageSelect: (lang: 'en' | 'hi') => void;
  onConsent: () => void;
  onSkip: () => void;
}

const BULLETS_EN = [
  "I'm an AI companion — not a therapist or crisis service.",
  'Everything you share stays private between you and me.',
  'You can stop, skip, or leave at any time.',
  "If you're in crisis, I'll always connect you to a real person.",
  "You're in control. I'm here to listen.",
];

const BULLETS_HI = [
  'मैं एक AI साथी हूं — थेरेपिस्ट या संकट सेवा नहीं।',
  'तुम जो भी साझा करते हो, वह तुम्हारे और मेरे बीच रहता है।',
  'तुम कभी भी रुक सकते हो, छोड़ सकते हो, या जा सकते हो।',
  'संकट में, मैं हमेशा एक असली इंसान से जोड़ूंगी।',
  'तुम्हारा नियंत्रण है। मैं सुनने के लिए हूं।',
];

export default function ConsentGate({
  language,
  onLanguageSelect,
  onConsent,
  onSkip,
}: ConsentGateProps) {
  const bullets = language === 'hi' ? BULLETS_HI : BULLETS_EN;

  const title   = language === 'hi' ? 'एक बात पहले'           : 'Before we begin';
  const subtitle = language === 'hi' ? 'MindMitra को समझने के लिए एक मिनट' : 'A minute to understand MindMitra';
  const ctaLabel = language === 'hi' ? 'मैं समझता / समझती हूं — जारी रखो' : 'I understand — continue';
  const skipLabel = language === 'hi' ? 'इंट्रो छोड़ो, सीधे ऐप में जाओ →' : 'Skip intro, go straight to the app →';
  const privacyLabel = language === 'hi' ? 'गोपनीयता नीति' : 'Privacy Policy';

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-50 p-6 overflow-y-auto">
      {/* Language toggle */}
      <div className="absolute top-5 right-5 flex rounded-full border border-white/15 overflow-hidden">
        {(['en', 'hi'] as const).map(lang => (
          <button
            key={lang}
            onClick={() => onLanguageSelect(lang)}
            className={`px-3 py-1.5 text-sm transition-colors ${
              language === lang
                ? 'bg-violet-600 text-white'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            {lang === 'en' ? 'EN' : 'हि'}
          </button>
        ))}
      </div>

      <motion.div
        className="w-full max-w-md flex flex-col gap-7"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Header */}
        <div className="text-center">
          <div className="text-4xl mb-3 select-none">🌸</div>
          <h1 className="text-white text-2xl font-light">{title}</h1>
          <p className="text-white/50 text-sm mt-1">{subtitle}</p>
        </div>

        {/* Bullets */}
        <ul className="flex flex-col gap-3">
          {bullets.map((bullet, i) => (
            <motion.li
              key={i}
              className="flex items-start gap-3 text-white/70 text-sm leading-relaxed"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.08, duration: 0.4 }}
            >
              <span className="text-violet-400 mt-0.5 flex-shrink-0 select-none">✦</span>
              <span>{bullet}</span>
            </motion.li>
          ))}
        </ul>

        {/* Privacy policy */}
        <p className="text-center text-white/25 text-xs">
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white/40 transition-colors"
          >
            {privacyLabel}
          </a>
        </p>

        {/* CTAs */}
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={onConsent}
            className="w-full py-3.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white font-medium text-base transition-colors"
          >
            {ctaLabel}
          </button>
          <button
            onClick={onSkip}
            className="text-white/35 hover:text-white/55 text-sm transition-colors"
          >
            {skipLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
