/**
 * Act 3 — MirrorAndProof
 *
 * - If userText provided: avatar "thinks" 2–3 s → typewriter mirror response
 * - If userText absent: empathy message ("That's okay…")
 * - Social proof card with REAL numbers from platform_stats (< 10: qualitative fallback)
 * - 2 anonymous peer quotes (labelled as representative)
 * - Action affirmation: "Showing up here — that's a meaningful step."
 * - ActSkip / Continue button → onComplete
 */

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ActSkip from './ActSkip';
import { supabase } from '@/integrations/supabase/client';
import { getLiteMirrorResponseText } from '@/lib/liteMirrorResponses';
import type { DeviceTier } from '@/hooks/useDeviceCapability';

interface MirrorAndProofProps {
  onComplete: () => void;
  onSkip: () => void;
  tier: DeviceTier;
  language: 'en' | 'hi';
  /** Text the user submitted in Act 2 — absent when they skipped */
  userText?: string;
}

const SKIPPED_EN = "That's okay. You don't have to share anything you're not ready for.";
const SKIPPED_HI = 'कोई बात नहीं। जब तक तुम तैयार न हो, कुछ भी बताना ज़रूरी नहीं।';

const AFFIRMATION_EN = 'Showing up here — that\'s a meaningful step.';
const AFFIRMATION_HI = 'यहाँ आना — यह एक महत्वपूर्ण कदम है।';

const PEER_QUOTES = [
  {
    en: "I didn't think talking to an AI would help, but it really gave me a space to breathe.",
    hi: 'मुझे नहीं लगा था कि AI से बात करने से फर्क पड़ेगा, पर इसने मुझे सांस लेने की जगह दी।',
    label: 'Student, 19 — representative',
  },
  {
    en: 'For the first time in months, I felt like someone was actually listening.',
    hi: 'महीनों में पहली बार ऐसा लगा जैसे कोई सच में सुन रहा है।',
    label: 'Student, 22 — representative',
  },
];

type MirrorState = 'thinking' | 'response' | 'proof';

// Placeholder mirror response — full LLM integration added in a later phase.
// For lite tier, uses keyword-matched offline responses from liteMirrorResponses.
function buildMirrorResponse(text: string, lang: 'en' | 'hi', tier: DeviceTier): string {
  // Lite tier: use fully offline keyword-matched response
  if (tier === 'lite') {
    return getLiteMirrorResponseText(text, lang);
  }

  const excerpt = text.length > 40 ? text.slice(0, 40) + '…' : text;
  if (lang === 'hi') {
    return `मैं सुन रही हूं। "${excerpt}" — यह सुनकर लगता है कि तुम बहुत कुछ संभाल रहे हो। यह साझा करने के लिए शुक्रिया।`;
  }
  return `I hear you. "${excerpt}" — that sounds like a lot to carry. Thank you for sharing that with me.`;
}

