// Tic-Tac-Toe game logic + an optimal (minimax) AI.
// Immutable: every helper takes a board and returns new data — never mutates.

export type Player = "X" | "O";
export type Cell = Player | null;
export type Board = Cell[]; // length 9, row-major (index 0..8)

export type Difficulty = "chill" | "sharp";

export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8], // rows
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8], // columns
  [0, 4, 8],
  [2, 4, 6], // diagonals
];

export function emptyBoard(): Board {
  return Array<Cell>(9).fill(null);
}

export interface WinResult {
  player: Player;
  line: readonly [number, number, number];
}

export function winner(board: Board): WinResult | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    const v = board[a];
    if (v && v === board[b] && v === board[c]) return { player: v, line };
  }
  return null;
}

export function isDraw(board: Board): boolean {
  return board.every((c) => c !== null) && !winner(board);
}

export function available(board: Board): number[] {
  const out: number[] = [];
  for (let i = 0; i < 9; i++) if (board[i] === null) out.push(i);
  return out;
}

export function other(p: Player): Player {
  return p === "X" ? "O" : "X";
}

// Score of `board` from `ai`'s perspective with `toMove` to play (optimal play).
function minimax(board: Board, toMove: Player, ai: Player): number {
  const w = winner(board);
  if (w) return w.player === ai ? 1 : -1;
  if (isDraw(board)) return 0;
  const scores = available(board).map((i) => {
    const next = board.slice();
    next[i] = toMove;
    return minimax(next, other(toMove), ai);
  });
  return toMove === ai ? Math.max(...scores) : Math.min(...scores);
}

// Best cell for `ai` to play. Returns a cell index, or -1 if the board is full.
export function bestMove(board: Board, ai: Player): number {
  let best = -Infinity;
  let move = -1;
  for (const i of available(board)) {
    const next = board.slice();
    next[i] = ai;
    const score = minimax(next, other(ai), ai);
    if (score > best) {
      best = score;
      move = i;
    }
  }
  return move;
}

// ---- Board awareness (drives the buddy's in-character reactions) -----------

/** Empty cells that would immediately complete a line for `player`. */
export function winningCells(board: Board, player: Player): number[] {
  const out = new Set<number>();
  for (const [a, b, c] of LINES) {
    const cells = [a, b, c] as const;
    const mine = cells.filter((i) => board[i] === player).length;
    const empties = cells.filter((i) => board[i] === null);
    if (mine === 2 && empties.length === 1) out.add(empties[0]);
  }
  return [...out];
}

export interface MoveAnalysis {
  /** The cell that changed between prev → next. */
  cell: number;
  player: Player;
  tookCenter: boolean;
  tookCorner: boolean;
  /** The move occupied a cell where the opponent was one away from winning. */
  blockedOpponent: boolean;
  /** After the move the mover has ≥2 immediate wins (an unblockable fork). */
  createdFork: boolean;
  /** The move opened at least one new immediate-win cell for the mover. */
  createsThreat: boolean;
  /** After the move the opponent has an immediate win (the mover left a hole). */
  givesOpponentWin: boolean;
}

/**
 * Diff two boards and describe what the move *meant* tactically, from `player`'s
 * side. Pure + cheap (9 cells). Returns null if no single cell changed.
 */
export function analyzeMove(prev: Board, next: Board, player: Player): MoveAnalysis | null {
  let cell = -1;
  for (let i = 0; i < 9; i++) {
    if (prev[i] !== next[i]) {
      cell = i;
      break;
    }
  }
  if (cell < 0) return null;
  const opp = other(player);
  const oppThreatsPrev = winningCells(prev, opp);
  const myWinsBefore = winningCells(prev, player).length;
  const myWinsAfter = winningCells(next, player);
  const oppWinsAfter = winningCells(next, opp);
  return {
    cell,
    player,
    tookCenter: cell === 4,
    tookCorner: cell === 0 || cell === 2 || cell === 6 || cell === 8,
    blockedOpponent: oppThreatsPrev.includes(cell),
    createdFork: myWinsAfter.length >= 2,
    createsThreat: myWinsAfter.length > myWinsBefore,
    givesOpponentWin: oppWinsAfter.length > 0 && winner(next) === null,
  };
}

// Pick the AI's move. "sharp" is unbeatable; "chill" plays randomly ~55% of the
// time so a human can actually win (and see the buddy's lose reaction).
export function pickMove(board: Board, ai: Player, difficulty: Difficulty): number {
  const moves = available(board);
  if (moves.length === 0) return -1;
  if (difficulty === "chill" && Math.random() < 0.55) {
    return moves[Math.floor(Math.random() * moves.length)];
  }
  return bestMove(board, ai);
}
