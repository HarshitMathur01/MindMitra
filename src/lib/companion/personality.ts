// MindMitra companion personality: dialogue library + idle scheduler.
//
// Buddy's persistent baseline. The arena moods (smug/sulky) decay back toward
// `calm`; `sleepy` is the deep-idle drift. See buddyBrain.ts MoodMachine.
export type Mood =
  | "cheerful"
  | "calm"
  | "mischief"
  | "supportive"
  | "smug"
  | "sulky"
  | "bored"
  | "sleepy";

export interface Line {
  text: string;
  mood?: Mood;
}

export const GREETINGS = {
  firstLaunch: [
    "Hi! I'm your MindMitra buddy.",
    "I was waiting here…",
    "…okay maybe I was napping.",
  ],
  recent: ["Oh! You're back!", "I kept everything safe.", "Mostly."],
  days: ["There you are!", "I thought you got distracted.", "I got distracted too."],
  weeks: ["Welcome back.", "I saved your spot.", "And collected three cool rocks."],
};

export const CELEBRATE_SMALL = [
  "You did it!",
  "That deserves a happy pebble.",
  "Look at us being productive.",
  "Mostly you.",
];

export const CELEBRATE_BIG = [
  "This is amazing!",
  "I tried counting your streak.",
  "I ran out of fingers.",
];

export const JOURNAL_BEFORE = [
  "Need somewhere to put your thoughts?",
  "I brought a notebook.",
  "Okay, technically it's yours.",
];

export const JOURNAL_AFTER = [
  "Those thoughts look lighter already.",
  "Thank you for sharing them.",
  "I'll guard them.",
];

export const BREATHE_BEFORE = ["Let's slow things down.", "I'll breathe with you."];
export const BREATHE_AFTER = ["That felt nice.", "My brain stopped running laps."];

export const SUPPORT = [
  "I'm here.",
  "We don't have to solve everything today.",
  "Small steps count.",
  "We can just sit for a minute.",
];

export const MISCHIEF = [
  "I was helping.",
  "Then I found a shiny thing.",
  "Sorry.",
  "Did you see that pebble? It winked.",
  "I named the cursor. Her name is Doris.",
  "Pssst… your rook looks lonely.",
  "I peeked. Just a little.",
  "Don't tell the King I moved.",
  "Tiptoe tiptoe… nothing to see.",
  "Boop.",
];

export const SMUG = [
  "Got 'em.",
  "Attendance: minus one.",
  "Heh. Caught slipping.",
  "That's gonna leave a mark.",
];

export const BORED = [
  "Your move, genius.",
  "I aged. Visibly.",
  "Is the board frozen, or are you?",
  "I started a small nap. Wake me.",
];

export const TICKLE = [
  "Hehe — stop that!",
  "Oi! Ticklish!",
  "Boop received.",
  "Okay okay, I'm awake.",
];

export const IDLE_THOUGHTS = [
  "…what does the inside of a cloud taste like?",
  "I think the moon is just a really shy pebble.",
  "If I hold my breath, can I float?",
  "I'm not lost. The map is.",
  "I forgot what I was doing.",
  "Hello, button. You look very clickable today.",
  "Is it nap o'clock yet?",
  "I tried to befriend a bug. He left.",
];

// ---- Tic-Tac-Toe buddy banter ----
export const TTT_GREET = [
  "X or O — let's settle this.",
  "I'm O. You're X. Best of luck.",
  "Three in a row. How hard can it be?",
  "New board, fresh humiliation. For one of us.",
  "I dreamt about this grid. We were friends.",
  "Loser refills the snacks. I have no hands, so… you.",
];
export const TTT_PLAYER_MOVE = [
  "Bold.",
  "Hmm, interesting.",
  "Okay, I see your plan.",
  "Noted.",
  "Brave. Or random. Hard to tell.",
  "Ooh, a strategy. Allegedly.",
  "I'll allow it.",
  "Writing that down in my tiny brain.",
];
export const TTT_THINK = [
  "Let me think…",
  "Calculating…",
  "Plotting my comeback.",
  "Where to, where to…",
  "Consulting the ancient pebbles…",
  "Math is happening. Please hold.",
  "Hmmmmmmm.",
];
export const TTT_BUDDY_MOVE = [
  "There.",
  "Take that.",
  "My move.",
  "Boop. Done.",
  "Tactical.",
  "You'll understand this one later.",
  "Don't overthink it. I didn't.",
];
export const TTT_BUDDY_WIN = [
  "Three in a row — I win!",
  "GG! O dominates.",
  "Did you SEE that line?!",
  "And THAT is why I'm O. O for Outstanding.",
  "Victory tastes like blueberries. [clap]",
  "I'd like to thank the center square.",
];
export const TTT_PLAYER_WIN = [
  "Aw, you got me.",
  "Rematch! I demand a rematch.",
  "Fine, fine — well played.",
  "I let you win. Obviously. [lookaway]",
  "Okay that was actually good. Don't tell anyone I said that.",
  "My pebbles have betrayed me.",
];
export const TTT_DRAW = [
  "A tie. We're evenly matched.",
  "Nobody wins. Everybody snacks.",
  "Stalemate! Cat's game.",
  "A draw. The most diplomatic outcome.",
  "We're basically the same person now.",
];