export default function MirrorAndProof({
  onComplete,
  onSkip,
  tier,
  language,
  userText,
}: MirrorAndProofProps) {
  const [mirrorState, setMirrorState] = useState<MirrorState>(
    userText ? 'thinking' : 'proof',
  );
  const [mirrorFull, setMirrorFull] = useState('');
  const [mirrorDisplay, setMirrorDisplay] = useState('');
  const [statsCount, setStatsCount] = useState<number | null>(null);

  const skipLabel = language === 'hi' ? 'जारी रखो' : 'Continue';
  const affirmation = language === 'hi' ? AFFIRMATION_HI : AFFIRMATION_EN;
  const skippedMsg = language === 'hi' ? SKIPPED_HI : SKIPPED_EN;

  // Fetch platform_stats (best-effort)
  useEffect(() => {
    supabase
      .from('platform_stats')
      .select('total_sessions_completed')
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data && data.total_sessions_completed >= 10) {
          setStatsCount(data.total_sessions_completed);
        }
      });
  }, []);

  // Mirror flow: think → response → proof
  useEffect(() => {
    if (!userText) return;

    const response = buildMirrorResponse(userText, language, tier);
    setMirrorFull(response);

    // Think for a random 2–3 s then reveal response
    const thinkMs = 2000 + Math.random() * 1000;
    const t = setTimeout(() => setMirrorState('response'), thinkMs);
    return () => clearTimeout(t);
  }, [userText, language]);

  // Typewriter for mirror response
  useEffect(() => {
    if (mirrorState !== 'response' || !mirrorFull) return;

    // Lite tier: show instantly
    if (tier === 'lite') {
      setMirrorDisplay(mirrorFull);
      const t = setTimeout(() => setMirrorState('proof'), 1200);
      return () => clearTimeout(t);
    }

    let i = 0;
    setMirrorDisplay('');

    const iv = setInterval(() => {
      i++;
      setMirrorDisplay(mirrorFull.slice(0, i));
      if (i >= mirrorFull.length) {
        clearInterval(iv);
        const t = setTimeout(() => setMirrorState('proof'), 1200);
        // Can't easily clean up this inner setTimeout, but it's short-lived
        return;
      }
    }, 28);

    return () => clearInterval(iv);
  }, [mirrorState, mirrorFull, tier]);

  const statsEN = statsCount
    ? `${statsCount.toLocaleString('en-IN')} students across India have found a moment of clarity here.`
    : 'Students across India have found a moment of clarity here.';

  const statsHI = statsCount
    ? `भारत भर के ${statsCount.toLocaleString('hi-IN')} छात्रों ने यहाँ एक पल की शांति पाई है।`
    : 'भारत भर के छात्रों ने यहाँ एक पल की शांति पाई है।';

  const statsText = language === 'hi' ? statsHI : statsEN;

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-50 p-6 overflow-y-auto">
      <ActSkip label={skipLabel} onClick={onComplete} />

      <div className="w-full max-w-lg flex flex-col gap-5 py-14">

        {/* No userText — empathy fallback */}
        {!userText && (
          <motion.p
            className="text-white/70 text-lg text-center leading-relaxed"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {skippedMsg}
          </motion.p>
        )}

        {/* Thinking dots */}
        {userText && mirrorState === 'thinking' && (
          <motion.div
            className="flex items-center gap-3 justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <style>{`
              @keyframes mm-bounce {
                0%, 100% { transform: translateY(0);   opacity: 0.5; }
                50%       { transform: translateY(-7px); opacity: 1;   }
              }
            `}</style>
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-2 h-2 rounded-full bg-violet-400"
                  style={{ animation: `mm-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
                />
              ))}
            </div>
            <span className="text-white/50 text-sm">
              {language === 'hi' ? 'सोच रही हूं…' : 'Reflecting…'}
            </span>
          </motion.div>
        )}

        {/* Mirror response card */}
        {userText && (mirrorState === 'response' || mirrorState === 'proof') && (
          <AnimatePresence>
            <motion.div
              className="bg-violet-900/20 border border-violet-500/20 rounded-2xl px-6 py-5"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-white/85 text-base leading-relaxed">
                {mirrorDisplay}
              </p>
            </motion.div>
          </AnimatePresence>
        )}

        {/* Social proof section */}
        {mirrorState === 'proof' && (
          <motion.div
            className="flex flex-col gap-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {/* Stats */}
            <p className="text-white/45 text-sm text-center leading-relaxed">
              {statsText}
            </p>

            {/* Peer quotes */}
            {PEER_QUOTES.map((q, i) => (
              <div
                key={i}
                className="rounded-xl px-5 py-4"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <p className="text-white/65 text-sm italic leading-relaxed">
                  &ldquo;{language === 'hi' ? q.hi : q.en}&rdquo;
                </p>
                <p className="text-white/30 text-xs mt-2">{q.label}</p>
              </div>
            ))}

            {/* Affirmation */}
            <p className="text-violet-300 text-center font-light text-base">
              {affirmation}
            </p>

            {/* Continue CTA */}
            <motion.button
              onClick={onComplete}
              className="self-center mt-1 px-10 py-3 rounded-full bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              {language === 'hi' ? 'जारी रखो' : 'Continue'}
            </motion.button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
