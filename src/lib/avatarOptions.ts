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
    url: '/talkinghead/avatars/Brunette.glb',
  },
  {
    id: 'valentina',
    name: 'Valentina',
    description: 'Radiant & bold',
    url: '/talkinghead/avatars/Valentina.glb',
  },
  {
    id: 'avaturn',
    name: 'Maya',
    description: 'Photorealistic',
    url: '/talkinghead/avatars/avaturn.glb',
  },
] as const;

export type AvatarModelId = (typeof AVATAR_OPTIONS)[number]['id'];
