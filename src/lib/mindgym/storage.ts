import { TOOL_IDS, type MindGymProgress, type ToolId, type GameHistoryEntry } from "./types";
import { BADGES } from "./catalog";
import { getMindGymCounter } from "./analytics";
import { syncMindGymHistoryToSupabase } from "./supabaseSync";

const STORAGE_KEY = "mindmitra_mindgym_progress_v1";
const RECO_KEY = "mindmitra_mindgym_reco_v1";

function today(): string {
  // India-first: MindGym usage is predominantly late-night IST.
  // Use Asia/Kolkata local date to avoid streak breaks around UTC midnight.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getDefault(): MindGymProgress {
  return {
    totalXP: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastCompletedDate: "",
    completedToday: [],
    gameHistory: [],
    badges: [],
  };
}

export function loadProgress(): MindGymProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefault();
    const parsed = JSON.parse(raw) as MindGymProgress;
    if (parsed.lastCompletedDate !== today()) {
      parsed.completedToday = [];
    }
    return parsed;
  } catch {
    return getDefault();
  }
}

export function saveProgress(p: MindGymProgress): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export function recordCompletion(
  toolId: ToolId,
  xp: number,
  moodBefore?: number,
  moodAfter?: number,
): MindGymProgress {
  const p = loadProgress();
  const d = today();

  p.totalXP += xp;

  if (!p.completedToday.includes(toolId)) {
    p.completedToday.push(toolId);
  }

  const entry: GameHistoryEntry = {
    gameId: toolId,
    completedAt: new Date().toISOString(),
    xpEarned: xp,
    moodBefore,
    moodAfter,
  };
  p.gameHistory.push(entry);
  if (p.gameHistory.length > 500) {
    p.gameHistory = p.gameHistory.slice(-500);
  }

  if (p.lastCompletedDate === d) {
    // already counted today
  } else {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().slice(0, 10);
    if (p.lastCompletedDate === yStr) {
      p.currentStreak += 1;
    } else {
      p.currentStreak = 1;
    }
  }
  p.lastCompletedDate = d;
  if (p.currentStreak > p.longestStreak) {
    p.longestStreak = p.currentStreak;
  }

  checkBadges(p, toolId);
  saveProgress(p);
  void syncMindGymHistoryToSupabase();
  return p;
}

function checkBadges(p: MindGymProgress, justCompleted: ToolId): void {
  for (const badge of BADGES) {
    if (p.badges.includes(badge.id)) continue;
    const [kind, countStr] = badge.requirement.split(":");
    const count = Number(countStr);

    if (kind === "streak" && p.currentStreak >= count) {
      p.badges.push(badge.id);
    } else if (kind === "midnight") {
      const hour = new Date().getHours();
      if (hour >= 23 || hour < 4) p.badges.push(badge.id);
    } else if (kind === justCompleted) {
      if (kind === "gratitude-garden") {
        const planted = getMindGymCounter("gratitude_entries");
        if (planted >= count) p.badges.push(badge.id);
      } else {
        const completions = p.gameHistory.filter((e) => e.gameId === kind).length;
        if (completions >= count) p.badges.push(badge.id);
      }
    }
  }
}

export function isCompletedToday(toolId: ToolId): boolean {
  return loadProgress().completedToday.includes(toolId);
}

export function getStreak(toolId: ToolId): number {
  const p = loadProgress();
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const dateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
    const found = p.gameHistory.some(
      (e) => e.gameId === toolId && e.completedAt.startsWith(dateStr),
    );
    if (found) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export function getDailyRecommendation(): ToolId {
  try {
    const raw = localStorage.getItem(RECO_KEY);
    if (raw) {
      const { date, toolId } = JSON.parse(raw);
      if (date === today()) return toolId;
    }
  } catch { /* regenerate */ }

  const idx = Math.abs(hashStr(today())) % TOOL_IDS.length;
  const toolId = TOOL_IDS[idx];
  localStorage.setItem(RECO_KEY, JSON.stringify({ date: today(), toolId }));
  return toolId;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

export function getToolCompletionCount(toolId: ToolId): number {
  return loadProgress().gameHistory.filter((e) => e.gameId === toolId).length;
}
