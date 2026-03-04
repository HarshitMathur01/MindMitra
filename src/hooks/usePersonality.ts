import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import {
  type Personality,
  type PersonalityId,
  personalities,
  defaultPersonality,
  getPersonalityById,
} from '@/data/personalities'

interface UsePersonalityReturn {
  personality: Personality
  companionName: string
  loading: boolean
  saving: boolean
  setPersonalityId: (id: PersonalityId) => void
  setCompanionName: (name: string) => void
  /** Pass override values to avoid stale-closure issues when calling save() immediately after setState */
  save: (overridePersonalityId?: PersonalityId, overrideCompanionName?: string) => Promise<void>
  /** True when a chat session is active — used to trigger mid-session warning */
  hasActiveSession: boolean
  setHasActiveSession: (v: boolean) => void
}

export function usePersonality(): UsePersonalityReturn {
  const { user } = useAuth()
  const [personality, setPersonality] = useState<Personality>(defaultPersonality)
  const [companionName, setCompanionName] = useState(defaultPersonality.name)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasActiveSession, setHasActiveSession] = useState(false)

  // Load saved personality + custom name from Supabase on mount
  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    let cancelled = false
    const load = async () => {
      try {
        const { data } = await (supabase as any)
          .from('user_settings')
          .select('companion_personality, companion_name')
          .eq('user_id', user.id)
          .maybeSingle()

        if (!cancelled && data) {
          if (data.companion_personality) {
            const found = getPersonalityById(data.companion_personality as PersonalityId)
            setPersonality(found)
            // Use custom name if set, otherwise fall back to personality default name
            setCompanionName(data.companion_name || found.name)
          } else if (data.companion_name) {
            setCompanionName(data.companion_name)
          }
        }
      } catch (err) {
        console.error('[usePersonality] Failed to load:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user?.id])

  const setPersonalityId = useCallback((id: PersonalityId) => {
    const found = getPersonalityById(id)
    setPersonality(found)
  }, [])

  const save = useCallback(async (
    overridePersonalityId?: PersonalityId,
    overrideCompanionName?: string,
  ) => {
    if (!user?.id) return
    setSaving(true)
    const idToSave = overridePersonalityId ?? personality.id
    const nameToSave = (overrideCompanionName ?? companionName).trim() ||
      getPersonalityById(idToSave).name
    try {
      await (supabase as any)
        .from('user_settings')
        .upsert(
          {
            user_id: user.id,
            companion_personality: idToSave,
            companion_name: nameToSave,
          },
          { onConflict: 'user_id' }
        )
    } catch (err) {
      console.error('[usePersonality] Failed to save:', err)
      throw err
    } finally {
      setSaving(false)
    }
  }, [user?.id, personality.id, companionName])

  return {
    personality,
    companionName,
    loading,
    saving,
    setPersonalityId,
    setCompanionName,
    save,
    hasActiveSession,
    setHasActiveSession,
  }
}
