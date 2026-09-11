/**
 * sentiment — pick an avatar facial expression from assistant reply text.
 *
 * Extracted out of `useChat.tsx`: this is domain logic, not view state, and
 * keeping it in the hook meant the only way to exercise it was to mount a
 * React provider. The rules are declared as data, in the same shape as
 * `lib/mindgym/catalog.ts`, so adding an expression is a table edit rather
 * than a branch.
 *
 * Scoring is deliberately dumb — substring counting, not NLP. It drives a
 * face, never a clinical decision, so a miss costs an expression and nothing
 * more. Crisis handling lives server-side in `crisis_bypass.py` and does not
 * consult this file.
 */

/** Expressions the avatar rig can render. `default` is the neutral rest face. */
export const FACIAL_EXPRESSIONS = [
  "default",
  "smile",
  "gentle",
  "compassionate",
  "concerned",
  "thoughtful",
  "hopeful",
  "listening",
  "sad",
  "surprised",
  "angry",
] as const;

export type FacialExpression = (typeof FACIAL_EXPRESSIONS)[number];

/** A scored expression: `threshold` is the minimum word hits needed to win. */
export interface SentimentRule {
  readonly words: readonly string[];
  readonly threshold: number;
}

/**
 * Declaration order is significant: ties are broken by first-declared, because
 * the scan below takes a category only on a strictly greater score. Reordering
 * these keys changes which face wins on an even match.
 */
export const SENTIMENT_RULES: Readonly<
  Record<Exclude<FacialExpression, "default">, SentimentRule>
> = {
  smile: {
    words: [
      "happy", "great", "wonderful", "excellent", "good", "love", "amazing",
      "awesome", "fantastic", "joy", "excited", "proud", "grateful", "thank",
      "smile", "better", "improved", "success", "congratulations", "well done",
      "brilliant",
    ],
    threshold: 2,
  },
  gentle: {
    words: [
      "it's okay", "take your time", "no rush", "gently", "softly", "slowly",
      "breathe", "calm", "relax", "peace", "safe", "comfortable",
      "at your own pace",
    ],
    threshold: 1,
  },
  compassionate: {
    words: [
      "i understand", "i hear you", "that must be", "i'm sorry you",
      "it makes sense", "you're not alone", "i'm here for",
      "that sounds really", "i can see", "must have been",
      "your feelings are valid",
    ],
    threshold: 1,
  },
  concerned: {
    words: [
      "worried", "concerning", "alarming", "careful", "watch out", "be aware",
      "risk", "dangerous", "warning", "serious", "important to note",
      "pay attention",
    ],
    threshold: 1,
  },
  thoughtful: {
    words: [
      "think about", "consider", "perhaps", "maybe", "what if", "reflect",
      "ponder", "let's explore", "interesting", "perspective", "another way",
      "on the other hand",
    ],
    threshold: 1,
  },
  hopeful: {
    words: [
      "hope", "believe", "possible", "potential", "looking forward",
      "optimistic", "bright", "opportunity", "growth", "progress", "promising",
      "you can", "you will",
    ],
    threshold: 1,
  },
  listening: {
    words: [
      "tell me more", "go on", "i see", "continue", "and then",
      "what happened", "how did that", "can you share",
    ],
    threshold: 1,
  },
  sad: {
    words: [
      "sad", "unfortunately", "terrible", "awful", "loss", "grief", "mourn",
      "depressed", "lonely", "heartbreak", "miss", "regret", "sorry for your",
    ],
    threshold: 1,
  },
  surprised: {
    words: [
      "wow", "really", "unbelievable", "surprised", "shocked", "incredible",
      "unexpected", "astonishing", "no way",
    ],
    threshold: 2,
  },
  angry: {
    words: [
      "angry", "furious", "outraged", "unacceptable", "infuriating", "rage",
    ],
    threshold: 2,
  },
};

/**
 * Highest-scoring expression that clears its own threshold, else `default`.
 * A question mark with no other signal reads as `listening` so the avatar
 * holds an attentive face while the user answers.
 */
export function detectSentiment(text: string): FacialExpression {
  if (!text) return "default";

  const lowerText = text.toLowerCase();

  let bestExpression: FacialExpression = "default";
  let bestScore = 0;

  for (const [expression, rule] of Object.entries(SENTIMENT_RULES) as [
    Exclude<FacialExpression, "default">,
    SentimentRule,
  ][]) {
    const score = rule.words.filter((word) => lowerText.includes(word)).length;
    if (score >= rule.threshold && score > bestScore) {
      bestScore = score;
      bestExpression = expression;
    }
  }

  if (bestExpression === "default" && text.includes("?")) {
    return "listening";
  }

  return bestExpression;
}
