import type { PlayerState } from "./game";

export interface EventChoice {
  label: string;
  blurb: string;
  attendance?: number;
  cash?: number;
  reputation?: number;
  resultMessage: string;
}

export interface EventCard {
  id: string;
  title: string;
  emoji: string;
  prompt: string;
  choices: [EventChoice, EventChoice];
}

export const EVENTS: EventCard[] = [
  {
    id: "roommate",
    title: "Rumour Mill",
    emoji: "🗣️",
    prompt: "Your roommate forged a medical certificate. The HOD is asking around.",
    choices: [
      { label: "Snitch", blurb: "+8 rep, −15 rep karma", reputation: -7, attendance: 5, resultMessage: "HOD is pleased. Roommate isn't." },
      { label: "Cover up", blurb: "+10 rep, risky", reputation: 10, attendance: -8, resultMessage: "You took the heat. Hostel loves you." },
    ],
  },
  {
    id: "wifi",
    title: "WiFi Heist",
    emoji: "📡",
    prompt: "Someone cracked the staff WiFi password. Join the download spree?",
    choices: [
      { label: "Download all", blurb: "+₹40 (sold movies), −rep if caught", cash: 40, reputation: -5, resultMessage: "External HDD full. Reputation slightly singed." },
      { label: "Walk away", blurb: "Stay clean", reputation: 4, resultMessage: "Boring. Safe. Respected." },
    ],
  },
  {
    id: "festival-pass",
    title: "Counterfeit Pass",
    emoji: "🎟️",
    prompt: "A senior offers a fake pass to the inter-college fest.",
    choices: [
      { label: "Buy it", blurb: "−₹50, +12 rep if it works", cash: -50, reputation: 12, attendance: -5, resultMessage: "You walked in like you owned the place." },
      { label: "Skip it", blurb: "Save the cash", cash: 5, resultMessage: "Productive evening. Watched lectures at 2x." },
    ],
  },
  {
    id: "love-letter",
    title: "Mystery Note",
    emoji: "💌",
    prompt: "Anonymous note in your locker: 'Meet at the canteen at 6.' Go?",
    choices: [
      { label: "Show up", blurb: "+rep, −attendance", reputation: 10, attendance: -10, cash: -30, resultMessage: "It was your project partner. About the deadline." },
      { label: "Ghost it", blurb: "Stay in", attendance: 5, reputation: -3, resultMessage: "Slept early. The campus is talking." },
    ],
  },
  {
    id: "sports-meet",
    title: "Sports Sub Needed",
    emoji: "🏏",
    prompt: "Cricket team is one player short for inter-hostel finals.",
    choices: [
      { label: "Suit up", blurb: "+rep, −attendance", reputation: 12, attendance: -10, cash: 20, resultMessage: "Two sixes and a catch. Legend status." },
      { label: "Pass", blurb: "Catch up on sleep", attendance: 4, reputation: -5, resultMessage: "Hostel boos echo across the quad." },
    ],
  },
];

export function pickEvent(_p: PlayerState): EventCard {
  return EVENTS[Math.floor(Math.random() * EVENTS.length)];
}