// Board-aware banter (gated by MoveAnalysis in buddyBrain).
export const TTT_IMPRESSED = [
  "Wait. A fork? Okay, who taught you that. [browraise]",
  "Two threats at once? Rude. Effective, but rude.",
  "…I did not see that coming. Respect.",
  "Okay genuinely clever. I'm a little jealous.",
];
export const TTT_NERVOUS = [
  "That's… fine. Everything's fine. [lookaway]",
  "Uh. Hold on. Let me recount the squares.",
  "You're not winning. You're just… ahead. Temporarily.",
  "Don't get cocky. I'm being strategic. Sweating, but strategic.",
];
export const TTT_GLOAT = [
  "Two ways to win and you can only block one. [smirk]",
  "I'd start panicking around now if I were you.",
  "Heh. The trap is sprung.",
  "You walked right into that one. Bless.",
];
export const TTT_GRUMBLE = [
  "Fine. Block it. See if I care. [doubt]",
  "Rude. I had plans for that square.",
  "Ugh, you saw that one.",
  "Okay, defense. Cute.",
];
export const TTT_CENTER = [
  "Center square. A classic. A bit predictable. [smirk]",
  "Ah, the power seat. Bold opening.",
  "Everyone grabs the middle. Sheep, all of you.",
];
export const TTT_BLOCK = [
  "Not today. [shake]",
  "Blocked. You're welcome.",
  "I saw that coming a mile off.",
  "Denied. Politely.",
];
export const TTT_SLEEPY = [
  "Five more minutes…",
  "Wake me when it's my turn… zzz",
  "I'm just… resting my eyes…",
  "The board is so… cozy…",
];

/** Pick line(s) at random from a pool. */
export function pickLine(pool: readonly string[]): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Choose a greeting based on last-seen timestamp. */
export function chooseGreeting(lastSeenMs: number | null): string[] {
  if (lastSeenMs == null) return GREETINGS.firstLaunch;
  const delta = Date.now() - lastSeenMs;
  const hr = 1000 * 60 * 60;
  if (delta < 6 * hr) return GREETINGS.recent;
  if (delta < 3 * 24 * hr) return GREETINGS.recent;
  if (delta < 7 * 24 * hr) return GREETINGS.days;
  return GREETINGS.weeks;
}

/** Random idle behaviors keyed to the procedural animation names. */
export const IDLE_BEHAVIORS: { action: string; line?: string; weight: number }[] = [
  { action: "Look around", weight: 4 },
  { action: "Idle variation", weight: 3 },
  { action: "Nod yes", line: "Mhm.", weight: 1 },
  { action: "Shake no", line: "Nope. Not today.", weight: 1 },
  { action: "Shrug", line: "Eh, who knows.", weight: 2 },
  { action: "Bounce", line: "I have so much energy today!", weight: 1 },
  { action: "Wave", line: "Hi again!", weight: 1 },
];

export function pickIdleBehavior() {
  const total = IDLE_BEHAVIORS.reduce((s, b) => s + b.weight, 0);
  let r = Math.random() * total;
  for (const b of IDLE_BEHAVIORS) {
    r -= b.weight;
    if (r <= 0) return b;
  }
  return IDLE_BEHAVIORS[0];
}

/**
 * Remembers the last `size` lines/gestures handed out so Buddy never repeats
 * himself back-to-back (the #1 tell that a character is canned). `pick` retries
 * a few times to dodge recents, then accepts a repeat rather than loop forever.
 */
export function createRecentTracker(size = 6) {
  const recent: string[] = [];
  function seen(s: string) {
    recent.push(s);
    while (recent.length > size) recent.shift();
  }
  function pick(pool: readonly string[]): string {
    if (pool.length === 0) return "";
    let choice = pool[Math.floor(Math.random() * pool.length)];
    for (let tries = 0; tries < 5 && recent.includes(choice); tries++) {
      choice = pool[Math.floor(Math.random() * pool.length)];
    }
    seen(choice);
    return choice;
  }
  return { pick, seen, has: (s: string) => recent.includes(s) };
}
export type RecentTracker = ReturnType<typeof createRecentTracker>;

/** Context label → the line bank the stub draws from for that beat. */
export const LINE_POOLS = {
  greetFirst: GREETINGS.firstLaunch,
  greetRecent: GREETINGS.recent,
  greetDays: GREETINGS.days,
  greetWeeks: GREETINGS.weeks,
  // Activity-agnostic banks — shared by any buddy-powered tool, not just TTT.
  celebrateSmall: CELEBRATE_SMALL,
  celebrateBig: CELEBRATE_BIG,
  support: SUPPORT,
  breatheBefore: BREATHE_BEFORE,
  breatheAfter: BREATHE_AFTER,
  journalBefore: JOURNAL_BEFORE,
  journalAfter: JOURNAL_AFTER,
  tttGreet: TTT_GREET,
  playerMove: TTT_PLAYER_MOVE,
  thinking: TTT_THINK,
  buddyMove: TTT_BUDDY_MOVE,
  buddyWin: TTT_BUDDY_WIN,
  playerWin: TTT_PLAYER_WIN,
  draw: TTT_DRAW,
  impressed: TTT_IMPRESSED,
  nervous: TTT_NERVOUS,
  gloat: TTT_GLOAT,
  grumble: TTT_GRUMBLE,
  center: TTT_CENTER,
  block: TTT_BLOCK,
  sleepyTTT: TTT_SLEEPY,
  idleThought: IDLE_THOUGHTS,
  bored: BORED,
  tickle: TICKLE,
  mischief: MISCHIEF,
  smug: SMUG,
};
export type LinePoolName = keyof typeof LINE_POOLS;
