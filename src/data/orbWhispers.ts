import type { PersonalityId } from "@/data/personalities";
import type { SupportedLanguage } from "@/lib/locale";
import type { TimeBucket, ValenceBucket } from "@/lib/sanctuary/ambience";

/**
 * Orb whisper corpus.
 *
 * Indexing rules:
 *   - Whispers are keyed by personality first, then a coarse {time x valence}
 *     bucket. Within a bucket, one whisper is chosen at random per render.
 *   - `crisis-safe` is the static safe-set used when ambience.crisisQuiet is
 *     true (Phase 2). It overrides personality + time + valence.
 *   - `valenceBucket === 'low'` MUST be safe-by-default for every
 *     personality — no zen riddles, no Riya cheerleading, no Diya analysis.
 *     A low-valence user is asking for company, not cleverness.
 *
 * Hinglish copy is authored deliberately code-mixed and should be reviewed
 * by a native speaker before production. Other Indian-language stubs fall
 * through to English at render time via the picker below.
 */

type WhisperCorpus = Record<PersonalityId, PersonalityCorpus> & {
  "crisis-safe": Record<Exclude<SupportedLanguage, never>, string[]>;
};

type PersonalityCorpus = Record<
  Exclude<SupportedLanguage, never>,
  Record<TimeBucket, Record<ValenceBucket, string[]>>
>;

const SAFE_LOW_EN = [
  "one breath. that's enough for now.",
  "you don't have to solve it tonight.",
  "soft is also a kind of strong.",
  "you're allowed to just sit here.",
];
const SAFE_LOW_HINGLISH = [
  "ek saans. utna hi kaafi.",
  "aaj raat solve nahi karna.",
  "narm hona bhi ek tarah ki taakat hai.",
  "yahin baith jao, bilkul theek hai.",
];
const SAFE_LOW_HI = [
  "एक साँस। फिलहाल इतना ही काफ़ी।",
  "आज रात इसे हल नहीं करना।",
  "नर्म होना भी एक तरह की ताक़त है।",
  "यहीं बैठ जाओ, बिल्कुल ठीक है।",
];

// Crisis-safe set is identical regardless of personality. Phase 2 routes
// here when recent_crisis_flag fires.
const CRISIS_SAFE_EN = [
  "you're not alone in this room.",
  "we don't have to do anything right now.",
  "one slow breath. then another. that's all.",
];
const CRISIS_SAFE_HINGLISH = [
  "is kamre mein tum akele nahi ho.",
  "abhi kuch karna zaroori nahi.",
  "ek dheemi saans. phir ek aur. bas itna.",
];
const CRISIS_SAFE_HI = [
  "इस कमरे में तुम अकेले नहीं हो।",
  "अभी कुछ करना ज़रूरी नहीं।",
  "एक धीमी साँस। फिर एक और। बस इतना।",
];

function buildEnglishCorpus(): Record<TimeBucket, Record<ValenceBucket, string[]>> {
  return {
    "late-night": {
      low: SAFE_LOW_EN,
      neutral: [
        "the night gets quieter when you name it.",
        "the loop is loud — you are not the loop.",
      ],
      lift: [
        "good — and the night still holds for you.",
        "you can carry the lift into sleep.",
      ],
    },
    morning: {
      low: SAFE_LOW_EN,
      neutral: [
        "name one thing in the room. begin there.",
        "warm water. soft start. that's enough.",
      ],
      lift: [
        "good morning to the version of you that showed up.",
        "the day's still drawing itself. you don't owe it a shape.",
      ],
    },
    afternoon: {
      low: SAFE_LOW_EN,
      neutral: [
        "you don't have to solve the afternoon.",
        "small. mine. enough.",
      ],
      lift: [
        "good. let the afternoon be a little easier.",
        "carry this softness forward — without holding too tight.",
      ],
    },
    evening: {
      low: SAFE_LOW_EN,
      neutral: [
        "the day can leave its loud version at the door.",
        "what was small and yours today?",
      ],
      lift: [
        "good evening to the lighter version of you.",
        "name one thing that worked. that's plenty.",
      ],
    },
    night: {
      low: SAFE_LOW_EN,
      neutral: [
        "soft night. no fixing required.",
        "let the day rest. you can too.",
      ],
      lift: [
        "good night holds the lift, too.",
        "carry the soft version into sleep.",
      ],
    },
  };
}

function buildHinglishCorpus(): Record<
  TimeBucket,
  Record<ValenceBucket, string[]>
