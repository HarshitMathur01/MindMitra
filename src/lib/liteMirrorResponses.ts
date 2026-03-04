/**
 * liteMirrorResponses — offline keyword-matched empathetic responses.
 *
 * Used when the device is in 'lite' tier or when the network is unavailable,
 * so the LLM mirror-response API cannot be reached.
 *
 * How it works:
 *  1. Tokenize the user's text
 *  2. Match against keyword groups (English + Hindi + Romanised Hindi)
 *  3. Return the best-matching response (highest keyword overlap)
 *  4. Fallback: generic empathetic acknowledgement
 *
 * Privacy: only the matched *category* is used — no user text leaves this module.
 */

// ── Types ──────────────────────────────────────────────────────────────────

interface KeywordGroup {
    id: string;
    keywords: string[]; // all lowercase
    response: { en: string; hi: string };
}

// ── Keyword → Response mapping ─────────────────────────────────────────────

const KEYWORD_GROUPS: KeywordGroup[] = [
    // ── Exams / Academic pressure ──
    {
        id: 'academic',
        keywords: [
            'exam', 'exams', 'test', 'marks', 'grade', 'grades', 'study', 'studying',
            'fail', 'failed', 'failure', 'result', 'results', 'board', 'boards',
            'jee', 'neet', 'cat', 'gpa', 'cgpa', 'semester', 'backlog',
            'pariksha', 'pareeksha', 'padhai', 'number', 'marksheet',
            'परीक्षा', 'पढ़ाई', 'नंबर', 'फेल', 'रिजल्ट', 'बोर्ड',
        ],
        response: {
            en: 'I hear you — the pressure around exams can feel suffocating. Whatever the result, it doesn\'t define who you are. You\'re more than a score.',
            hi: 'मैं समझती हूं — परीक्षा का दबाव बहुत भारी लग सकता है। नतीजा जो भी हो, वह तुम्हारी पहचान नहीं बनाता। तुम एक नंबर से बहुत ज़्यादा हो।',
        },
    },

    // ── Family pressure ──
    {
        id: 'family',
        keywords: [
            'family', 'parents', 'parent', 'mom', 'dad', 'father', 'mother',
            'expectation', 'expectations', 'pressure', 'disappoint', 'disappointed',
            'comparison', 'compare', 'comparing', 'sibling', 'brother', 'sister',
            'ghar', 'maa', 'papa', 'mummy', 'daddy', 'parivar',
            'परिवार', 'माँ', 'पापा', 'उम्मीद', 'दबाव', 'निराश',
        ],
        response: {
            en: 'Family expectations can weigh so heavily. It\'s okay to feel torn between what they want and what you need. Your feelings are valid.',
            hi: 'परिवार की उम्मीदें बहुत भारी हो सकती हैं। उनकी चाहत और अपनी ज़रूरत के बीच उलझन महसूस करना स्वाभाविक है। तुम्हारी भावनाएं सही हैं।',
        },
    },

    // ── Loneliness / Isolation ──
    {
        id: 'loneliness',
        keywords: [
            'lonely', 'alone', 'loneliness', 'isolated', 'isolation', 'nobody',
            'no one', 'no friends', 'friendless', 'invisible',
            'akela', 'akeli', 'koi nahi', 'tanha',
            'अकेला', 'अकेली', 'कोई नहीं', 'तन्हा', 'अकेलापन',
        ],
        response: {
            en: 'Feeling alone — even in a crowd — is one of the hardest things. I\'m here, and this space is yours. You don\'t have to carry this by yourself.',
            hi: 'अकेलापन — भीड़ में भी — सबसे मुश्किल चीज़ों में से एक है। मैं यहाँ हूं, और यह जगह तुम्हारी है। तुम्हें यह अकेले नहीं उठाना है।',
        },
    },

    // ── Relationships ──
    {
        id: 'relationships',
        keywords: [
            'relationship', 'breakup', 'break up', 'broke up', 'boyfriend', 'girlfriend',
            'love', 'heartbreak', 'heartbroken', 'partner', 'crush', 'rejection',
            'rejected', 'ghosted', 'trust', 'cheated',
            'rishta', 'pyar', 'dil toota', 'dhoka',
            'रिश्ता', 'प्यार', 'दिल टूटा', 'धोखा', 'ब्रेकअप',
        ],
        response: {
            en: 'Heartache is real and valid. Whether it\'s new or old, the pain you\'re feeling matters. Healing isn\'t linear, and it\'s okay to take your time.',
            hi: 'दिल का दर्द असली है और सही है। चाहे नया हो या पुराना, तुम जो महसूस कर रहे हो — वो मायने रखता है। ठीक होने में वक्त लगता है, और वह ठीक है।',
        },
    },

    // ── Career / Future anxiety ──
    {
        id: 'career',
        keywords: [
            'career', 'job', 'jobs', 'placement', 'placements', 'future', 'uncertain',
            'campus', 'unemployed', 'unemployment', 'interview', 'reject', 'no offer',
            'lost', 'confused', 'direction', 'what to do',
            'naukri', 'placement', 'kya karu', 'future',
            'करियर', 'नौकरी', 'प्लेसमेंट', 'भविष्य', 'क्या करूं',
        ],
        response: {
            en: 'Not knowing what\'s next can feel terrifying. But uncertainty isn\'t failure — it\'s just a chapter that hasn\'t been written yet. You\'re allowed to not have it figured out.',
            hi: 'आगे क्या होगा — यह न जानना डरा सकता है। लेकिन अनिश्चितता असफलता नहीं है — यह बस एक अध्याय है जो अभी लिखा नहीं गया। सब कुछ समझ में न आना ठीक है।',
        },
    },

    // ── Sleep issues ──
    {
        id: 'sleep',
        keywords: [
            'sleep', 'insomnia', 'cant sleep', "can't sleep", 'awake', 'nightmares',
            'nightmare', 'restless', 'tired', 'exhausted', 'fatigue',
            'neend', 'nind', 'soya nahi', 'thak gaya', 'thak gayi',
            'नींद', 'सोया नहीं', 'थक गया', 'थक गई', 'बेचैनी',
        ],
        response: {
            en: 'When sleep won\'t come, everything feels harder. Your body is telling you something. You deserve rest, and it\'s okay to ask for help finding it.',
            hi: 'जब नींद नहीं आती, सब कुछ और मुश्किल लगता है। तुम्हारा शरीर कुछ कह रहा है। तुम आराम के हकदार हो, और मदद माँगना ठीक है।',
        },
    },

    // ── Identity / Self-worth ──
    {
        id: 'identity',
        keywords: [
            'identity', 'who am i', 'confused', 'belong', 'belonging', 'fit in',
            'different', 'misfit', 'gender', 'sexuality', 'lgbtq', 'queer',
            'worthless', 'not good enough', 'imposter', 'fake',
            'pehchan', 'kaun hu', 'alag',
            'पहचान', 'कौन हूं', 'अलग', 'बेकार',
        ],
        response: {
            en: 'Questioning who you are is a sign of depth, not weakness. You don\'t have to fit into anyone\'s box. Being you — exactly as you are — is enough.',
            hi: 'खुद को समझने की कोशिश गहराई की निशानी है, कमज़ोरी की नहीं। तुम्हें किसी के खाँचे में फिट होने की ज़रूरत नहीं। जैसे तुम हो — वैसे ही काफ़ी हो।',
        },
    },

    // ── Financial stress ──
    {
        id: 'financial',
        keywords: [
            'money', 'financial', 'afford', 'fee', 'fees', 'loan', 'debt',
            'poor', 'poverty', 'expensive', 'scholarship', 'emi',
            'paisa', 'paise', 'fees', 'karz',
            'पैसा', 'पैसे', 'कर्ज़', 'फ़ीस', 'गरीब',
        ],
        response: {
            en: 'Financial stress touches everything — studies, health, self-worth. It\'s incredibly tough. But your value isn\'t measured by your bank balance.',
            hi: 'पैसों की चिंता हर चीज़ को छूती है — पढ़ाई, सेहत, आत्म-सम्मान। यह बहुत मुश्किल है। लेकिन तुम्हारी कीमत तुम्हारे बैलेंस से नहीं नापी जाती।',
        },
    },

    // ── Anxiety / Overthinking ──
    {
        id: 'anxiety',
        keywords: [
            'anxious', 'anxiety', 'panic', 'worry', 'worried', 'overthink',
            'overthinking', 'racing thoughts', 'cant breathe', "can't breathe",
            'nervous', 'restless', 'uneasy', 'dread',
            'chinta', 'ghabrahat', 'darr', 'pareshan',
            'चिंता', 'घबराहट', 'डर', 'बेचैन', 'परेशान',
        ],
        response: {
            en: 'Anxiety can make the world feel like it\'s closing in. Take a breath. This feeling is real, but it\'s not permanent. You\'re stronger than the worry tells you.',
            hi: 'चिंता से लगता है जैसे दुनिया सिकुड़ रही है। एक सांस लो। यह एहसास असली है, पर यह हमेशा नहीं रहेगा। तुम चिंता से ज़्यादा मज़बूत हो।',
        },
    },

    // ── Sadness / Depression ──
    {
        id: 'sadness',
        keywords: [
            'sad', 'sadness', 'depressed', 'depression', 'crying', 'cry', 'cried',
            'numb', 'empty', 'hollow', 'hopeless', 'broken', 'dark', 'darkness',
            'udas', 'ro raha', 'ro rahi', 'toota', 'andhera',
            'उदास', 'रो रहा', 'रो रही', 'टूटा', 'अंधेरा', 'खालीपन',
        ],
        response: {
            en: 'I see you in this. Sadness doesn\'t need a reason to be valid. Whatever you\'re feeling right now — it\'s okay to feel it. You don\'t have to be strong all the time.',
            hi: 'मैं तुम्हें देखती हूं। उदासी को सही होने के लिए किसी कारण की ज़रूरत नहीं। तुम अभी जो भी महसूस कर रहे हो — उसे महसूस करना ठीक है। हर वक्त मज़बूत होने की ज़रूरत नहीं।',
        },
    },

    // ── Anger / Frustration ──
    {
        id: 'anger',
        keywords: [
            'angry', 'anger', 'frustrated', 'frustration', 'rage', 'furious',
            'irritated', 'annoyed', 'hate', 'fed up', 'sick of',
            'gussa', 'naraz', 'tang',
            'गुस्सा', 'नाराज़', 'तंग', 'बहुत हो गया',
        ],
        response: {
            en: 'Your anger is trying to protect you — it\'s a signal that something matters to you deeply. It\'s okay to feel it. Let\'s find a way to channel it.',
            hi: 'तुम्हारा गुस्सा तुम्हें बचाने की कोशिश कर रहा है — यह संकेत है कि कुछ तुम्हारे लिए गहरा मायने रखता है। इसे महसूस करना ठीक है।',
        },
    },
];

