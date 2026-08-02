/**
 * Available TalkingHead avatar models.
 * The `id` values must match the `avatar_model` column in Supabase `user_settings`
 * and the filenames in public/talkinghead/avatars/ (mind the capitalisation).
 *
 * Optional `ttsVoice`/`ttsLang` pin a per-avatar voice override that takes
 * precedence over the language-derived locale voice.
 */
type AvatarOption = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly url: string;
  readonly ttsVoice?: string;
  readonly ttsLang?: string;
};

export const AVATAR_OPTIONS = [
  {
    id: 'brunette',
    name: 'Aria',
    description: 'Warm & expressive',
    url: '',
  },
  {
    id: 'olaf',
    name: 'Olaf',
    description: 'Gentle & playful',
    url: '',
    ttsVoice: 'en-US-DavisNeural',
    ttsLang: 'en-US',
  },
  {
    id: 'avaturn',
    name: 'Maya',
    description: 'Photorealistic',
    url: '',
  },
] as const satisfies readonly AvatarOption[];

export type AvatarModelId = (typeof AVATAR_OPTIONS)[number]['id'];

export function normalizeAvatarModelId(id: string | null | undefined): AvatarModelId {
  if (id === 'valentina') return 'olaf';
  return AVATAR_OPTIONS.some((avatar) => avatar.id === id)
    ? (id as AvatarModelId)
    : 'brunette';
}
