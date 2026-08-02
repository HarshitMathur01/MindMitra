import { ROUND_THE_CLOCK_HELPLINE, helplineHref } from "@/lib/helplines";

/**
 * Every user-facing string on the public (unauthenticated) landing page.
 *
 * Kept in one module so copy review doesn't require reading JSX, and so the
 * banned-words guard (`npm run lint:copy`) has one obvious place to look.
 *
 * Note on the crisis link: it resolves through `@/lib/helplines` rather than
 * hardcoding digits. That module is the single source of truth for every
 * helpline in the product — a landing page that shows a different number
 * from the chat safety rail is exactly the trust failure we can't afford.
 */

export const brand = {
  name: "MindMitra",
  wordmark: "MindMitra",
  tagline: "A companion that listens.",
};

export const hero = {
  headline: "Speak your mind, in your own words.",
  sub: "MindMitra is an AI companion — non-judgmental, anytime, anywhere. Even at 3 in the morning.",
  cta: "Start a conversation",
  ctaHref: "/auth",
  ctaSecondary: "How it works",
  ctaSecondaryHref: "#three-am",
};

export const crisis = {
  label: "Crisis support",
  name: ROUND_THE_CLOCK_HELPLINE.name,
  tel: ROUND_THE_CLOCK_HELPLINE.display,
  href: helplineHref(ROUND_THE_CLOCK_HELPLINE),
  hours: ROUND_THE_CLOCK_HELPLINE.hours,
};

export const nav = [
  { label: "How it works", href: "#three-am" },
  { label: "Companions", href: "#personas" },
  { label: "Trust", href: "#proof" },
];

export const threeAm = {
  eyebrow: "3:00 AM",
  headline: "When no one else is listening, someone still is.",
  body: "Can't sleep. Don't want to wake anyone. MindMitra is right here — no sleep, no rush, no judgment.",
  chat: [
    { role: "user" as const, text: "Can't sleep. Something feels off." },
    { role: "mitra" as const, text: "I'm here. Tell me — what's on your mind?" },
  ],
};

export const personas = [
  {
    id: "daadi",
    name: "Daadi",
    tagline: "Warm milk and old stories.",
    voice: "Warm, matriarchal — like your grandmother's kitchen.",
    hue: "#C8794F",
  },
  {
    id: "mitra",
    name: "Mitra",
    tagline: "The friend who never tires.",
    voice: "Easy, honest — the friend who lets you ramble.",
    hue: "#8FA68E",
  },
  {
    id: "anaya",
    name: "Anaya",
    tagline: "Big sister — without the lectures.",
    voice: "Elder-sister energy — practical, gentle, never preachy.",
    hue: "#1B3A2B",
  },
  {
    id: "bhaiya",
    name: "Bhaiya",
    tagline: "A little laughter, a little advice.",
    voice: "Elder-brother — dry humor, steady advice.",
    hue: "#9E5A38",
  },
  {
    id: "saadhu",
    name: "Saadhu",
    tagline: "One breath, one step.",
    voice: "Contemplative — breath, silence, small truths.",
    hue: "#5E7A5A",
  },
] as const;

export const personasIntro = {
  eyebrow: "Five Companions",
  headline: "Choose the voice that feels like calm.",
  body: "Every companion has their own voice, pace, and way of being with you.",
};

export const proof = {
  eyebrow: "Heard, not processed",
  headline: "This isn't a chatbot. It's a companion.",
  body: "MindMitra is built with mental health professionals. Every conversation is private; every feeling is safe.",
  statement:
    "Listening at your pace, in your words — no scripts, no scoring, no rush.",
  aside:
    "Every conversation is shaped to reduce cognitive load, using a palette and pace inspired by the world's most enduring print traditions.",
  plate: "Plate No. 04 — First Light, Kept Company",
  imageAlt:
    "Watercolour of an open window at dawn, a clay cup of tea and a sprig of tulsi on the ledge",
};

export const trust = [
  { label: "DPIIT Recognised" },
  { label: "Startup India" },
  { label: "IIT-ISM Dhanbad" },
  { label: "NABH Accredited" },
  { label: "MHRD Innovation Cell" },
];

export const footer = {
  tagline: "Speak your mind, in your own words.",
  cols: [
    {
      title: "Product",
      links: [
        { label: "Companions", href: "#personas" },
        { label: "How it works", href: "#three-am" },
        { label: "Therapist bridge", href: "/therapist-bridge" },
      ],
    },
    {
      title: "Trust",
      links: [
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
        { label: "Sign in", href: "/auth" },
      ],
    },
  ],
  madeWith: "Made with care · in India",
};