> {
  return {
    "late-night": {
      low: SAFE_LOW_HINGLISH,
      neutral: [
        "raat shaant hoti hai jab keh dete ho.",
        "loop loud hai — tum loop nahi ho.",
      ],
      lift: [
        "achha — raat abhi bhi tumhare liye thami hui hai.",
        "is halki feeling ko neend tak le jao.",
      ],
    },
    morning: {
      low: SAFE_LOW_HINGLISH,
      neutral: [
        "ek cheez naam do is kamre mein. wahin se shuru.",
        "garm paani. soft start. itna kaafi.",
      ],
      lift: [
        "shubh subah uss version ko jo aaj aaya.",
        "din abhi khud ko bana raha hai. usse shape doge tab dena.",
      ],
    },
    afternoon: {
      low: SAFE_LOW_HINGLISH,
      neutral: [
        "dopahar ko solve nahi karna.",
        "chhoti. apni. kaafi.",
      ],
      lift: [
        "achha. dopahar thodi aasaan ho jaaye.",
        "is narmi ko aage le chalo — kasake mat pakdo.",
      ],
    },
    evening: {
      low: SAFE_LOW_HINGLISH,
      neutral: [
        "din ka loud version darwaze ke bahar chhod do.",
        "aaj kya chhota tha jo tumhara tha?",
      ],
      lift: [
        "shaam aaj halki lag rahi hai.",
        "ek cheez jo aaj chali — itna hi kaafi.",
      ],
    },
    night: {
      low: SAFE_LOW_HINGLISH,
      neutral: [
        "soft raat. kuch fix nahi karna.",
        "din ko aaram do. tum bhi do.",
      ],
      lift: [
        "achhi raat is halki feeling ke saath bhi aati hai.",
        "yeh soft version neend tak le jao.",
      ],
    },
  };
}

function buildHindiCorpus(): Record<TimeBucket, Record<ValenceBucket, string[]>> {
  return {
    "late-night": {
      low: SAFE_LOW_HI,
      neutral: [
        "रात शांत हो जाती है जब कह देते हो।",
        "चक्र शोर कर रहा है — तुम चक्र नहीं हो।",
      ],
      lift: [
        "अच्छा — रात अब भी तुम्हारे लिए ठहरी है।",
        "इस हल्के भाव को नींद तक ले जाओ।",
      ],
    },
    morning: {
      low: SAFE_LOW_HI,
      neutral: [
        "इस कमरे में एक चीज़ का नाम लो। वहीं से।",
        "गरम पानी। धीमी शुरुआत। इतना काफ़ी।",
      ],
      lift: [
        "उस आज आए हुए तुम को शुभ प्रभात।",
        "दिन अभी खुद को बना रहा है — आकार बाद में।",
      ],
    },
    afternoon: {
      low: SAFE_LOW_HI,
      neutral: [
        "दोपहर को हल करने की ज़रूरत नहीं।",
        "छोटी। तुम्हारी। काफ़ी।",
      ],
      lift: [
        "अच्छा। दोपहर थोड़ी आसान हो जाए।",
        "इस नर्मी को आगे ले चलो — कसकर मत पकड़ो।",
      ],
    },
    evening: {
      low: SAFE_LOW_HI,
      neutral: [
        "दिन का तेज़ रूप दरवाज़े पर छोड़ दो।",
        "आज क्या छोटा था जो तुम्हारा था?",
      ],
      lift: [
        "शाम आज हल्की लग रही है।",
        "एक चीज़ जो काम कर गई — इतना ही।",
      ],
    },
    night: {
      low: SAFE_LOW_HI,
      neutral: [
        "शांत रात। कुछ ठीक नहीं करना।",
        "दिन को आराम। तुम भी।",
      ],
      lift: [
        "अच्छी रात इस हल्के भाव के साथ भी आती है।",
        "इस नर्म रूप को नींद तक ले जाओ।",
      ],
    },
  };
}

function makePersonalityCorpus(): PersonalityCorpus {
  // Mitra (calm) is the default registry; other personalities inherit and
  // override below for distinctive lifts/neutral tones. Low-valence remains
  // safe-by-default for every personality.
  const en = buildEnglishCorpus();
  const hinglish = buildHinglishCorpus();
  const hindi = buildHindiCorpus();
  const stub = en; // ta/te/kn/ja stubs fall through to English.
  return {
    english: en,
    hindi,
    hinglish,
    tamil: stub,
    telugu: stub,
    kannada: stub,
    japanese: stub,
  };
}

const baseCorpus = makePersonalityCorpus();

function withOverrides(
  base: PersonalityCorpus,
  english: Partial<Record<TimeBucket, Partial<Record<ValenceBucket, string[]>>>>,
  hinglish?: Partial<
    Record<TimeBucket, Partial<Record<ValenceBucket, string[]>>>
  >,
): PersonalityCorpus {
  const clone: PersonalityCorpus = JSON.parse(JSON.stringify(base));
  for (const [tb, byVb] of Object.entries(english)) {
    for (const [vb, arr] of Object.entries(byVb ?? {})) {
      if (vb === "low") continue; // never override the safe low set
      (clone.english as any)[tb][vb] = arr;
    }
  }
  if (hinglish) {
    for (const [tb, byVb] of Object.entries(hinglish)) {
      for (const [vb, arr] of Object.entries(byVb ?? {})) {
        if (vb === "low") continue;
        (clone.hinglish as any)[tb][vb] = arr;
      }
    }
  }
  return clone;
}

