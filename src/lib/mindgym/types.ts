import type { LucideIcon } from "lucide-react";

export interface MindGymTool {
  readonly id: ToolId;
  readonly title: string;
  readonly shortDesc: string;
  readonly clinicalTag: string;
  readonly clinicalBasis: string;
  readonly minutes: number;
  readonly xp: number;
  readonly icon: LucideIcon;
  readonly gradient: readonly [string, string];
}

export const TOOL_IDS = [
  "breath-sphere",
  "thought-trap",
  "emotion-compass",
  "worry-vault",
  "mood-weather",
  "five-senses",
  "inner-critic",
  "gratitude-garden",
  "focus-flow",
] as const;

export type ToolId = (typeof TOOL_IDS)[number];

export interface GameHistoryEntry {
  gameId: ToolId;
  completedAt: string;
  xpEarned: number;
  moodBefore?: number;
  moodAfter?: number;
}

export interface BadgeDefinition {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly requirement: string;
  readonly icon: string;
}

export interface MindGymProgress {
  totalXP: number;
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string;
  completedToday: ToolId[];
  gameHistory: GameHistoryEntry[];
  badges: string[];
}

export const CRISIS_KEYWORDS = [
  "die",
  "kill myself",
  "end it",
  "suicide",
  "self harm",
  "hurt myself",
  "can't go on",
  "want to die",
  "no reason to live",
] as const;
