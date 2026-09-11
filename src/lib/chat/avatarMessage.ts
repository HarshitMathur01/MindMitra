/**
 * avatarMessage — adapter from a backend/chat payload to the avatar queue shape.
 *
 * Extracted out of `useChat.tsx` so the hook is state only. Callers hand this
 * a loosely-shaped object (the `/chat` response, an Anam turn, or a bare
 * string wrapped by the caller) and get back the one shape the avatar queue
 * stores.
 */
import { detectSentiment } from "./sentiment";
import { devLog } from "./devLog";

/**
 * What callers may pass in. Every field is optional because the three call
 * paths (HTTP `/chat`, Anam turn recorder, plain string) each populate a
 * different subset — `text` / `message` / `content` are tried in that order.
 *
 * Unknown keys are tolerated and dropped: `ChatGPTInterface` sends `audio`,
 * which nothing downstream reads.
 */
export interface AvatarMessageSource {
  id?: string;
  utteranceId?: string;
  text?: string;
  message?: string;
  content?: string;
  animation?: string;
  /**
   * Snake case on purpose — this mirrors the FastAPI payload.
   *
   * Note that `ChatGPTInterface` passes `facialExpression` (camelCase), which
   * therefore does NOT match here and falls through to `detectSentiment`.
   * Preserved as-is: the avatar rig in turnkey mode reads `text` only, so the
   * expression is currently inert and "fixing" the casing would silently
   * change which face is selected. Fix it deliberately, with the rig, or not
   * at all.
   */
  facial_expression?: string;
  [key: string]: unknown;
}

/** One entry in the avatar playback queue. */
export interface AvatarMessage {
  id?: string;
  utteranceId?: string;
  text: string;
  animation: string;
  facialExpression: string;
}

const DEFAULT_TEXT = "I'm here to help.";

export function transformToAvatarMessage(
  source: AvatarMessageSource,
): AvatarMessage {
  const text = source.text || source.message || source.content || DEFAULT_TEXT;

  devLog("🔄 [Transform] Backend response structure:", {
    hasMessage: "message" in source,
    hasAnimation: "animation" in source,
    hasFacialExpression: "facial_expression" in source,
  });

  const detectedSentiment = detectSentiment(text);
  devLog(`🔄 [Transform] Detected sentiment from text: "${detectedSentiment}"`);

  const avatarMessage: AvatarMessage = {
    id: source.id || source.utteranceId,
    utteranceId: source.utteranceId || source.id,
    text,
    animation: source.animation || (text.length > 0 ? "Talking_0" : "Idle"),
    facialExpression: source.facial_expression || detectedSentiment,
  };

  devLog("🔄 [Transform] Final avatar message:", {
    textLength: avatarMessage.text.length,
    animation: avatarMessage.animation,
    facialExpression: avatarMessage.facialExpression,
  });

  return avatarMessage;
}

/** Normalise the `string | object` union the queue API accepts. */
export function toAvatarMessageSource(
  input: string | AvatarMessageSource,
): AvatarMessageSource {
  return typeof input === "string" ? { content: input } : input;
}

/** Best-effort text of a queue input, for logging and empty-input guards. */
export function avatarSourceText(input: string | AvatarMessageSource): string {
  if (typeof input === "string") return input;
  return input.text || input.message || input.content || "";
}
