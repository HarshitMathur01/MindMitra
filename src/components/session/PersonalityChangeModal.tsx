import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Personality } from '@/data/personalities'

interface PersonalityChangeModalProps {
  open: boolean
  currentPersonality: Personality
  newPersonality: Personality
  onKeep: () => void
  onSwitch: () => void
}

export function PersonalityChangeModal({
  open,
  currentPersonality,
  newPersonality,
  onKeep,
  onSwitch,
}: PersonalityChangeModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onKeep}
            aria-hidden
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.2 }}
            className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="personality-change-title"
            aria-describedby="personality-change-desc"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="rounded-full bg-warning/10 p-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <h3
                  id="personality-change-title"
                  className="text-lg font-semibold text-text-primary"
                >
                  Switch companion mid-session?
                </h3>
                <p
                  id="personality-change-desc"
                  className="text-sm text-text-secondary mt-1 leading-relaxed"
                >
                  Switching from{' '}
                  <span className="font-medium" style={{ color: currentPersonality.colorAccent }}>
                    {currentPersonality.emoji} {currentPersonality.name}
                  </span>{' '}
                  to{' '}
                  <span className="font-medium" style={{ color: newPersonality.colorAccent }}>
                    {newPersonality.emoji} {newPersonality.name}
                  </span>{' '}
                  will start a fresh conversation context. Your current session will be saved to
                  your history.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <Button
                variant="ghost"
                onClick={onKeep}
                className="flex-1 rounded-xl"
              >
                Keep {currentPersonality.name}
              </Button>
              <Button
                onClick={onSwitch}
                className="flex-1 rounded-xl text-white"
                style={{ backgroundColor: newPersonality.colorAccent }}
              >
                Switch to {newPersonality.name}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
