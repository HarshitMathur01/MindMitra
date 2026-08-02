/**
 * Which renderer draws the chat avatar.
 *
 * `talkinghead` — the local three.js GLB rig in public/talkinghead.html.
 *   Speech comes from the MindMitra pipeline: POST /chat runs crisis_bypass →
 *   orchestrator → safety_gate, and only the approved text is spoken.
 *
 * `anam` — Anam.ai hosted avatar over WebRTC, running in *turnkey* mode:
 *   Anam supplies the STT, the LLM and the TTS. Replies on this path do NOT
 *   pass through the MindMitra safety pipeline.
 *
 * The default is deliberately `talkinghead`. Anam is opt-in per environment so
 * that shipping this code changes nothing for existing users. Do not flip the
 * default until the crisis-detection layer for the Anam path exists.
 */
export type AvatarProvider = 'talkinghead' | 'anam';

export const AVATAR_PROVIDER: AvatarProvider =
  import.meta.env.VITE_AVATAR_PROVIDER?.trim().toLowerCase() === 'anam' ? 'anam' : 'talkinghead';

export const isAnamAvatar = AVATAR_PROVIDER === 'anam';
