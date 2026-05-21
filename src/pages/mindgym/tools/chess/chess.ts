import type { PieceTypeKey } from "./pieces";

export type Color = "w" | "b";
export interface Piece {
  type: PieceTypeKey;
  color: Color;
}
export type Square = Piece | null;
export type Board = Square[][]; // [row 0=top=black back rank][col 0..7]

export interface Move {
  fr: number; fc: number; tr: number; tc: number;
  captured?: Piece;
  promotion?: PieceTypeKey;
}

export type AbilityKey = "king" | "queen" | "rook" | "bishop" | "knight";

export type ActiveEffect =
  | { kind: "pawnFreeze"; color: Color; expiresAtTick: number; castBy: Color }
  | { kind: "squareFreeze"; r: number; c: number; expiresAtTick: number; castBy: Color }
  | { kind: "lock"; r: number; c: number; expiresAtTick: number; castBy: Color };

export interface AbilityState {
  used: { w: Partial<Record<AbilityKey, boolean>>; b: Partial<Record<AbilityKey, boolean>> };
  effects: ActiveEffect[];
  tick: number;
  extraMoveFor: Color | null;
  log: { tick: number; color: Color; ability: AbilityKey; note: string }[];
}

export interface GameState {
  board: Board;
  turn: Color;
  history: Move[];
  status: "playing" | "check" | "checkmate" | "stalemate";
  abilities: AbilityState;
}

const back: PieceTypeKey[] = ["rook","knight","bishop","queen","king","bishop","knight","rook"];

export function initialBoard(): Board {
  const b: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let c = 0; c < 8; c++) {
    b[0][c] = { type: back[c], color: "b" };
    b[1][c] = { type: "pawn", color: "b" };
    b[6][c] = { type: "pawn", color: "w" };
    b[7][c] = { type: back[c], color: "w" };
  }
  return b;
}

export function initialState(): GameState {
  return {
    board: initialBoard(),
    turn: "w",
    history: [],
    status: "playing",
    abilities: { used: { w: {}, b: {} }, effects: [], tick: 0, extraMoveFor: null, log: [] },
  };
}

const inBounds = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

function rayMoves(board: Board, r: number, c: number, color: Color, dirs: [number, number][]) {
  const out: [number, number][] = [];
  for (const [dr, dc] of dirs) {
    let nr = r + dr, nc = c + dc;
    while (inBounds(nr, nc)) {
      const sq = board[nr][nc];
      if (!sq) out.push([nr, nc]);
      else { if (sq.color !== color) out.push([nr, nc]); break; }
      nr += dr; nc += dc;
    }
  }
  return out;
}

export function pseudoMoves(board: Board, r: number, c: number): [number, number][] {
  const p = board[r][c]; if (!p) return [];
  const out: [number, number][] = [];
  const enemy = p.color === "w" ? "b" : "w";
  if (p.type === "pawn") {
    const dir = p.color === "w" ? -1 : 1;
    const start = p.color === "w" ? 6 : 1;
    if (inBounds(r + dir, c) && !board[r + dir][c]) {
      out.push([r + dir, c]);
      if (r === start && !board[r + 2 * dir][c]) out.push([r + 2 * dir, c]);
    }
    for (const dc of [-1, 1]) {
      const nr = r + dir, nc = c + dc;
      if (inBounds(nr, nc) && board[nr][nc]?.color === enemy) out.push([nr, nc]);
    }
  } else if (p.type === "knight") {
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]] as [number,number][]) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc) && board[nr][nc]?.color !== p.color) out.push([nr, nc]);
    }
  } else if (p.type === "bishop") {
    out.push(...rayMoves(board, r, c, p.color, [[-1,-1],[-1,1],[1,-1],[1,1]]));
  } else if (p.type === "rook") {
    out.push(...rayMoves(board, r, c, p.color, [[-1,0],[1,0],[0,-1],[0,1]]));
  } else if (p.type === "queen") {
    out.push(...rayMoves(board, r, c, p.color, [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]));
  } else if (p.type === "king") {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc) && board[nr][nc]?.color !== p.color) out.push([nr, nc]);
    }
  }
  return out;
}

function findKing(board: Board, color: Color): [number, number] | null {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c]; if (p && p.type === "king" && p.color === color) return [r, c];
  }
  return null;
}

export function isAttacked(board: Board, r: number, c: number, by: Color): boolean {
  for (let rr = 0; rr < 8; rr++) for (let cc = 0; cc < 8; cc++) {
    const p = board[rr][cc];
    if (!p || p.color !== by) continue;
    const m = pseudoMoves(board, rr, cc);
    if (m.some(([tr, tc]) => tr === r && tc === c)) return true;
  }
  return false;
}

