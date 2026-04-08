/**
 * Client-side crisis keyword screening.
 *
 * Privacy-first: only the level + matched pattern *categories* leave this
 * module — no raw user text is ever stored or transmitted.
 *
 * Supports English and Hindi (Devanagari + Romanised transliteration).
 */

export type CrisisLevel = 'critical' | 'high' | 'medium' | 'none';

export interface CrisisScreenResult {
  level: CrisisLevel;
  /** Pattern category labels that matched (e.g. "suicidal-ideation-en") */
  matchedPatterns: string[];
  suggestedAction: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyword lists
// Each entry: { id: string (category label), patterns: RegExp[] }
// Patterns are case-insensitive; tested against the lowercased input.
// ─────────────────────────────────────────────────────────────────────────────

interface PatternGroup {
  id: string;
  level: CrisisLevel;
  patterns: RegExp[];
}

const PATTERN_GROUPS: PatternGroup[] = [
  // ── CRITICAL ──────────────────────────────────────────────────────────────
  {
    id: 'suicidal-ideation-en',
    level: 'critical',
    patterns: [
      /\bkill\s+myself\b/,
      /\bsuicid/,              // suicide, suicidal
      /\bend\s+my\s+life\b/,
      /\bwant\s+to\s+die\b/,
      /\bending\s+it\s+all\b/,
      /\bcan'?t\s+go\s+on\b/,
      /\bno\s+reason\s+to\s+live\b/,
      /\bnot\s+want\s+to\s+be\s+alive\b/,
      /\btake\s+my\s+(own\s+)?life\b/,
    ],
  },
  {
    id: 'suicidal-ideation-hi-devanagari',
    level: 'critical',
    patterns: [
      /मरना\s*चाहता/,
      /मरना\s*चाहती/,
      /जान\s*दे\s*दूं/,
      /जान\s*दे\s*दूँ/,
      /खत्म\s*करना\s*चाहता/,
      /जीना\s*नहीं\s*चाहता/,
      /ज़िंदगी\s*खत्म/,
      /आत्महत्या/,
    ],
  },
  {
    id: 'suicidal-ideation-hi-roman',
    level: 'critical',
    patterns: [
      /\bmarna\s+chahta\b/,
      /\bmarna\s+chahti\b/,
      /\bjaan\s+de\s+du(n|ng)?\b/,
      /\bkhatam\s+karna\s+chahta\b/,
      /\bjeena\s+nahi\s+chahta\b/,
      /\batmahatya\b/,
    ],
  },

  // ── HIGH ──────────────────────────────────────────────────────────────────
  {
    id: 'self-harm-en',
    level: 'high',
    patterns: [
      /\bhurt\s+myself\b/,
      /\bself[\s-]?harm/,
      /\bcutting\s+myself\b/,
      /\bcut\s+myself\b/,
      /\bburning\s+myself\b/,
    ],
  },
  {
    id: 'severe-hopelessness-en',
    level: 'high',
    patterns: [
      /\bhopeless\b/,
      /\bworthless\b/,
      /\bno\s+point\s+in\s+living\b/,
      /\blife\s+is\s+pointless\b/,
      /\bno\s+one\s+cares?\s+if\s+i\s+(live|die)\b/,
    ],
  },
  {
    id: 'self-harm-hi-devanagari',
    level: 'high',
    patterns: [
      /खुद\s*को\s*नुकसान/,
      /खुद\s*को\s*चोट/,
      /उम्मीद\s*नहीं/,
      /बेकार\s*हूं/,
      /बेकार\s*हूँ/,
    ],
  },
  {
    id: 'self-harm-hi-roman',
    level: 'high',
    patterns: [
      /\bkhud\s+ko\s+(hurt|nuksan|chot)\b/,
      /\bummeed\s+nahi\b/,
      /\bumeed\s+nahi\b/,
      /\bbekaar\s+hu(n|ng)?\b/,
    ],
  },
  {
    id: 'suicidal-ideation-ja',
    level: 'critical',
    patterns: [
      /死にたい/,
      /自殺/,
      /生きたくない/,
    ],
  },
  {
    id: 'self-harm-ja',
    level: 'high',
    patterns: [
      /自分を傷つけ/,
      /死のう/,
      /生きる意味/,
    ],
  },
  {
    id: 'suicidal-ideation-te',
    level: 'critical',
    patterns: [
      /చనిపోవాలని/,
      /ఆత్మహత్య/,
    ],
  },
  {
    id: 'self-harm-te',
    level: 'high',
    patterns: [
      /బ్రతకాలని\s*లేదు/,
      /నన్ను\s*నేను\s*హర్ట్/,
    ],
  },
  {
    id: 'suicidal-ideation-kn',
    level: 'critical',
    patterns: [
      /ಸಾಯಬೇಕು/,
      /ಆತ್ಮಹತ್ಯೆ/,
    ],
  },
  {
    id: 'self-harm-kn',
    level: 'high',
    patterns: [
      /ಬದುಕಲು\s*ಇಷ್ಟವಿಲ್ಲ/,
    ],
  },
  {
    id: 'suicidal-ideation-ta',
    level: 'critical',
    patterns: [
      /சாகணும்/,
      /தற்கொலை/,
    ],
  },
  {
    id: 'self-harm-ta',
    level: 'high',
    patterns: [
      /வாழ\s*விரும்பவில்லை/,
    ],
  },

  // ── MEDIUM ────────────────────────────────────────────────────────────────
  {
    id: 'distress-en',
    level: 'medium',
    patterns: [
      /\bcan'?t\s+cope\b/,
      /\boverwhelmed\b/,
      /\bfalling\s+apart\b/,
      /\bbreaking\s+down\b/,
      /\bextremely?\s+(stressed|anxious|depressed)\b/,
      /\bcan'?t\s+take\s+it\s+anymore\b/,
      /\bdon'?t\s+want\s+to\s+wake\s+up\b/,
    ],
  },
  {
    id: 'distress-hi-devanagari',
    level: 'medium',
    patterns: [
      /संभाल\s*नहीं\s*पा\s*रहा/,
      /बहुत\s*परेशान/,
      /अंदर\s*से\s*टूट/,
      /थक\s*गया\s*हूं/,
      /थक\s*गई\s*हूं/,
    ],
  },
  {
    id: 'distress-hi-roman',
    level: 'medium',
    patterns: [
      /\bsambhal\s+nahi\s+pa\s+raha\b/,
      /\bbahut\s+pareshan\b/,
      /\bandar\s+se\s+toot\b/,
      /\bthak\s+gaya\s+hu(n|ng)?\b/,
    ],
  },
];

// Priority order for resolving the final level
const LEVEL_PRIORITY: Record<CrisisLevel, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  none: 0,
};