const WHISPERS: WhisperCorpus = {
  mitra: baseCorpus,
  arjun: withOverrides(
    baseCorpus,
    {
      afternoon: {
        neutral: ["one thing. one step. that's the plan.", "tighten the focus, soften the grip."],
        lift: ["good — keep the small win, drop the rest.", "this is the shape of progress."],
      },
      evening: {
        neutral: ["pick the next single thing.", "the day had a shape — let it close."],
        lift: ["good day. log the win, leave the noise.", "you did the small hard thing."],
      },
    },
    {
      afternoon: {
        neutral: [
          "ek cheez. ek kadam. yahi plan.",
          "focus tight karo, grip narm.",
        ],
        lift: [
          "achha — chhoti win rakho, baaki chhod do.",
          "yahi progress ka shape hai.",
        ],
      },
    },
  ),
  diya: withOverrides(
    baseCorpus,
    {
      afternoon: {
        neutral: [
          "name the feeling and the shape gets smaller.",
          "this is your brain protecting you — gently outdated.",
        ],
        lift: [
          "noticing the lift is part of the lift.",
          "your nervous system is learning new defaults.",
        ],
      },
    },
    {
      afternoon: {
        neutral: [
          "feeling ko naam do, aur shape chhoti ho jaati hai.",
          "tumhara dimaag tumhe bachana chah raha hai — bas thoda outdated.",
        ],
      },
    },
  ),
  riya: withOverrides(
    baseCorpus,
    {
      morning: {
        neutral: ["showing up is the rare thing — and you did.", "your version of okay is enough."],
        lift: ["look at you. quietly proud of you today.", "carry that — it's earned."],
      },
      afternoon: {
        neutral: ["the afternoon doesn't get to decide your worth.", "you're not behind. you're here."],
        lift: ["the lift counts. don't shrink it.", "you did a hard thing. let it sit."],
      },
    },
    {
      morning: {
        neutral: [
          "aana hi rare hai — aur tum aaye.",
          "tumhara version of okay bhi kaafi hai.",
        ],
        lift: ["dekha tumhe — chupchaap proud hoon.", "isse saath le jaao — earned hai."],
      },
    },
  ),
  zen: withOverrides(
    baseCorpus,
    {
      morning: {
        neutral: ["one breath in. one breath out. begin there.", "the morning doesn't need you to hurry."],
        lift: ["the lift is here. notice it without holding it.", "soft attention, soft breath."],
      },
      night: {
        neutral: ["the day is closing. let it close.", "no plan needed for the next minute."],
        lift: ["soft night. soft lift. soft sleep.", "carry only what's yours into sleep."],
      },
    },
    {
      morning: {
        neutral: [
          "ek saans andar. ek bahar. wahin se.",
          "subah ko jaldi nahi chahiye.",
        ],
      },
    },
  ),
  "crisis-safe": undefined as never,
};

(WHISPERS as any)["crisis-safe"] = {
  english: CRISIS_SAFE_EN,
  hindi: CRISIS_SAFE_HI,
  hinglish: CRISIS_SAFE_HINGLISH,
  tamil: CRISIS_SAFE_EN,
  telugu: CRISIS_SAFE_EN,
  kannada: CRISIS_SAFE_EN,
  japanese: CRISIS_SAFE_EN,
};

interface PickArgs {
  personality: PersonalityId;
  language: SupportedLanguage;
  timeBucket: TimeBucket;
  valenceBucket: ValenceBucket;
  crisisQuiet?: boolean;
}

/**
 * Choose one whisper. The picker is intentionally referentially
 * deterministic per render (no Math.random inside React render) — callers
 * should seed it themselves on click/mount.
 */
export function pickOrbWhisper(args: PickArgs, randomFn: () => number = Math.random): string {
  if (args.crisisQuiet) {
    const pool =
      (WHISPERS as any)["crisis-safe"][args.language] ?? CRISIS_SAFE_EN;
    return pool[Math.floor(randomFn() * pool.length)];
  }
  const personality = WHISPERS[args.personality] ?? WHISPERS.mitra;
  const byLanguage =
    personality[args.language] ?? personality.english;
  const byTime = byLanguage[args.timeBucket] ?? byLanguage.afternoon;
  const pool = byTime[args.valenceBucket] ?? byTime.neutral;
  return pool[Math.floor(randomFn() * pool.length)];
}