function cloneBoard(b: Board): Board { return b.map(row => row.slice()); }

function isPawnFrozen(a: AbilityState | undefined, color: Color) {
  if (!a) return false;
  return a.effects.some(e => e.kind === "pawnFreeze" && e.color === color && e.expiresAtTick > a.tick);
}
function isSquareFrozen(a: AbilityState | undefined, r: number, c: number) {
  if (!a) return false;
  return a.effects.some(e => e.kind === "squareFreeze" && e.r === r && e.c === c && e.expiresAtTick > a.tick);
}
function isLocked(a: AbilityState | undefined, r: number, c: number) {
  if (!a) return false;
  return a.effects.some(e => e.kind === "lock" && e.r === r && e.c === c && e.expiresAtTick > a.tick);
}

export function legalMoves(board: Board, r: number, c: number, abilities?: AbilityState): [number, number][] {
  const p = board[r][c]; if (!p) return [];
  if (abilities) {
    if (abilities.extraMoveFor === p.color && p.type !== "knight") return [];
    if (p.type === "pawn" && isPawnFrozen(abilities, p.color)) return [];
    if (isSquareFrozen(abilities, r, c)) return [];
  }
  let moves = pseudoMoves(board, r, c);
  if (abilities) moves = moves.filter(([tr, tc]) => !isLocked(abilities, tr, tc));
  return moves.filter(([tr, tc]) => {
    const nb = cloneBoard(board);
    nb[tr][tc] = nb[r][c];
    nb[r][c] = null;
    if (p.type === "pawn" && (tr === 0 || tr === 7)) nb[tr][tc] = { type: "queen", color: p.color };
    const k = findKing(nb, p.color);
    if (!k) return false;
    return !isAttacked(nb, k[0], k[1], p.color === "w" ? "b" : "w");
  });
}

export function applyMove(state: GameState, fr: number, fc: number, tr: number, tc: number): GameState {
  const piece = state.board[fr][fc];
  if (!piece || piece.color !== state.turn) return state;
  const legals = legalMoves(state.board, fr, fc, state.abilities);
  if (!legals.some(([r, c]) => r === tr && c === tc)) return state;
  const board = cloneBoard(state.board);
  const captured = board[tr][tc] ?? undefined;
  board[tr][tc] = piece;
  board[fr][fc] = null;
  let promotion: PieceTypeKey | undefined;
  if (piece.type === "pawn" && (tr === 0 || tr === 7)) {
    board[tr][tc] = { type: "queen", color: piece.color };
    promotion = "queen";
  }
  const abilities: AbilityState = cloneAbilities(state.abilities);
  const isExtra = abilities.extraMoveFor === state.turn && piece.type === "knight";
  let nextTurn: Color = state.turn;
  if (isExtra) {
    abilities.extraMoveFor = null;
    abilities.log = [...abilities.log, { tick: abilities.tick, color: state.turn, ability: "knight", note: "Night Mode · bonus move" }];
  } else {
    if (abilities.extraMoveFor === state.turn) abilities.extraMoveFor = null;
    abilities.tick += 1;
    abilities.effects = abilities.effects.filter(e => e.expiresAtTick > abilities.tick);
    nextTurn = state.turn === "w" ? "b" : "w";
  }
  const status = computeStatus(board, nextTurn, abilities);
  return {
    board,
    turn: nextTurn,
    history: [...state.history, { fr, fc, tr, tc, captured: captured ?? undefined, promotion }],
    abilities,
    status,
  };
}

export function computeStatus(board: Board, turn: Color, abilities?: AbilityState): GameState["status"] {
  let anyMove = false;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c];
    if (p && p.color === turn && legalMoves(board, r, c, abilities).length > 0) { anyMove = true; break; }
  }
  const k = findKing(board, turn);
  const inCheck = k ? isAttacked(board, k[0], k[1], turn === "w" ? "b" : "w") : false;
  if (!anyMove) return inCheck ? "checkmate" : "stalemate";
  return inCheck ? "check" : "playing";
}

function cloneAbilities(a: AbilityState): AbilityState {
  return {
    used: { w: { ...a.used.w }, b: { ...a.used.b } },
    effects: a.effects.slice(),
    tick: a.tick,
    extraMoveFor: a.extraMoveFor,
    log: a.log.slice(),
  };
}

function hasAlive(board: Board, color: Color, type: PieceTypeKey): boolean {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c];
    if (p && p.color === color && p.type === type) return true;
  }
  return false;
}

