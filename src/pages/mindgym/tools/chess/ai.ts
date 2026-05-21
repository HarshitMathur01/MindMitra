import { applyMove, legalMoves, type Board, type Color, type GameState } from "./chess";
import type { PieceTypeKey } from "./pieces";

const VALUE: Record<PieceTypeKey, number> = {
  pawn: 100,
  knight: 320,
  bishop: 330,
  rook: 500,
  queen: 900,
  king: 20000,
};

function positional(board: Board): number {
  let s = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const sign = p.color === "w" ? 1 : -1;
      const cd = 3.5 - Math.abs(3.5 - c);
      const rd = 3.5 - Math.abs(3.5 - r);
      s += sign * (cd + rd) * 2;
      if (p.type === "pawn") {
        const adv = p.color === "w" ? 6 - r : r - 1;
        s += sign * adv * 6;
      }
    }
  }
  return s;
}

function evaluate(board: Board): number {
  let s = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      s += (p.color === "w" ? 1 : -1) * VALUE[p.type];
    }
  }
  return s + positional(board);
}

interface MoveSpec { fr: number; fc: number; tr: number; tc: number; }

function allMoves(state: GameState): MoveSpec[] {
  const out: MoveSpec[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color !== state.turn) continue;
      for (const [tr, tc] of legalMoves(state.board, r, c, state.abilities)) {
        out.push({ fr: r, fc: c, tr, tc });
      }
    }
  }
  return out;
}

function negamax(state: GameState, depth: number, alpha: number, beta: number, color: 1 | -1): number {
  if (depth === 0 || state.status === "checkmate" || state.status === "stalemate") {
    if (state.status === "checkmate") {
      return -100000 * color * (state.turn === "w" ? 1 : -1);
    }
    return color * evaluate(state.board);
  }
  const moves = allMoves(state);
  if (moves.length === 0) return color * evaluate(state.board);
  moves.sort((a, b) => {
    const ca = state.board[a.tr][a.tc] ? VALUE[state.board[a.tr][a.tc]!.type] : 0;
    const cb = state.board[b.tr][b.tc] ? VALUE[state.board[b.tr][b.tc]!.type] : 0;
    return cb - ca;
  });
  let best = -Infinity;
  for (const m of moves) {
    const next = applyMove(state, m.fr, m.fc, m.tr, m.tc);
    const score = -negamax(next, depth - 1, -beta, -alpha, -color as 1 | -1);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export type Difficulty = "casual" | "sharp" | "ruthless";

const DEPTH: Record<Difficulty, number> = { casual: 1, sharp: 2, ruthless: 3 };

export function pickAIMove(state: GameState, difficulty: Difficulty = "sharp"): MoveSpec | null {
  const moves = allMoves(state);
  if (moves.length === 0) return null;
  const color: 1 | -1 = state.turn === "w" ? 1 : -1;
  const depth = DEPTH[difficulty];
  let best = -Infinity;
  let bestMoves: MoveSpec[] = [];
  for (const m of moves) {
    const next = applyMove(state, m.fr, m.fc, m.tr, m.tc);
    const score = -negamax(next, depth - 1, -Infinity, Infinity, -color as 1 | -1);
    if (score > best) { best = score; bestMoves = [m]; }
    else if (score === best) bestMoves.push(m);
  }
  if (difficulty === "casual" && Math.random() < 0.25) {
    return moves[Math.floor(Math.random() * moves.length)];
  }
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}
