/**
 * DEAD CODE — nothing imports this module.
 *
 * It used to choose between the local TalkingHead three.js rig and the Anam
 * hosted avatar. TalkingHead was deleted in e01fdff, so the chat surface now
 * mounts AnamAvatar unconditionally and `VITE_AVATAR_PROVIDER` has no effect.
 * The live switch is `VITE_ANAM_PIPELINE_MODE` (see src/hooks/useAnamAvatar.ts),
 * which chooses whether Anam's LLM or the MindMitra pipeline writes the replies.
 *
 * Kept rather than deleted so the removal is a deliberate call in its own
 * change set. Delete this file — and the `VITE_AVATAR_PROVIDER` declaration in
 * src/vite-env.d.ts — once nobody still has it set in a deployed environment.
 */
export type AvatarProvider = 'talkinghead' | 'anam';

export const AVATAR_PROVIDER: AvatarProvider =
  import.meta.env.VITE_AVATAR_PROVIDER?.trim().toLowerCase() === 'anam' ? 'anam' : 'talkinghead';

export const isAnamAvatar = AVATAR_PROVIDER === 'anam';