// ── Fallback response ──────────────────────────────────────────────────────

const FALLBACK_RESPONSE = {
    en: 'I hear you. Whatever you\'re carrying right now — it took courage to share it. Thank you for trusting me with this.',
    hi: 'मैं सुन रही हूं। तुम अभी जो भी उठा रहे हो — इसे साझा करने में हिम्मत लगी। इस विश्वास के लिए शुक्रिया।',
};

// ── Tokenizer ──────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^\w\s\u0900-\u097F]/g, ' ') // keep word chars + Devanagari
        .split(/\s+/)
        .filter(Boolean);
}

// ── Public API ─────────────────────────────────────────────────────────────

export interface LiteMirrorResult {
    /** Matched category id, or 'fallback' */
    matchedCategory: string;
    response: { en: string; hi: string };
}

/**
 * Generate a keyword-matched empathetic response entirely offline.
 *
 * @param text  — Raw user input (only processed locally, never stored)
 * @param lang  — Preferred language for the response
 * @returns LiteMirrorResult with the best-match response
 */
export function getLiteMirrorResponse(text: string): LiteMirrorResult {
    const tokens = tokenize(text);
    if (tokens.length === 0) {
        return { matchedCategory: 'fallback', response: FALLBACK_RESPONSE };
    }

    let bestGroup: KeywordGroup | null = null;
    let bestScore = 0;

    for (const group of KEYWORD_GROUPS) {
        let score = 0;
        for (const token of tokens) {
            if (group.keywords.includes(token)) {
                score++;
            }
        }
        // Also check 2-word phrases
        for (let i = 0; i < tokens.length - 1; i++) {
            const bigram = `${tokens[i]} ${tokens[i + 1]}`;
            if (group.keywords.includes(bigram)) {
                score += 2; // bigram matches are stronger signals
            }
        }

        if (score > bestScore) {
            bestScore = score;
            bestGroup = group;
        }
    }

    if (bestGroup && bestScore >= 1) {
        return { matchedCategory: bestGroup.id, response: bestGroup.response };
    }

    return { matchedCategory: 'fallback', response: FALLBACK_RESPONSE };
}

/**
 * Get the mirror response string for a specific language.
 */
export function getLiteMirrorResponseText(text: string, lang: 'en' | 'hi'): string {
    return getLiteMirrorResponse(text).response[lang];
}
