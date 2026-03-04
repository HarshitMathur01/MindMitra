/**
 * Act 5 — CompanionRevealAndClose
 *
 * - Matched companion avatar reveal animation
 * - "Meet [Name]." typewriter
 * - "[Companion] is here for [UserName]."
 * - 80% SVG progress ring + checklist (3 done, 1 incomplete)
 * - Primary CTA: "Start Your First Session"
 * - Secondary: "Explore first"
 * - Approach-framed microcopy
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import ActSkip from './ActSkip';
import TypewriterText from './TypewriterText';
import ProgressRing from './ProgressRing';
import type { DeviceTier } from '@/hooks/useDeviceCapability';

export type CompanionId = 'maya' | 'ravi' | 'priya' | 'arjun';

interface CompanionRevealAndCloseProps {
  onComplete: () => void;
  onSkip: () => void;
  tier: DeviceTier;
  language: 'en' | 'hi';
  userName?: string;
  companion?: CompanionId;
}

const COMPANIONS: Record<CompanionId, { name: string; emoji: string; color: string }> = {
  maya: { name: 'Maya', emoji: '🌸', color: '#c084fc' },
  ravi: { name: 'Ravi', emoji: '⚡', color: '#60a5fa' },
  priya: { name: 'Priya', emoji: '🎨', color: '#f472b6' },
  arjun: { name: 'Arjun', emoji: '🧭', color: '#34d399' },
};

const CHECKLIST_EN = [
  { label: 'Your space was opened', done: true },
  { label: 'Companion matched to you', done: true },
  { label: 'A little about you shared', done: true },
  { label: 'First full session completed', done: false },
];

const CHECKLIST_HI = [
  { label: 'तुम्हारी जगह बनाई गई', done: true },
  { label: 'साथी से मिलवाया गया', done: true },
  { label: 'तुम्हारे बारे में जाना', done: true },
  { label: 'पहला पूरा सत्र पूरा हुआ', done: false },
];

const PROGRESS = 0.8;

export default function CompanionRevealAndClose({
  onComplete,
  onSkip,
  tier,
  language,
  userName,
  companion = 'maya',
}: CompanionRevealAndCloseProps) {
  const info = COMPANIONS[companion];

  const meetText =
    language === 'hi' ? `${info.name} से मिलो।` : `Meet ${info.name}.`;

  const hereForText =
    language === 'hi'
      ? `${info.name} ${userName ? `${userName} के लिए` : 'तुम्हारे लिए'} यहाँ है।`
      : `${info.name} is here for ${userName || 'you'}.`;

  const microcopy =
    language === 'hi'
      ? 'ज़्यादातर छात्र सिर्फ एक बातचीत के बाद हल्का महसूस करते हैं।'
      : 'Most students feel lighter after just one conversation.';

  const primaryCTA = language === 'hi' ? 'पहला सत्र शुरू करो' : 'Start Your First Session';
  const secondaryCTA = language === 'hi' ? 'पहले देखो' : 'Explore first';

  const checklist = language === 'hi' ? CHECKLIST_HI : CHECKLIST_EN;

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-50 p-6 overflow-y-auto">
      <ActSkip label={secondaryCTA} onClick={onSkip} />

      <div className="w-full max-w-sm flex flex-col items-center gap-6 py-10">

        {/* Companion avatar reveal */}
        <motion.div
          className="w-28 h-28 rounded-full flex items-center justify-center text-5xl select-none"
          style={{
            background: `radial-gradient(ellipse at 35% 30%, ${info.color}40 0%, ${info.color}15 60%, transparent 100%)`,
            boxShadow: `0 0 60px 20px ${info.color}25, 0 0 0 2px ${info.color}40`,
          }}
          initial={{ scale: 0, opacity: 0, rotate: -15 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.2 }}
        >
          {info.emoji}
        </motion.div>

        {/* "Meet [Name]." — typewriter */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <TypewriterText
            text={meetText}
            speed={55}
            startDelay={500}
            instant={tier === 'lite'}
            className="text-white text-3xl font-light tracking-wide"
            as="h1"
          />
        </motion.div>

        {/* "[Companion] is here for [UserName]." */}
        <motion.p
          className="text-white/60 text-base text-center"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
        >
          {hereForText}
        </motion.p>

        {/* 80% progress ring + checklist */}
        <motion.div
          className="flex flex-col items-center gap-4 w-full"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5 }}
        >
          {/* SVG ring */}
          <ProgressRing
            progress={PROGRESS}
            size={128}
            strokeWidth={8}
            color={info.color}
            animationDuration={1200}
            animationDelay={1600}
            label="80%"
          />

          {/* Checklist */}
          <div className="flex flex-col gap-2 w-full">
            {checklist.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <span
                  className="text-base w-5 flex-shrink-0"
                  style={{ color: item.done ? '#4ade80' : 'rgba(255,255,255,0.2)' }}
                >
                  {item.done ? '✓' : '○'}
                </span>
                <span
                  className="text-sm"
                  style={{ color: item.done ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.25)' }}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Approach-framed microcopy */}
        <motion.p
          className="text-white/40 text-sm text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
        >
          {microcopy}
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="flex flex-col items-center gap-3 w-full"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.2 }}
        >
          <button
            onClick={onComplete}
            className="w-full py-3.5 rounded-full text-white font-medium text-base transition-opacity hover:opacity-90"
            style={{ background: info.color }}
          >
            {primaryCTA}
          </button>
          <button
            onClick={onSkip}
            className="text-white/40 hover:text-white/60 text-sm transition-colors py-1"
          >
            {secondaryCTA}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
