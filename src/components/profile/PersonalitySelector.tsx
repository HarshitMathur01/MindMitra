import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ChevronDown, ChevronUp, Pencil, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { personalities, type PersonalityId, type Personality, getPersonalityById } from '@/data/personalities'
import { usePersonality } from '@/hooks/usePersonality'
import { PersonalityPreviewChat } from './PersonalityPreviewChat'
import { PersonalityChangeModal } from '@/components/session/PersonalityChangeModal'
import { cn } from '@/lib/utils'

/** Chat interfaces set this key when a session is open */
export const ACTIVE_SESSION_LS_KEY = 'mm-active-chat-session'

function PersonalityCard({
  p,
  isSelected,
  onSelect,
}: {
  p: Personality
  isSelected: boolean
  onSelect: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative w-full rounded-[1.25rem] border p-4 text-left transition-colors duration-base',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        isSelected ? 'border-transparent bg-[hsl(var(--card))] shadow-dashboard-soft' : 'border-ink-3/45 bg-[hsl(var(--ink-1))]/60 hover:border-ink-3/70 dark:bg-[hsl(var(--ink-2))]/50',
      )}
      style={{
        borderColor: isSelected ? p.colorAccent : undefined,
        boxShadow: isSelected ? `0 12px 40px -24px ${p.colorAccent}33` : undefined,
      }}
      role="radio"
      aria-checked={isSelected}
      aria-label={`Select ${p.name} — ${p.tagline}`}
    >
      {/* Active badge */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ type: 'spring', stiffness: 48, damping: 36, mass: 1.1 }}
            className="absolute top-3 right-3 flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium text-white"
            style={{ backgroundColor: p.colorAccent }}
          >
            <Check className="h-3 w-3" strokeWidth={2} />
            In use
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emoji circle */}
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-3"
        style={{ backgroundColor: `${p.colorAccent}15` }}
      >
        {p.emoji}
      </div>

      {/* Name + tagline */}
      <h3 className="text-base font-medium tracking-tight text-ink-8">{p.name}</h3>
      <p className="mt-0.5 text-sm text-ink-5">{p.tagline}</p>

      {/* Best-for chip */}
      <span
        className="inline-block mt-2 rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{
          backgroundColor: `${p.colorAccent}12`,
          color: p.colorAccent,
        }}
      >
        {p.bestFor}
      </span>

      {/* Description */}
      <p className="mt-2 line-clamp-2 text-sm text-ink-5">{p.description}</p>

      {/* Expandable sample response */}
      <div className="mt-3">
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            setExpanded(!expanded)
          }}
          className="flex items-center gap-1 text-xs font-medium transition-colors"
          style={{ color: p.colorAccent }}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Preview response
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className="mt-2 rounded-xl px-3 py-2.5 text-sm text-muted-foreground italic leading-relaxed"
                style={{ backgroundColor: `${p.colorAccent}08` }}
              >
                "{p.sampleResponse}"
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.button>
  )
}