export function abilityTargets(state: GameState, color: Color, a: AbilityKey): [number, number][] {
  const out: [number, number][] = [];
  if (a === "queen") {
    const backRank = color === "w" ? 7 : 0;
    for (let c = 0; c < 8; c++) if (!state.board[backRank][c]) out.push([backRank, c]);
    return out;
  }
  if (a === "rook") {
    const seen = new Set<string>();
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color !== color || p.type !== "rook") continue;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = r + dr, nc = c + dc;
        if (!inBounds(nr, nc) || state.board[nr][nc]) continue;
        const k = nr + "," + nc;
        if (!seen.has(k)) { seen.add(k); out.push([nr, nc]); }
      }
    }
    return out;
  }
  if (a === "bishop") {
    const enemy: Color = color === "w" ? "b" : "w";
    const seen = new Set<string>();
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color !== color || p.type !== "bishop") continue;
      for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]] as [number, number][]) {
        let nr = r + dr, nc = c + dc;
        while (inBounds(nr, nc)) {
          const sq = state.board[nr][nc];
          if (sq) {
            if (sq.color === enemy && sq.type !== "king") {
              const k = nr + "," + nc;
              if (!seen.has(k)) { seen.add(k); out.push([nr, nc]); }
            }
            break;
          }
          nr += dr; nc += dc;
        }
      }
    }
    return out;
  }
  return out;
}

export function canCast(state: GameState, color: Color, a: AbilityKey): boolean {
  if (state.abilities.used[color][a]) return false;
  if (state.turn !== color) return false;
  if (state.status === "checkmate" || state.status === "stalemate") return false;
  if (state.abilities.extraMoveFor === color) return false;
  if (!hasAlive(state.board, color, a)) return false;
  if (a === "queen") {
    const hasCapturedPawn = state.history.some(m => m.captured?.color === color && m.captured.type === "pawn");
    if (!hasCapturedPawn) return false;
  }
  if (a === "queen" || a === "rook" || a === "bishop") {
    if (abilityTargets(state, color, a).length === 0) return false;
  }
  return true;
}

export type CastPayload =
  | { ability: "king" }
  | { ability: "queen"; r: number; c: number }
  | { ability: "rook"; r: number; c: number }
  | { ability: "bishop"; r: number; c: number }
  | { ability: "knight" };

export function castAbility(state: GameState, payload: CastPayload): GameState {
  const color = state.turn;
  if (!canCast(state, color, payload.ability)) return state;
  const abilities = cloneAbilities(state.abilities);
  abilities.used[color][payload.ability] = true;
  const enemy: Color = color === "w" ? "b" : "w";
  let board = state.board;
  let consumesTurn = true;
  let note = "";

  if (payload.ability === "king") {
    abilities.effects.push({ kind: "pawnFreeze", color: enemy, expiresAtTick: abilities.tick + 2, castBy: color });
    note = "Mass Bunk · enemy Freshers freeze";
  } else if (payload.ability === "queen") {
    const ok = abilityTargets(state, color, "queen").some(([r, c]) => r === payload.r && c === payload.c);
    if (!ok) return state;
    board = cloneBoard(state.board);
    board[payload.r][payload.c] = { type: "pawn", color };
    note = "Assignment Drive · Fresher revived";
  } else if (payload.ability === "rook") {
    const ok = abilityTargets(state, color, "rook").some(([r, c]) => r === payload.r && c === payload.c);
    if (!ok) return state;
    abilities.effects.push({ kind: "lock", r: payload.r, c: payload.c, expiresAtTick: abilities.tick + 2, castBy: color });
    note = "Curfew Imposed";
  } else if (payload.ability === "bishop") {
    const ok = abilityTargets(state, color, "bishop").some(([r, c]) => r === payload.r && c === payload.c);
    if (!ok) return state;
    abilities.effects.push({ kind: "squareFreeze", r: payload.r, c: payload.c, expiresAtTick: abilities.tick + 2, castBy: color });
    note = "Surprise Quiz · target frozen";
  } else if (payload.ability === "knight") {
    abilities.extraMoveFor = color;
    consumesTurn = false;
    note = "Night Mode armed · next knight move is free";
  }

  abilities.log = [...abilities.log, { tick: abilities.tick, color, ability: payload.ability, note }];

  let nextTurn: Color = color;
  if (consumesTurn) {
    abilities.tick += 1;
    abilities.effects = abilities.effects.filter(e => e.expiresAtTick > abilities.tick);
    nextTurn = enemy;
  }
  const status = computeStatus(board, nextTurn, abilities);
  return { ...state, board, abilities, turn: nextTurn, status };
}
