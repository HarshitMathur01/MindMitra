import { WHISPERS, type Whisper } from "@/data/whisperWall";
import type { SupportedLanguage } from "@/lib/locale";

const THEMED_CAP = 3;
const RANDOM_CAP = 2;

/**
 * Build the whisper rotation.
 *
 * `dominantThemes` is the user's top recurring themes from /me/snapshot — we
 * use them to *rank* the pool, never to label anything on screen. The cap
 * (3 themed + 2 random) keeps the wall from pigeonholing a user who has just
 * had one rough week of, say, sleep problems.
 *
 * `lowAffect` narrows the pool to whispers cleared for a heavy day. Callers
 * are additionally expected to hide the surface outright during a crisis
 * cooldown (`ambience.crisisQuiet`) — peer voices land wrong in that window.
 *
 * Lifted out of the old WhisperWall component so the Night River Practice
 * section can reuse it unchanged.
 */
export function filterWhispers(
  language: SupportedLanguage,
  lowAffect: boolean,
  dominantThemes: string[],
): Whisper[] {
  // Prefer same-language quotes, fall back to English if none.
  const sameLang = WHISPERS.filter((w) => w.language === language);
  const pool = sameLang.length > 0 ? sameLang : WHISPERS.filter((w) => w.language === "english");
  const safe = lowAffect ? pool.filter((w) => w.lowAffectSafe) : pool;
  if (safe.length === 0) return [];

  if (dominantThemes.length === 0) return safe;

  const themeSet = new Set(dominantThemes);
  const themed = safe.filter((w) => w.themes.some((t) => themeSet.has(t)));
  if (themed.length === 0) return safe;

  const themedPicked = themed.slice(0, THEMED_CAP);
  const themedIds = new Set(themedPicked.map((w) => w.id));
  const randomPool = safe.filter((w) => !themedIds.has(w.id));
  return [...themedPicked, ...randomPool.slice(0, RANDOM_CAP)];
}
