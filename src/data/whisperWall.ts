import type { SupportedLanguage } from "@/lib/locale";

/**
 * Whisper Wall corpus — anonymous moderated voices from peers.
 *
 * Tagging rules:
 *   - `themes`: coarse keywords (sleep, exams, family, body, loneliness,
 *     friendship, queer, work, money, grief). Phase 2 matches against the
 *     user's `dominant_themes` from /me/snapshot. Phase 1 ignores them
 *     except as a hint to avoid clustering similar quotes.
 *   - `lowAffectSafe`: must be true for quotes that read fine to a heavy
 *     user. Anything with rah-rah energy, anything that implies "you
 *     should be doing X", anything that compares — set to false. The
 *     ambience engine filters by this when valence < -0.3.
 *   - `language`: authoring language. We don't auto-translate; instead
 *     the picker prefers same-language quotes and falls back to English.
 */
export interface Whisper {
  id: string;
  text: string;
  tag: string;
  themes: string[];
  language: SupportedLanguage;
  lowAffectSafe: boolean;
}

export const WHISPERS: Whisper[] = [
  // English ─────────────────────────────────────────────
  {
    id: "en-1",
    text: "i kept the lamp on tonight. small, but mine.",
    tag: "from a peer · 19",
    themes: ["loneliness", "sleep"],
    language: "english",
    lowAffectSafe: true,
  },
  {
    id: "en-2",
    text: "told my sister i'm tired. she just sat with me.",
    tag: "from a peer · 22",
    themes: ["family"],
    language: "english",
    lowAffectSafe: true,
  },
  {
    id: "en-3",
    text: "didn't open the app for a week. came back anyway.",
    tag: "from a peer · 24",
    themes: ["self-compassion"],
    language: "english",
    lowAffectSafe: true,
  },
  {
    id: "en-4",
    text: "the panic passed. it always does. i forget that.",
    tag: "from a peer · 17",
    themes: ["anxiety"],
    language: "english",
    lowAffectSafe: true,
  },
  {
    id: "en-5",
    text: "ate something warm before replying to the email.",
    tag: "from a peer · 26",
    themes: ["work", "self-compassion"],
    language: "english",
    lowAffectSafe: true,
  },
  {
    id: "en-6",
    text: "let the unread messages stay unread for a day. nothing burned.",
    tag: "from a peer · 21",
    themes: ["friendship"],
    language: "english",
    lowAffectSafe: true,
  },
  {
    id: "en-7",
    text: "exam went badly. ate. slept. tried again next morning.",
    tag: "from a peer · 18",
    themes: ["exams"],
    language: "english",
    lowAffectSafe: true,
  },
  {
    id: "en-8",
    text: "told her i'm not okay. she didn't try to fix it. that helped.",
    tag: "from a peer · 23",
    themes: ["friendship"],
    language: "english",
    lowAffectSafe: true,
  },
  // Hinglish ────────────────────────────────────────────
  {
    id: "hg-1",
    text: "aaj raat lamp on rakha. chhoti baat, par meri.",
    tag: "from a peer · 19",
    themes: ["loneliness", "sleep"],
    language: "hinglish",
    lowAffectSafe: true,
  },
  {
    id: "hg-2",
    text: "didi ko bola thaki hoon. usne kuch keh nahi, bas baith gayi.",
    tag: "from a peer · 22",
    themes: ["family"],
    language: "hinglish",
    lowAffectSafe: true,
  },
  {
    id: "hg-3",
    text: "ek hafte app nahi khola. wapas aaya — koi guilt nahi.",
    tag: "from a peer · 24",
    themes: ["self-compassion"],
    language: "hinglish",
    lowAffectSafe: true,
  },
  {
    id: "hg-4",
    text: "exam kharab gaya. khaya. soya. agli subah phir try kiya.",
    tag: "from a peer · 18",
    themes: ["exams"],
    language: "hinglish",
    lowAffectSafe: true,
  },
  // Hindi ───────────────────────────────────────────────
  {
    id: "hi-1",
    text: "आज रात दीप जलाए रखा। छोटी बात, पर अपनी।",
    tag: "from a peer · 19",
    themes: ["loneliness", "sleep"],
    language: "hindi",
    lowAffectSafe: true,
  },
  {
    id: "hi-2",
    text: "दीदी को कहा थकी हूँ। उसने सिर्फ़ साथ बैठा।",
    tag: "from a peer · 22",
    themes: ["family"],
    language: "hindi",
    lowAffectSafe: true,
  },
];
