export type ArchetypeId = "topper" | "back" | "fest" | "canteen";
export type Stance = "study" | "bunk" | "hustle";
export type MinigameKind = "proxy" | "canteen" | "exam" | "fest" | "raid";

export interface Archetype {
  id: ArchetypeId;
  name: string;
  tagline: string;
  perk: string;
  tokenVar: string;
}

export const ARCHETYPES: Archetype[] = [
  { id: "topper",  name: "The Topper",       tagline: "Notes are currency.",     perk: "+10% Attendance on Library tiles", tokenVar: "--token-topper" },
  { id: "back",    name: "The Backbencher",  tagline: "Bunks like an art form.", perk: "Immune to Surprise Test tile",     tokenVar: "--token-back" },
  { id: "fest",    name: "The Fest Star",    tagline: "Mic in hand, plan in head.", perk: "+₹50 on Festival tile",        tokenVar: "--token-fest" },
  { id: "canteen", name: "The Canteen King", tagline: "Chai diplomacy expert.",  perk: "Free chai = +5 Reputation",        tokenVar: "--token-canteen" },
];

export type TileKind =
  | "start" | "hostel" | "lecture" | "library" | "canteen"
  | "festival" | "exam" | "placement" | "surprise" | "chill";

export interface Tile {
  kind: TileKind;
  label: string;
  emoji: string;
}

export const BOARD: Tile[] = [
  { kind: "start",     label: "Hostel Gate",   emoji: "🏠" },
  { kind: "lecture",   label: "9 AM Lecture",  emoji: "📚" },
  { kind: "canteen",   label: "Chai Break",    emoji: "🍵" },
  { kind: "library",   label: "Library",       emoji: "📖" },
  { kind: "chill",     label: "Quad Adda",     emoji: "🌳" },
  { kind: "surprise",  label: "Surprise Test", emoji: "❗" },
  { kind: "festival",  label: "Fest Stage",    emoji: "🎤" },
  { kind: "lecture",   label: "Lab Hours",     emoji: "🧪" },
  { kind: "start",     label: "Boys' Hostel",  emoji: "🏠" },
  { kind: "canteen",   label: "Maggi Point",   emoji: "🍜" },
  { kind: "library",   label: "Group Study",   emoji: "📖" },
  { kind: "lecture",   label: "Attendance!",   emoji: "✍️" },
  { kind: "festival",  label: "Open Mic",      emoji: "🎸" },
  { kind: "exam",      label: "Mid-Sem",       emoji: "📝" },
  { kind: "chill",     label: "Rooftop",       emoji: "🌙" },
  { kind: "placement", label: "Career Cell",   emoji: "💼" },
  { kind: "start",     label: "Cultural Hall", emoji: "🏠" },
  { kind: "canteen",   label: "Samosa Stall",  emoji: "🥟" },
  { kind: "lecture",   label: "Pop Quiz",      emoji: "❓" },
  { kind: "festival",  label: "Annual Fest",   emoji: "🎉" },
  { kind: "library",   label: "Silent Floor",  emoji: "🤫" },
  { kind: "surprise",  label: "Rumour Mill",   emoji: "🗣️" },
  { kind: "chill",     label: "Cricket Ground",emoji: "🏏" },
  { kind: "exam",      label: "Viva Voce",     emoji: "🎓" },
  { kind: "start",     label: "Canteen HQ",    emoji: "🏠" },
  { kind: "lecture",   label: "Tutorial",      emoji: "📐" },
  { kind: "festival",  label: "DJ Night",      emoji: "🎧" },
  { kind: "library",   label: "Reference",     emoji: "📚" },
  { kind: "placement", label: "Mock Interview",emoji: "🤝" },
  { kind: "canteen",   label: "Late Night Tea",emoji: "🫖" },
  { kind: "surprise",  label: "Hostel Raid",   emoji: "🚨" },
  { kind: "chill",     label: "Movie Night",   emoji: "🎬" },
];

export const START_INDEX: Record<ArchetypeId, number> = {
  topper: 0, back: 8, fest: 16, canteen: 24,
};

export interface PlayerState {
  id: ArchetypeId;
  position: number;
  distance: number;
  attendance: number;
  cash: number;
  reputation: number;
  alive: boolean;
}

export function initPlayer(id: ArchetypeId): PlayerState {
  return {
    id,
    position: START_INDEX[id],
    distance: 0,
    attendance: 75,
    cash: 100,
    reputation: 50,
    alive: true,
  };
}

