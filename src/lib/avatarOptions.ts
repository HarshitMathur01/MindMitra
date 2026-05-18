/**
 * Available TalkingHead avatar models.
 * The `id` values must match the `avatar_model` column in Supabase `user_settings`
 * and the filenames in public/talkinghead/avatars/ (mind the capitalisation).
 */
export const AVATAR_OPTIONS = [
  {
    id: 'brunette',
    name: 'Aria',
    description: 'Warm & expressive',
    url: '/talkinghead/avatars/brunette.glb',
  },
  {
    id: 'olaf',
    name: 'Olaf',
    description: 'Gentle & playful',
    url: '/talkinghead/avatars/Olaf.glb',
  },
  {
    id: 'avaturn',
    name: 'Maya',
    description: 'Photorealistic',
    url: '/talkinghead/avatars/avaturn.glb',
  },
] as const;

export type AvatarModelId = (typeof AVATAR_OPTIONS)[number]['id'];

export function normalizeAvatarModelId(id: string | null | undefined): AvatarModelId {
  if (id === 'valentina') return 'olaf';
  return AVATAR_OPTIONS.some((avatar) => avatar.id === id)
    ? (id as AvatarModelId)
    : 'brunette';
}
