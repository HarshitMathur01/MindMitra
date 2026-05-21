export type PieceTypeKey = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";

export interface PieceLore {
  key: PieceTypeKey;
  glyph: string;
  archetype: string;
  chessName: string;
  tagline: string;
  movement: string;
  ability: string;
  description: string;
  kanji: string;
  stats: { power: number; mobility: number; chaos: number; gpa: number };
  rarity: "Common" | "Uncommon" | "Rare" | "Legendary" | "Mythic";
  habitat: string;
  weakness: string;
  evolution?: string[];
}

export const PIECES: PieceLore[] = [
  {
    key: "king",
    glyph: "CR",
    kanji: "級長",
    chessName: "King",
    archetype: "Class Representative",
    tagline: "Loses the king, loses the semester.",
    movement: "One square in any direction. Slow. Always escorted.",
    ability: "Mass Bunk Declaration — once per game, freezes every enemy Fresher for one turn.",
    description:
      "The face of the batch. Speaks to HODs, forwards every circular, and quietly holds the WhatsApp group together. If they fall, morale collapses.",
    stats: { power: 4, mobility: 2, chaos: 3, gpa: 7 },
    rarity: "Legendary",
    habitat: "HOD's office, group chat at 11:58 PM",
    weakness: "Being asked to 'just take attendance real quick'.",
  },
  {
    key: "queen",
    glyph: "TP",
    kanji: "首席",
    chessName: "Queen",
    archetype: "All-Rounder Topper",
    tagline: "Academics, clubs, hackathons — all by Tuesday.",
    movement: "Any direction, any distance. The most feared piece on the board.",
    ability: "Assignment Drive — may revive one fallen Fresher to the back rank.",
    description:
      "Professors know their name. Seniors slide into their DMs for notes. They sleep four hours and still set the curve.",
    stats: { power: 10, mobility: 10, chaos: 4, gpa: 10 },
    rarity: "Mythic",
    habitat: "Front row, hackathon stage, internship offer letters",
    weakness: "Group projects with non-Toppers.",
  },
  {
    key: "rook",
    glyph: "WD",
    kanji: "舎監",
    chessName: "Rook",
    archetype: "Hostel Warden",
    tagline: "The corridor is mine.",
    movement: "Straight lines across academic blocks and hostel wings.",
    ability: "Curfew Imposed — locks one adjacent square; nothing enters next turn.",
    description:
      "Walks in slippers, hears everything. Has a register older than the building. Discipline is not negotiable after 10 PM.",
    stats: { power: 7, mobility: 7, chaos: 5, gpa: 6 },
    rarity: "Rare",
    habitat: "Corridor at 10:01 PM, gate register, mess complaint book",
    weakness: "Parents calling on speaker.",
  },
  {
    key: "bishop",
    glyph: "PF",
    kanji: "教授",
    chessName: "Bishop",
    archetype: "Professor / Mentor",
    tagline: "Today, a surprise quiz.",
    movement: "Diagonals — through corridors of knowledge.",
    ability: "Surprise Quiz — halves the next move range of any enemy in line of sight.",
    description:
      "Owns the projector remote and your GPA. Quotes a textbook from 1998 and somehow it still applies.",
    stats: { power: 6, mobility: 6, chaos: 7, gpa: 9 },
    rarity: "Rare",
    habitat: "Lecture hall, faculty room, the printer queue",
    weakness: "Projector that refuses to connect.",
  },
  {
    key: "knight",
    glyph: "NO",
    kanji: "夜型",
    chessName: "Knight",
    archetype: "Night Owl / Backbencher",
    tagline: "Built the whole project between 2 and 6 AM.",
    movement: "L-shaped jumps. Leaps over attendance barriers.",
    ability: "Night Mode — gains an extra leap during Internal Exam phase.",
    description:
      "Sleeps through 9 AMs, debugs at midnight. Carries the group project on their back and never logs into the meet.",
    stats: { power: 6, mobility: 8, chaos: 9, gpa: 5 },
    rarity: "Uncommon",
    habitat: "Last bench, terrace at 3 AM, mess maggi counter",
    weakness: "Mandatory 8 AM lab.",
  },
  {
    key: "pawn",
    glyph: "FR",
    kanji: "新入",
    chessName: "Pawn",
    archetype: "Fresher",
    tagline: "Lanyard still on. Eyes wide.",
    movement: "One step forward. Captures diagonally. Two on first move.",
    ability:
      "Evolution — reaches the eighth rank to become Topper, Influencer, Startup Founder, Placement King, or Meme Lord.",
    description:
      "Lost on day one, dangerous by year four. Travels in packs. Will absolutely riot if mess food is cold.",
    stats: { power: 2, mobility: 2, chaos: 6, gpa: 6 },
    rarity: "Common",
    habitat: "Orientation hall, canteen queue, every WhatsApp group",
    weakness: "Seniors saying 'introduce yourself'.",
    evolution: ["Topper", "Influencer", "Startup Founder", "Placement King", "Meme Lord"],
  },
];