export interface TileEffect {
  message: string;
  attendance?: number;
  cash?: number;
  reputation?: number;
  triggersMinigame?: MinigameKind;
  triggersEvent?: boolean;
}

export function resolveTile(player: PlayerState, tile: Tile, stance: Stance): TileEffect {
  switch (tile.kind) {
    case "lecture":
      if (stance === "bunk") {
        return { message: `${tile.label}: bunked it. −5 attendance, −4 reputation.`, attendance: -5, reputation: -4 };
      }
      return { message: `${tile.label}: proxy mini-game incoming.`, triggersMinigame: "proxy" };
    case "library": {
      const base = player.id === "topper" ? 10 : 6;
      const bonus = stance === "study" ? 4 : stance === "bunk" ? -2 : 0;
      return { message: `Studied at ${tile.label}.`, attendance: base + bonus };
    }
    case "canteen":
      return { message: `${tile.label}: haggle for the best deal.`, triggersMinigame: "canteen" };
    case "festival":
      return { message: `${tile.label}: take the stage!`, triggersMinigame: "fest" };
    case "exam":
      return { message: `${tile.label}: cram session!`, triggersMinigame: "exam" };
    case "placement": {
      const stanceBonus = stance === "hustle" ? 25 : 0;
      const cash = 40 + Math.floor(player.reputation / 4) + stanceBonus;
      return { message: `${tile.label}: hustled a stipend. +₹${cash}.`, cash };
    }
    case "surprise":
      if (tile.label === "Hostel Raid") {
        return { message: `${tile.label}: warden incoming — hide!`, triggersMinigame: "raid" };
      }
      if (player.id === "back" && tile.label === "Surprise Test") {
        return { message: `Backbencher reflex: dodged ${tile.label}. No damage.` };
      }
      return { message: `${tile.label}: a dilemma appears…`, triggersEvent: true };
    case "chill": {
      const att = stance === "hustle" ? -10 : -5;
      return { message: `${tile.label}: vibes only.`, attendance: att, reputation: 5 };
    }
    case "hostel":
    case "start":
      return { message: `${tile.label}: safe square. Rest up. +5 attendance.`, attendance: 5 };
  }
}

export function applyEffect(p: PlayerState, e: { attendance?: number; cash?: number; reputation?: number }): PlayerState {
  const next: PlayerState = {
    ...p,
    attendance: clamp(p.attendance + (e.attendance ?? 0), 0, 100),
    cash: Math.max(0, p.cash + (e.cash ?? 0)),
    reputation: clamp(p.reputation + (e.reputation ?? 0), 0, 100),
  };
  next.alive = next.attendance > 0;
  return next;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function move(p: PlayerState, steps: number): PlayerState {
  return {
    ...p,
    position: (p.position + steps) % BOARD.length,
    distance: p.distance + steps,
  };
}

export function hasWon(p: PlayerState): boolean {
  return p.distance >= BOARD.length;
}

// CPU success rates per minigame, archetype-tuned
export function cpuSuccessRate(arc: ArchetypeId, kind: MinigameKind): number {
  const base: Record<MinigameKind, number> = {
    proxy: 0.6, canteen: 0.55, exam: 0.5, fest: 0.55, raid: 0.5,
  };
  const boosts: Partial<Record<ArchetypeId, Partial<Record<MinigameKind, number>>>> = {
    topper:  { exam: 0.25, proxy: 0.1 },
    back:    { raid: 0.25, proxy: 0.15 },
    fest:    { fest: 0.3 },
    canteen: { canteen: 0.3 },
  };
  return Math.min(0.95, base[kind] + (boosts[arc]?.[kind] ?? 0));
}

// Pick a CPU stance weighted toward archetype tendencies
export function cpuStance(arc: ArchetypeId): Stance {
  const weights: Record<ArchetypeId, [number, number, number]> = {
    // [study, bunk, hustle]
    topper:  [0.6, 0.1, 0.3],
    back:    [0.15, 0.55, 0.3],
    fest:    [0.2, 0.3, 0.5],
    canteen: [0.25, 0.25, 0.5],
  };
  const r = Math.random();
  const [s, b] = weights[arc];
  if (r < s) return "study";
  if (r < s + b) return "bunk";
  return "hustle";
}