const SUGGESTED_ACTIONS: Record<CrisisLevel, string> = {
  critical:
    'Please reach out to a crisis helpline immediately. India: iCall 9152987821 | Vandrevala Foundation 1860-2662-345 (24/7)',
  high:
    'It sounds like you\'re going through something really painful. Please consider talking to a mental health professional or a trusted person.',
  medium:
    'It seems you\'re feeling overwhelmed. Try a grounding exercise, or speak with your MindMitra companion for support.',
  none: '',
};

/**
 * Screen `text` for crisis signals.
 *
 * @param text - Raw user input (not stored anywhere by this function)
 * @returns CrisisScreenResult with level, matched pattern ids, and a suggested action
 */
export function screenForCrisis(text: string): CrisisScreenResult {
  const lower = text.toLowerCase();
  const matchedPatterns: string[] = [];
  let topLevel: CrisisLevel = 'none';

  for (const group of PATTERN_GROUPS) {
    const hit = group.patterns.some(re => re.test(lower) || re.test(text));
    if (hit) {
      matchedPatterns.push(group.id);
      if (LEVEL_PRIORITY[group.level] > LEVEL_PRIORITY[topLevel]) {
        topLevel = group.level;
      }
    }
  }

  return {
    level: topLevel,
    matchedPatterns,
    suggestedAction: SUGGESTED_ACTIONS[topLevel],
  };
}
