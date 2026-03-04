/**
 * Act 4 — PersonalizationSteps
 *
 * Three full-screen steps, one at a time:
 *   Step 0 — "What should I call you?" (text input)
 *   Step 1 — "What brings the most pressure?" (multi-select chips, 8 options)
 *   Step 2 — "How do you prefer support?" (single-select cards, 4 options → companion)
 *
 * Each step has its own contextual ActSkip label.
 * Returns a PersonalizationData object via onComplete.
 */

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ActSkip from './ActSkip';
import type { DeviceTier } from '@/hooks/useDeviceCapability';
import type { CompanionId } from './CompanionRevealAndClose';

export interface PersonalizationData {
  name: string;
  pressures: string[];
  supportStyle: CompanionId;
  companion: CompanionId;
}

interface SupportOption {
  id: CompanionId;
  en: { title: string; desc: string };
  hi: { title: string; desc: string };
}

const SUPPORT_OPTIONS: SupportOption[] = [
  {
    id: 'maya',
    en: { title: 'Talk it through', desc: 'A warm, gentle listener' },
    hi: { title: 'बात करना', desc: 'एक सौम्य, ध्यान से सुनने वाला' },
  },
  {
    id: 'ravi',
    en: { title: 'Give me practical steps', desc: 'Direct, action-focused guidance' },
    hi: { title: 'व्यावहारिक कदम', desc: 'सीधी, कार्यवाही-उन्मुख मदद' },
  },
  {
    id: 'priya',
    en: { title: 'Distract me creatively', desc: 'Playful, imaginative support' },
    hi: { title: 'रचनात्मक ध्यान हटाना', desc: 'खेलपूर्ण, कल्पनाशील सहयोग' },
  },
  {
    id: 'arjun',
    en: { title: 'Help me understand myself', desc: 'Analytical, structured insight' },
    hi: { title: 'खुद को समझना', desc: 'विश्लेषणात्मक, संरचित अंतर्दृष्टि' },
  },
];

const PRESSURE_OPTIONS_EN = [
  'Exams', 'Family pressure', 'Relationships', 'Career anxiety',
  'Loneliness', 'Financial stress', 'Identity confusion', 'Sleep issues',
];
const PRESSURE_OPTIONS_HI = [
  'परीक्षा', 'परिवार का दबाव', 'रिश्ते', 'करियर की चिंता',
  'अकेलापन', 'पैसों की तनाव', 'पहचान की उलझन', 'नींद की समस्या',
];

interface PersonalizationStepsProps {
  onComplete: (data: PersonalizationData) => void;
  onSkip: () => void;
  tier: DeviceTier;
  language: 'en' | 'hi';
}

const slideVariants = {
  enter: { opacity: 0, x: 40 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
};

export default function PersonalizationSteps({
  onComplete,
  onSkip,
  tier: _tier,
  language,
}: PersonalizationStepsProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [pressures, setPressures] = useState<string[]>([]);
  const [supportStyle, setSupportStyle] = useState<CompanionId | ''>('');

  const pressureOptions = language === 'hi' ? PRESSURE_OPTIONS_HI : PRESSURE_OPTIONS_EN;

  const togglePressure = (opt: string) => {
    setPressures(p => p.includes(opt) ? p.filter(x => x !== opt) : [...p, opt]);
  };

  const handleFinalSubmit = () => {
    const companion: CompanionId = (supportStyle as CompanionId) || 'maya';
    onComplete({ name, pressures, supportStyle: companion, companion });
  };

  // Contextual skip labels per step
  const SKIP_LABELS = {
    en: ['Skip for now', 'Skip this', 'Decide later'],
    hi: ['अभी छोड़ो', 'यह छोड़ो', 'बाद में तय करो'],
  };
  const skipLabel = SKIP_LABELS[language][step];

  const handleSkipStep = () => {
    if (step < 2) {
      setStep(s => s + 1);
    } else {
      onSkip();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-50 p-6">
      <ActSkip label={skipLabel} onClick={handleSkipStep} />

      <AnimatePresence mode="wait">

        {/* ── Step 0: Name ── */}
        {step === 0 && (
          <motion.div
            key="step-name"
            className="w-full max-w-md flex flex-col items-center gap-6"
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4 }}
          >
            <h2 className="text-white text-2xl font-light text-center">
              {language === 'hi'
                ? 'मुझे तुम्हें क्या बुलाना चाहिए?'
                : 'What should I call you?'}
            </h2>

            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && name.trim()) setStep(1);
              }}
              className="w-full bg-crushed-silk/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-lg focus:outline-none focus:border-violet-400/50 transition-colors"
              placeholder={language === 'hi' ? 'तुम्हारा नाम' : 'Your name'}
              maxLength={40}
              autoFocus
            />

            <button
              onClick={() => setStep(1)}
              disabled={name.trim().length === 0}
              className="px-10 py-3 rounded-full bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {language === 'hi' ? 'अगला' : 'Next'}
            </button>
          </motion.div>
        )}

        {/* ── Step 1: Pressures ── */}
        {step === 1 && (
          <motion.div
            key="step-pressures"
            className="w-full max-w-md flex flex-col items-center gap-6"
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4 }}
          >
            <h2 className="text-white text-2xl font-light text-center">
              {language === 'hi'
                ? 'सबसे ज़्यादा दबाव कहाँ से आता है?'
                : 'What brings the most pressure?'}
            </h2>

            <div className="flex flex-wrap gap-2 justify-center">
              {pressureOptions.map(opt => (
                <button
                  key={opt}
                  onClick={() => togglePressure(opt)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${pressures.includes(opt)
                      ? 'bg-violet-600 border-violet-500 text-white'
                      : 'bg-crushed-silk/5 border-white/10 text-white/70 hover:border-white/30'
                    }`}
                >
                  {opt}
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep(2)}
              className="px-10 py-3 rounded-full bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors"
            >
              {language === 'hi' ? 'अगला' : 'Next'}
            </button>
          </motion.div>
        )}

        {/* ── Step 2: Support style ── */}
        {step === 2 && (
          <motion.div
            key="step-support"
            className="w-full max-w-md flex flex-col items-center gap-5"
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4 }}
          >
            <h2 className="text-white text-2xl font-light text-center">
              {language === 'hi'
                ? 'तुम किस तरह सहयोग पसंद करते हो?'
                : 'How do you prefer support?'}
            </h2>

            <div className="flex flex-col gap-3 w-full">
              {SUPPORT_OPTIONS.map(opt => {
                const label = language === 'hi' ? opt.hi : opt.en;
                const selected = supportStyle === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setSupportStyle(opt.id)}
                    className={`w-full px-5 py-4 rounded-xl text-left border transition-colors ${selected
                        ? 'bg-violet-900/40 border-violet-500/60 text-white'
                        : 'bg-crushed-silk/3 border-white/10 text-white/70 hover:border-white/25'
                      }`}
                  >
                    <p className="font-medium">{label.title}</p>
                    <p className="text-sm opacity-60 mt-0.5">{label.desc}</p>
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleFinalSubmit}
              disabled={!supportStyle}
              className="px-10 py-3 rounded-full bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {language === 'hi' ? 'जारी रखो' : 'Continue'}
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
