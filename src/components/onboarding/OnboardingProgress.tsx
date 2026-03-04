/**
 * OnboardingProgress — 7 subtle progress dots at the top of the screen.
 *
 * Visual states per dot:
 *  - completed: filled violet (reduced opacity)
 *  - active:    wider pill, full violet
 *  - upcoming:  faint white glow
 *
 * Hidden during the consent gate (actIndex < 0).
 * Uses only transform + opacity for GPU-accelerated 60 fps.
 */

import React from 'react';

interface OnboardingProgressProps {
  /** 0-based index of the active act (0 = act0, 5 = act5). -1 hides the bar. */
  actIndex: number;
  /** Total number of acts in the current tier's sequence. */
  totalActs: number;
}

export default function OnboardingProgress({ actIndex, totalActs }: OnboardingProgressProps) {
  if (actIndex < 0 || totalActs <= 0) return null;

  return (
    <div
      className="fixed top-5 left-0 right-0 flex justify-center z-[120] pointer-events-none"
      role="progressbar"
      aria-valuenow={actIndex + 1}
      aria-valuemin={1}
      aria-valuemax={totalActs}
      aria-label={`Step ${actIndex + 1} of ${totalActs}`}
    >
      <div className="flex items-center gap-2">
        {Array.from({ length: totalActs }).map((_, i) => {
          const isActive = i === actIndex;
          const isCompleted = i < actIndex;

          return (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: isActive ? 18 : 6,
                height: 6,
                background: isCompleted
                  ? 'rgba(139,92,246,0.60)'
                  : isActive
                    ? 'rgba(124,58,237,0.95)'
                    : 'rgba(255,255,255,0.10)',
                boxShadow: isActive
                  ? '0 0 8px 2px rgba(124,58,237,0.3)'
                  : 'none',
                transition: 'width 0.4s ease, background 0.4s ease, box-shadow 0.4s ease',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