export function PersonalitySelector() {
  const {
    personality, companionName, loading, saving,
    setPersonalityId, setCompanionName, save,
  } = usePersonality()
  const [localSelected, setLocalSelected] = useState<PersonalityId | null>(null)
  const [localName, setLocalName] = useState<string | null>(null)
  const [hasActiveSession, setHasActiveSession] = useState(false)
  const [modalPendingId, setModalPendingId] = useState<PersonalityId | null>(null)
  const { toast } = useToast()

  // Detect whether a chat session is currently open (via localStorage signal)
  useEffect(() => {
    const check = () => setHasActiveSession(localStorage.getItem(ACTIVE_SESSION_LS_KEY) === 'true')
    check()
    window.addEventListener('storage', check)
    return () => window.removeEventListener('storage', check)
  }, [])

  // Use local selection while user is picking, fall back to saved personality
  const selectedId: PersonalityId = localSelected ?? personality.id
  const currentPersonality = personalities.find(p => p.id === selectedId)!
  const displayName = localName ?? companionName
  const hasUnsavedChanges =
    (localSelected !== null && localSelected !== personality.id) ||
    (localName !== null && localName !== companionName)

  const handleSelect = (id: PersonalityId) => {
    if (hasActiveSession && id !== personality.id) {
      // Show mid-session warning before committing selection
      setModalPendingId(id)
      return
    }
    setLocalSelected(id)
    // Reset custom name to the new personality's default when switching
    const p = personalities.find(x => x.id === id)!
    setLocalName(p.name)
  }

  const confirmModalSwitch = () => {
    if (!modalPendingId) return
    const p = personalities.find(x => x.id === modalPendingId)!
    setLocalSelected(modalPendingId)
    setLocalName(p.name)
    setModalPendingId(null)
  }

  const handleSave = async () => {
    const nameToSave = (localName ?? companionName).trim() || currentPersonality.name
    // Pass values directly to avoid stale-closure: save() is called before setPersonalityId/
    // setCompanionName state updates flush, so we supply overrides explicitly.
    try {
      await save(selectedId, nameToSave)
      // Sync hook state only after successful DB write
      setPersonalityId(selectedId)
      setCompanionName(nameToSave)
      setLocalSelected(null)
      setLocalName(null)
      toast({
        title: `${currentPersonality.emoji} ${nameToSave} is now your companion!`,
        description: `Your AI companion will now respond in ${currentPersonality.name}'s style.`,
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Failed to save',
        description: 'Please try again.',
      })
    }
  }

  // Render mid-session switch warning modal
  const showModal = modalPendingId !== null
  const modalNewPersonality = modalPendingId ? getPersonalityById(modalPendingId) : null

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-52 animate-pulse rounded-[1.25rem] border border-ink-3/40 bg-[hsl(var(--ink-1))] dark:bg-[hsl(var(--ink-2))]/60"
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {showModal && modalNewPersonality && (
        <PersonalityChangeModal
          open={showModal}
          currentPersonality={personality}
          newPersonality={modalNewPersonality}
          onKeep={() => setModalPendingId(null)}
          onSwitch={confirmModalSwitch}
        />
      )}

      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-5">Companion</p>
        <div className="mt-1 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]" strokeWidth={1.8} />
          <h2 className="font-display text-xl font-normal tracking-tight text-ink-8 sm:text-2xl">Choose your companion</h2>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-5">
          Their tone shapes every conversation. Switch whenever you like — we&apos;ll save it with care.
        </p>
      </div>

      {/* Personality Cards Grid */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
        role="radiogroup"
        aria-label="AI companion personality"
      >
        {personalities.map(p => (
          <PersonalityCard
            key={p.id}
            p={p}
            isSelected={selectedId === p.id}
            onSelect={() => handleSelect(p.id)}
          />
        ))}
      </div>

      {/* Custom Name Input */}
      <div className="space-y-2">
        <label
          htmlFor="companion-name"
          className="flex items-center gap-1.5 text-sm font-medium text-foreground"
        >
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          Give your companion a name
        </label>
        <div className="flex items-center gap-3">
          <input
            id="companion-name"
            type="text"
            value={displayName}
            onChange={e => setLocalName(e.target.value)}
            maxLength={24}
            placeholder={currentPersonality.name}
            className="w-full max-w-xs rounded-xl border border-ink-3/50 bg-[hsl(var(--ink-1))] px-3 py-2 text-sm text-ink-8 placeholder:text-ink-5/60 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent-400))]/35 dark:bg-[hsl(var(--ink-2))] transition-shadow"
            style={{ '--tw-ring-color': currentPersonality.colorAccent } as any}
            aria-label="Custom companion name"
          />
          <span className="text-xs text-muted-foreground/50">
            {displayName.length}/24
          </span>
        </div>
        <p className="text-xs text-muted-foreground/60 ml-0.5">
          They'll introduce themselves with this name. Leave blank to use the default.
        </p>
      </div>

      {/* Mini Chat Preview */}
      <PersonalityPreviewChat personality={currentPersonality} customName={displayName} />

      {/* Save Button */}
      <AnimatePresence>
        {hasUnsavedChanges && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex items-center gap-3"
          >
            <Button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl px-6 text-white transition-colors"
              style={{ backgroundColor: currentPersonality.colorAccent }}
            >
              {saving ? 'Saving...' : `Switch to ${currentPersonality.name}`}
            </Button>
            <Button
              variant="ghost"
              onClick={() => { setLocalSelected(null); setLocalName(null) }}
              className="rounded-xl text-muted-foreground"
            >
              Cancel
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
