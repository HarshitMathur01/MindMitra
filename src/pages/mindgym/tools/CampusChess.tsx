import { useEffect, useMemo, useRef, useState } from "react";
import { PieceGlyph } from "./chess/PieceGlyph";
import {
  applyMove,
  abilityTargets,
  canCast,
  castAbility,
  initialState,
  legalMoves,
  type AbilityKey,
  type GameState,
  type Color,
} from "./chess/chess";
import { PIECES, type PieceLore } from "./chess/pieces";
import { EVENTS, type CampusEvent } from "./chess/events";
import { pickAIMove, type Difficulty } from "./chess/ai";
import ToolShell from "@/components/mindgym/ToolShell";

// ---------------------------------------------------------------------------
// Chess design system — scoped to .cc-chess to avoid polluting MindMitra vars
// ---------------------------------------------------------------------------
const CHESS_CSS = `
.cc-chess {
  --ink: oklch(0.18 0 0);
  --paper: oklch(0.953 0.013 80);
  --chai: oklch(0.39 0.09 40);
  --gold: oklch(0.74 0.13 85);
  --board-light: oklch(0.93 0.02 80);
  --board-dark: oklch(0.55 0.09 50);
  --card: oklch(0.97 0.012 80);
  --destructive: oklch(0.55 0.2 25);
  background-color: var(--paper);
  color: var(--ink);
  font-family: "Work Sans", ui-sans-serif, system-ui, sans-serif;
  background-image:
    repeating-linear-gradient(0deg, transparent, transparent 31px, color-mix(in oklab, var(--chai) 8%, transparent) 31px, color-mix(in oklab, var(--chai) 8%, transparent) 32px),
    radial-gradient(circle at 20% 10%, color-mix(in oklab, var(--gold) 10%, transparent), transparent 40%),
    radial-gradient(circle at 90% 80%, color-mix(in oklab, var(--chai) 8%, transparent), transparent 50%);
}
/* Fix Tailwind semantic tokens that MindMitra wraps in hsl() */
.cc-chess .text-muted-foreground { color: oklch(0.42 0.04 60) !important; }
.cc-chess .text-foreground\/80 { color: oklch(0.18 0 0 / 0.80) !important; }
.cc-chess .text-foreground\/75 { color: oklch(0.18 0 0 / 0.75) !important; }
.cc-chess .text-foreground\/70 { color: oklch(0.18 0 0 / 0.70) !important; }
.cc-chess .text-foreground\/60 { color: oklch(0.18 0 0 / 0.60) !important; }
.cc-chess .text-foreground\/85 { color: oklch(0.18 0 0 / 0.85) !important; }
.cc-chess .text-foreground\/40 { color: oklch(0.18 0 0 / 0.40) !important; }
/* Custom utility classes from styles.css */
.cc-chess .paper-card {
  background: color-mix(in oklab, var(--paper) 92%, white);
  border: 1px solid color-mix(in oklab, var(--chai) 25%, transparent);
  box-shadow:
    0 1px 0 color-mix(in oklab, var(--chai) 15%, transparent),
    0 12px 30px -18px color-mix(in oklab, var(--chai) 40%, transparent);
}
.cc-chess .ink-rule { border-bottom: 1px solid color-mix(in oklab, var(--ink) 25%, transparent); }
.cc-chess .stamp {
  border: 2px solid var(--chai);
  color: var(--chai);
  padding: 0.15rem 0.5rem;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  transform: rotate(-3deg);
  display: inline-block;
}
.cc-chess .gold-underline {
  background-image: linear-gradient(transparent 62%, color-mix(in oklab, var(--gold) 70%, transparent) 62%, color-mix(in oklab, var(--gold) 70%, transparent) 90%, transparent 90%);
  background-repeat: no-repeat;
}
/* Font overrides — chess repo uses Shippori Mincho B1 for display */
.cc-chess .font-display, .cc-chess h1, .cc-chess h2, .cc-chess h3, .cc-chess h4 {
  font-family: "Shippori Mincho B1", ui-serif, Georgia, serif;
  letter-spacing: -0.01em;
}
.cc-chess .font-mono {
  font-family: "JetBrains Mono", ui-monospace, monospace;
}
.cc-chess .font-sans {
  font-family: "Work Sans", ui-sans-serif, system-ui, sans-serif;
}
/* Marquee scroll animation */
@keyframes cc-marquee-scroll {
  from { transform: translateX(0); }
  to   { transform: translateX(-33.33%); }
}
.cc-chess .cc-marquee { animation: cc-marquee-scroll 40s linear infinite; }
`;

// ---------------------------------------------------------------------------
// Types & shared constants
// ---------------------------------------------------------------------------
type Page = "home" | "codex" | "events" | "play";
type Mode = "friend" | "cpu";

const pieceLookup = Object.fromEntries(PIECES.map((p) => [p.key, p]));
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const ABILITY_ORDER: AbilityKey[] = ["king", "queen", "rook", "bishop", "knight"];
const ABILITY_NAMES: Record<AbilityKey, string> = {
  king: "Mass Bunk",
  queen: "Assignment Drive",
  rook: "Curfew",
  bishop: "Surprise Quiz",
  knight: "Night Mode",
};
const ABILITY_HINTS: Record<AbilityKey, string> = {
  king: "Freeze every enemy Fresher for one turn.",
  queen: "Revive a fallen Fresher onto your back rank.",
  rook: "Lock an empty square next to your Warden for a turn.",
  bishop: "Freeze any enemy piece on your Professor's diagonal.",
  knight: "Arm a bonus move — your next Night Owl move is free.",
};
const CATEGORY_COLOR: Record<CampusEvent["category"], string> = {
  Festival: "var(--gold)",
  Crisis: "var(--destructive)",
  Academic: "var(--chai)",
  Social: "var(--board-dark)",
  Meme: "var(--ink)",
};

function moveToNotation(board: GameState["board"], m: GameState["history"][number]): string {
  const p = board[m.tr][m.tc];
  const code = p ? pieceLookup[p.type].glyph : "??";
  const file = FILES[m.tc];
  const rank = 8 - m.tr;
  return `${code} ${file}${rank}${m.captured ? " ×" : ""}${m.promotion ? "↑TP" : ""}`;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function CampusChess() {
  const [page, setPage] = useState<Page>("home");

  // ---------- Play page state (hoisted so ToolShell can read gameOver) ----------
  const [stack, setStack] = useState<GameState[]>(() => [initialState()]);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [mode, setMode] = useState<Mode>("friend");
  const [difficulty, setDifficulty] = useState<Difficulty>("sharp");
  const [aiSide] = useState<Color>("b");
  const [thinking, setThinking] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [pendingAbility, setPendingAbility] = useState<AbilityKey | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const state = stack[stack.length - 1];
  const gameOver = state.status === "checkmate" || state.status === "stalemate";

  const legal = useMemo(() => {
    if (!selected) return [] as [number, number][];
    return legalMoves(state.board, selected[0], selected[1], state.abilities);
  }, [selected, state.board, state.abilities]);

  const targets = useMemo(() => {
    if (!pendingAbility) return [] as [number, number][];
    return abilityTargets(state, state.turn, pendingAbility);
  }, [pendingAbility, state]);

  const captured = useMemo(() => {
    const w: string[] = [], b: string[] = [];
    for (const m of state.history) {
      if (!m.captured) continue;
      if (m.captured.color === "w") w.push(m.captured.type);
      else b.push(m.captured.type);
    }
    return { w, b };
  }, [state.history]);

  const push = (next: GameState) => setStack((s) => [...s, next]);

  useEffect(() => {
    if (mode !== "cpu") return;
    if (gameOver) return;
    if (state.turn !== aiSide) return;
    setThinking(true);
    const t = setTimeout(() => {
      const m = pickAIMove(state, difficulty);
      if (m) push(applyMove(state, m.fr, m.fc, m.tr, m.tc));
      setThinking(false);
    }, 350);
    return () => clearTimeout(t);
  }, [state, mode, aiSide, difficulty, gameOver]);

  const flashMsg = (msg: string) => {
    setFlash(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 1800);
  };

  const onSquare = (r: number, c: number) => {
    if (gameOver) return;
    if (mode === "cpu" && state.turn === aiSide) return;
    if (pendingAbility) {
      const ok = targets.some(([tr, tc]) => tr === r && tc === c);
      if (!ok) return;
      const next = castAbility(state, { ability: pendingAbility, r, c } as never);
      if (next !== state) {
        push(next);
        const note = next.abilities.log[next.abilities.log.length - 1]?.note ?? "Ability cast.";
        flashMsg(note);
      }
      setPendingAbility(null);
      setSelected(null);
      return;
    }
    const p = state.board[r][c];
    if (selected) {
      const isLegal = legal.some(([lr, lc]) => lr === r && lc === c);
      if (isLegal) {
        push(applyMove(state, selected[0], selected[1], r, c));
        setSelected(null);
        return;
      }
      if (p && p.color === state.turn) { setSelected([r, c]); return; }
      setSelected(null);
      return;
    }
    if (p && p.color === state.turn) setSelected([r, c]);
  };

  const reset = () => {
    setStack([initialState()]);
    setSelected(null);
    setPendingAbility(null);
    flashMsg("New semester begins.");
  };

  const undo = () => {
    setSelected(null);
    setPendingAbility(null);
    if (stack.length <= 1) return;
    if (mode === "cpu" && stack.length >= 3 && state.turn !== aiSide) {
      setStack((s) => s.slice(0, -2));
      flashMsg("Undone — proxy attendance accepted.");
    } else {
      setStack((s) => s.slice(0, -1));
      flashMsg("Undone.");
    }
  };

  const tryAbility = (a: AbilityKey) => {
    if (mode === "cpu" && state.turn === aiSide) return;
    if (!canCast(state, state.turn, a)) return;
    setSelected(null);
    if (a === "king" || a === "knight") {
      const next = castAbility(state, { ability: a });
      if (next !== state) {
        push(next);
        const note = next.abilities.log[next.abilities.log.length - 1]?.note ?? "Ability cast.";
        flashMsg(note);
      }
      setPendingAbility(null);
      return;
    }
    setPendingAbility((cur) => (cur === a ? null : a));
  };

  const statusText = (() => {
    const side = state.turn === "w" ? "Block A" : "Block B";
    if (state.status === "checkmate") return `Checkmate. ${side} has lost the semester.`;
    if (state.status === "stalemate") return "Stalemate. The campus is in cold war.";
    if (state.status === "check") return `${side}'s Class Rep is in check.`;
    if (state.abilities.extraMoveFor === state.turn) return `${side} · Night Mode armed — move a Night Owl.`;
    if (pendingAbility) return `${side} · select a target for ${ABILITY_NAMES[pendingAbility]}.`;
    if (mode === "cpu" && state.turn === aiSide) return thinking ? "Campus AI is thinking…" : `${side} to move.`;
    return `${side} to move.`;
  })();

  const lastMove = state.history[state.history.length - 1];
  const effects = state.abilities.effects;
  const isLockedSq = (r: number, c: number) =>
    effects.some((e) => e.kind === "lock" && e.r === r && e.c === c && e.expiresAtTick > state.abilities.tick);
  const isFrozenSq = (r: number, c: number) =>
    effects.some((e) => e.kind === "squareFreeze" && e.r === r && e.c === c && e.expiresAtTick > state.abilities.tick);
  const isPawnFreezeOn = (color: Color) =>
    effects.some((e) => e.kind === "pawnFreeze" && e.color === color && e.expiresAtTick > state.abilities.tick);

  const navigate = (p: Page) => {
    setPage(p);
    window.scrollTo({ top: 0 });
  };

  return (
    <ToolShell
      toolId="campus-chess"
      title="Campus Chess"
      clinicalBasis="Chess trains working memory, planning, and cognitive flexibility. Campus archetypes make it relatable — a structured cognitive break that teaches strategic thinking."
      xp={50}
      completed={page === "play" && gameOver}
      onReset={() => { reset(); }}
      themeAccent="amber"
      surfaceTone="warm"
      showParticles={false}
      contentPlacement="top"
      showSupportButton={false}
      showChrome={false}
    >
      {/* Scoped CSS for the chess design system */}
      <style dangerouslySetInnerHTML={{ __html: CHESS_CSS }} />

      <div className="cc-chess w-full">
        {/* Navigation */}
        <ChessNav page={page} navigate={navigate} />

        {/* Pages */}
        {page === "home" && <HomePage navigate={navigate} />}
        {page === "codex" && <CodexPage />}
        {page === "events" && <EventsPage />}
        {page === "play" && (
          <div className="mx-auto max-w-7xl px-6 py-12">
            <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-3">§03 · The Board</p>
                <h1 className="font-display text-5xl md:text-6xl font-bold leading-none">
                  Hostel Block A <span className="text-[color:var(--chai)]">vs</span> Block B
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SegToggle
                  value={mode}
                  onChange={(v) => { setMode(v); reset(); }}
                  options={[{ value: "friend", label: "vs Friend" }, { value: "cpu", label: "vs Campus AI" }]}
                />
                {mode === "cpu" && (
                  <SegToggle
                    value={difficulty}
                    onChange={(v) => setDifficulty(v)}
                    options={[
                      { value: "casual", label: "Casual" },
                      { value: "sharp", label: "Sharp" },
                      { value: "ruthless", label: "Ruthless" },
                    ]}
                  />
                )}
                <button
                  onClick={undo}
                  disabled={stack.length <= 1 || thinking}
                  className="font-mono text-[11px] uppercase tracking-[0.2em] px-4 py-3 border border-[color:var(--ink)]/40 hover:bg-[color:var(--ink)] hover:text-[color:var(--paper)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-inherit"
                >
                  ↶ Undo
                </button>
                <button
                  onClick={reset}
                  className="font-mono text-[11px] uppercase tracking-[0.2em] px-4 py-3 border border-[color:var(--ink)]/40 hover:bg-[color:var(--ink)] hover:text-[color:var(--paper)] transition-colors"
                >
                  ↺ New semester
                </button>
              </div>
            </header>

            <div className="grid lg:grid-cols-12 gap-8">
              {/* Left sidebar — Black side */}
              <aside className="lg:col-span-3 order-2 lg:order-1 space-y-6">
                <SidePanel
                  label={mode === "cpu" ? "Campus AI · Black" : "Block B · Black"}
                  captured={captured.b}
                  active={state.turn === "b"}
                  thinking={mode === "cpu" && state.turn === "b" && thinking}
                  abilitiesUsed={state.abilities.used.b}
                  pawnsFrozen={isPawnFreezeOn("b")}
                />
                {mode !== "cpu" && (
                  <AbilitiesPanel
                    label="Block B abilities"
                    color="b"
                    state={state}
                    pending={state.turn === "b" ? pendingAbility : null}
                    disabled={state.turn !== "b" || gameOver}
                    onCast={tryAbility}
                    onCancel={() => setPendingAbility(null)}
                  />
                )}
                <MoveLog history={state.history} board={state.board} />
                <AbilityLog log={state.abilities.log} />
              </aside>

              {/* Board column */}
              <div className="lg:col-span-6 order-1 lg:order-2">
                <div className="paper-card p-3 md:p-5">
                  {/* File labels top */}
                  <div className="flex">
                    <div className="w-5" />
                    <div className="flex-1 grid grid-cols-8 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {FILES.map((f) => <div key={f} className="text-center py-1">{f}</div>)}
                    </div>
                    <div className="w-5" />
                  </div>

                  <div className="flex">
                    <div className="w-5 grid grid-rows-8 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {Array.from({ length: 8 }).map((_, i) => <div key={i} className="flex items-center justify-center">{8 - i}</div>)}
                    </div>

                    <div
                      className="flex-1 grid grid-cols-8 aspect-square border border-[color-mix(in_oklab,var(--ink)_30%,transparent)] shadow-[0_8px_30px_-8px_rgba(0,0,0,0.4)]"
                    >
                      {Array.from({ length: 64 }).map((_, i) => {
                        const r = Math.floor(i / 8), c = i % 8;
                        const dark = (r + c) % 2 === 1;
                        const piece = state.board[r][c];
                        const isSel = selected && selected[0] === r && selected[1] === c;
                        const isLegal = legal.some(([lr, lc]) => lr === r && lc === c);
                        const isLast = lastMove && ((lastMove.fr === r && lastMove.fc === c) || (lastMove.tr === r && lastMove.tc === c));
                        const isTarget = targets.some(([tr, tc]) => tr === r && tc === c);
                        const locked = isLockedSq(r, c);
                        const frozen = isFrozenSq(r, c);
                        const pawnFrozen = piece?.type === "pawn" && isPawnFreezeOn(piece.color);
                        return (
                          <button
                            key={i}
                            onClick={() => onSquare(r, c)}
                            className="relative flex items-center justify-center transition-colors"
                            style={{
                              background: isSel
                                ? "color-mix(in oklab, var(--gold) 75%, var(--board-light))"
                                : isTarget
                                  ? "color-mix(in oklab, var(--chai) 55%, " + (dark ? "var(--board-dark)" : "var(--board-light)") + ")"
                                  : isLast
                                    ? "color-mix(in oklab, var(--gold) 30%, " + (dark ? "var(--board-dark)" : "var(--board-light)") + ")"
                                    : dark ? "var(--board-dark)" : "var(--board-light)",
                              boxShadow: isSel
                                ? "inset 0 0 0 2px var(--chai)"
                                : isTarget
                                  ? "inset 0 0 0 2px var(--chai)"
                                  : undefined,
                            }}
                          >
                            {piece && <PieceGlyph type={piece.type} color={piece.color} size={44} />}
                            {(frozen || pawnFrozen) && piece && (
                              <span className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 0 2px color-mix(in oklab, var(--chai) 80%, transparent)", background: "color-mix(in oklab, var(--chai) 18%, transparent)" }} />
                            )}
                            {locked && (
                              <span className="absolute font-mono text-[9px] uppercase tracking-[0.2em] px-1 py-0.5 pointer-events-none" style={{ background: "var(--ink)", color: "var(--paper)" }}>curfew</span>
                            )}
                            {isLegal && !piece && (
                              <span className="absolute w-3.5 h-3.5 rounded-full pointer-events-none" style={{ background: "color-mix(in oklab, var(--chai) 55%, transparent)", boxShadow: "0 0 0 2px color-mix(in oklab, var(--gold) 60%, transparent)" }} />
                            )}
                            {isLegal && piece && (
                              <span className="absolute inset-0.5 rounded-sm pointer-events-none" style={{ boxShadow: "inset 0 0 0 3px color-mix(in oklab, var(--destructive) 80%, transparent)" }} />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="w-5 grid grid-rows-8 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {Array.from({ length: 8 }).map((_, i) => <div key={i} className="flex items-center justify-center">{8 - i}</div>)}
                    </div>
                  </div>

                  {/* File labels bottom */}
                  <div className="flex">
                    <div className="w-5" />
                    <div className="flex-1 grid grid-cols-8 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {FILES.map((f) => <div key={f} className="text-center py-1">{f}</div>)}
                    </div>
                    <div className="w-5" />
                  </div>
                </div>

                {/* Status bar */}
                <div className="mt-5 flex items-center justify-between gap-4 px-2 min-h-[2rem]">
                  <div className="font-display text-lg flex items-center gap-3">
                    {thinking && <span className="inline-block w-2 h-2 rounded-full bg-[color:var(--chai)] animate-pulse" />}
                    <span>{statusText}</span>
                  </div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    move {Math.ceil(state.history.length / 2) || 1}
                  </div>
                </div>

                {flash && (
                  <div className="mt-3 px-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--chai)] animate-[fade-in_0.2s_ease-out]">
                    · {flash}
                  </div>
                )}
                {pendingAbility && (
                  <div className="mt-3 px-2 flex items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-foreground/80">
                    <span>· targeting {ABILITY_NAMES[pendingAbility]} — tap a highlighted square</span>
                    <button
                      onClick={() => setPendingAbility(null)}
                      className="px-2 py-1 border border-[color:var(--ink)]/40 hover:bg-[color:var(--ink)] hover:text-[color:var(--paper)]"
                    >
                      cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Right sidebar — White side */}
              <aside className="lg:col-span-3 order-3 space-y-6">
                <SidePanel
                  label="Block A · White"
                  captured={captured.w}
                  active={state.turn === "w"}
                  abilitiesUsed={state.abilities.used.w}
                  pawnsFrozen={isPawnFreezeOn("w")}
                />
                <AbilitiesPanel
                  label={mode === "cpu" ? "Your abilities" : "Block A abilities"}
                  color="w"
                  state={state}
                  pending={state.turn === "w" ? pendingAbility : null}
                  disabled={state.turn !== "w" || gameOver}
                  onCast={tryAbility}
                  onCancel={() => setPendingAbility(null)}
                />

                <div className="paper-card p-5">
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">how to play</div>
                  <ul className="text-sm space-y-2 text-foreground/80 leading-relaxed">
                    <li>· Classical chess movement, campus drama.</li>
                    <li>· Tap a piece, then a highlighted square.</li>
                    <li>· Each archetype has one signature ability per game.</li>
                    <li>· Freshers reaching the far rank evolve into Toppers.</li>
                    <li>· Undo brings back any move — proxy attendance, basically.</li>
                    <li>· Lose your Class Rep and the semester is over.</li>
                  </ul>
                </div>
              </aside>
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
const NAV_LINKS: { page: Page; label: string; num: string }[] = [
  { page: "home", label: "Home", num: "01" },
  { page: "codex", label: "Codex", num: "02" },
  { page: "play", label: "Play", num: "03" },
  { page: "events", label: "Chaos", num: "04" },
];

function ChessNav({ page, navigate }: { page: Page; navigate: (p: Page) => void }) {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md border-b border-[color-mix(in_oklab,var(--ink)_15%,transparent)]" style={{ background: "color-mix(in oklab, var(--paper) 80%, transparent)" }}>
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between gap-6">
        <button onClick={() => navigate("home")} className="flex items-center gap-3 group">
          <div className="w-9 h-9 grid place-items-center font-display font-bold" style={{ background: "var(--ink)", color: "var(--paper)" }}>
            学
          </div>
          <div className="leading-tight">
            <div className="font-display text-lg font-bold tracking-tight">Campus Kingdoms</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">an 8-semester chess</div>
          </div>
        </button>
        <nav className="flex items-center gap-1">
          {NAV_LINKS.map((l) => (
            <button
              key={l.page}
              onClick={() => navigate(l.page)}
              className={
                "px-3 py-2 font-mono text-xs uppercase tracking-[0.18em] transition-colors flex items-baseline gap-1.5 " +
                (page === l.page ? "text-[color:var(--ink)] gold-underline" : "text-foreground/70 hover:text-[color:var(--ink)]")
              }
            >
              <span className="text-[9px] opacity-60">{l.num}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Home page
// ---------------------------------------------------------------------------
function HomePage({ navigate }: { navigate: (p: Page) => void }) {
  return (
    <div>
      <Hero navigate={navigate} />
      <Marquee />
      <Pillars />
      <PieceRoster navigate={navigate} />
      <ZoneMap />
      <CTA navigate={navigate} />
    </div>
  );
}

function Hero({ navigate }: { navigate: (p: Page) => void }) {
  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-6 pt-16 pb-24 grid lg:grid-cols-12 gap-10 items-end">
        <div className="lg:col-span-7">
          <div className="flex items-center gap-3 mb-6">
            <span className="stamp text-[10px]">Vol. 1 · Hostel Edition</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">est. third semester</span>
          </div>
          <h1 className="font-display font-extrabold leading-[0.92] tracking-tight text-[clamp(3rem,9vw,7.5rem)]">
            Campus
            <span className="block">
              <span className="gold-underline">Kingdoms</span><span className="text-[color:var(--chai)]">.</span>
            </span>
          </h1>
          <p className="mt-8 max-w-xl text-lg text-foreground/80 leading-relaxed">
            A chessboard, but the king is your Class Rep, the queen tops every
            exam, the bishop is a professor with a surprise quiz, and the pawns
            are wide-eyed freshers in lanyards. Two rival groups. Eight
            semesters. One checkmate.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <button
              onClick={() => navigate("play")}
              className="group inline-flex items-center gap-3 px-6 py-4 font-mono uppercase tracking-[0.18em] text-xs hover:bg-[color:var(--chai)] transition-colors"
              style={{ background: "var(--ink)", color: "var(--paper)" }}
            >
              <span>Open the board</span>
              <span className="font-display text-base">→</span>
            </button>
            <button
              onClick={() => navigate("codex")}
              className="inline-flex items-center gap-3 px-6 py-4 font-mono uppercase tracking-[0.18em] text-xs border border-[color:var(--ink)]/30 hover:border-[color:var(--ink)] transition-colors"
            >
              <span>Read the codex</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-5">
          <HeroBoard />
        </div>
      </div>
    </section>
  );
}

function HeroBoard() {
  const setup: { r: number; c: number; type: PieceLore["key"]; color: Color }[] = [
    { r: 0, c: 3, type: "queen", color: "b" },
    { r: 0, c: 4, type: "king", color: "b" },
    { r: 1, c: 2, type: "pawn", color: "b" },
    { r: 2, c: 5, type: "knight", color: "b" },
    { r: 4, c: 3, type: "bishop", color: "w" },
    { r: 5, c: 4, type: "knight", color: "w" },
    { r: 6, c: 4, type: "pawn", color: "w" },
    { r: 7, c: 3, type: "queen", color: "w" },
    { r: 7, c: 4, type: "king", color: "w" },
    { r: 7, c: 0, type: "rook", color: "w" },
  ];
  return (
    <div className="paper-card p-5 relative">
      <div className="absolute -top-3 -right-3 stamp text-[10px]" style={{ background: "var(--paper)" }}>live demo</div>
      <div className="grid grid-cols-8 aspect-square">
        {Array.from({ length: 64 }).map((_, i) => {
          const r = Math.floor(i / 8), c = i % 8;
          const dark = (r + c) % 2 === 1;
          const occ = setup.find((s) => s.r === r && s.c === c);
          return (
            <div
              key={i}
              className="relative flex items-center justify-center"
              style={{ background: dark ? "var(--board-dark)" : "var(--board-light)" }}
            >
              {occ && <PieceGlyph type={occ.type} color={occ.color} size={28} />}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <span>Hostel Block A · vs · Block B</span>
        <span>turn 14</span>
      </div>
    </div>
  );
}

function Marquee() {
  const items = [
    "ATTENDANCE BELOW 75%",
    "MASS BUNK DECLARED",
    "WIFI DOWN",
    "MAGGI AT 2 AM",
    "SURPRISE QUIZ",
    "PLACEMENT SEASON",
    "MESS STRIKE",
    "HACKATHON RUSH",
    "CURFEW IMPOSED",
  ];
  return (
    <div className="border-y border-[color-mix(in_oklab,var(--ink)_20%,transparent)] overflow-hidden" style={{ background: "var(--ink)", color: "var(--paper)" }}>
      <div className="flex gap-12 py-4 whitespace-nowrap font-mono text-xs uppercase tracking-[0.3em] cc-marquee">
        {[...items, ...items, ...items].map((t, i) => (
          <span key={i} className="flex items-center gap-12">
            <span>{t}</span><span className="text-[color:var(--gold)]">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Pillars() {
  const items = [
    { num: "壹", t: "Attendance", d: "Skip too many turns and your piece freezes. Unless you have a friend signing proxy." },
    { num: "贰", t: "Internal Exams", d: "Mid-game the board mutates. Knights get stronger at night. Freshers panic." },
    { num: "叁", t: "Festival Mode", d: "DJ Night, LAN tournament, mess strike — random event cards bend the rules." },
    { num: "肆", t: "Friendship Buffs", d: "Adjacent allied pieces gain defense and movement. No one survives campus alone." },
  ];
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <div className="flex items-end justify-between mb-12 gap-8 flex-wrap">
        <h2 className="font-display text-5xl md:text-6xl font-bold max-w-2xl leading-tight">
          Not just a board.<br />
          <span className="text-[color:var(--chai)]">A semester.</span>
        </h2>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground max-w-xs">
          §02 — four systems that turn every match into a campus saga
        </p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px border border-[color-mix(in_oklab,var(--ink)_20%,transparent)]" style={{ background: "color-mix(in oklab, var(--ink) 20%, transparent)" }}>
        {items.map((it) => (
          <div key={it.t} className="p-8 hover:bg-[color:var(--card)] transition-colors" style={{ background: "var(--paper)" }}>
            <div className="font-display text-5xl text-[color:var(--chai)] mb-6">{it.num}</div>
            <h3 className="font-display font-bold text-xl mb-2">{it.t}</h3>
            <p className="text-sm text-foreground/75 leading-relaxed">{it.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PieceRoster({ navigate }: { navigate: (p: Page) => void }) {
  return (
    <section className="py-24" style={{ background: "var(--ink)", color: "var(--paper)" }}>
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex items-end justify-between mb-12 gap-6 flex-wrap">
          <h2 className="font-display text-5xl md:text-6xl font-bold leading-tight">
            Meet the<br />
            <span className="text-[color:var(--gold)]">cast.</span>
          </h2>
          <button
            onClick={() => navigate("codex")}
            className="font-mono text-xs uppercase tracking-[0.2em] hover:text-[color:var(--gold)] transition-colors"
            style={{ color: "oklch(0.953 0.013 80 / 0.7)" }}
          >
            full codex →
          </button>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PIECES.map((p) => (
            <div key={p.key} className="group border p-6 hover:border-[color:var(--gold)] transition-colors" style={{ borderColor: "oklch(0.953 0.013 80 / 0.15)" }}>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="font-display text-3xl text-[color:var(--gold)]">{p.kanji}</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] mt-1" style={{ color: "oklch(0.953 0.013 80 / 0.5)" }}>
                    {p.chessName}
                  </div>
                </div>
                <div className="font-mono text-xs px-2 py-1 border" style={{ borderColor: "oklch(0.953 0.013 80 / 0.2)" }}>{p.glyph}</div>
              </div>
              <h3 className="font-display text-2xl font-bold mb-2">{p.archetype}</h3>
              <p className="italic text-sm mb-4" style={{ color: "oklch(0.953 0.013 80 / 0.7)" }}>"{p.tagline}"</p>
              <p className="text-sm leading-relaxed" style={{ color: "oklch(0.953 0.013 80 / 0.6)" }}>{p.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ZoneMap() {
  const zones = [
    { name: "Library", effect: "+1 strategic vision" },
    { name: "Mess", effect: "Restores stamina" },
    { name: "Hostel Room", effect: "Heals tired pieces" },
    { name: "Lab", effect: "Unlocks tech abilities" },
    { name: "Fest Ground", effect: "Random chaos event" },
    { name: "Sports Arena", effect: "Boosts knight movement" },
    { name: "Exam Hall", effect: "High-risk battle zone" },
    { name: "Placement Cell", effect: "+ aggression, + stakes" },
  ];
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <div className="grid lg:grid-cols-12 gap-12 items-start">
        <div className="lg:col-span-4">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">§03 — the board</p>
          <h2 className="font-display text-5xl font-bold leading-tight">
            Eight squares wide.<br />
            <span className="text-[color:var(--chai)]">A whole campus deep.</span>
          </h2>
          <p className="mt-6 text-foreground/75 leading-relaxed">
            Forget light and dark. Every tile is a corner of campus — and each
            one quietly rewrites who's strong, who's safe, and who's about to
            get checkmated by a surprise quiz.
          </p>
        </div>
        <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-px border border-[color-mix(in_oklab,var(--ink)_20%,transparent)]" style={{ background: "color-mix(in oklab, var(--ink) 20%, transparent)" }}>
          {zones.map((z, i) => (
            <div key={z.name} className="p-6 aspect-square flex flex-col justify-between hover:bg-[color:var(--card)] transition-colors" style={{ background: "var(--paper)" }}>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">zone · {String(i + 1).padStart(2, "0")}</div>
              <div>
                <div className="font-display font-bold text-xl">{z.name}</div>
                <div className="text-xs text-foreground/70 mt-1">{z.effect}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA({ navigate }: { navigate: (p: Page) => void }) {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-24">
      <div className="paper-card p-12 md:p-16 grid md:grid-cols-12 gap-8 items-center">
        <div className="md:col-span-8">
          <h2 className="font-display text-4xl md:text-5xl font-bold leading-tight">
            Your move,<br />Class Rep.
          </h2>
          <p className="mt-4 text-foreground/75 max-w-xl">
            Grab a friend. Pick a side. Try not to let your queen get caught at
            a hackathon while your king bunks the only attended class.
          </p>
        </div>
        <div className="md:col-span-4 flex md:justify-end">
          <button
            onClick={() => navigate("play")}
            className="inline-flex items-center gap-3 px-8 py-5 font-mono uppercase tracking-[0.18em] text-xs hover:bg-[color:var(--chai)] transition-colors"
            style={{ background: "var(--ink)", color: "var(--paper)" }}
          >
            Start match →
          </button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Codex page
// ---------------------------------------------------------------------------
function CodexPage() {
  const [active, setActive] = useState<PieceLore>(PIECES[0]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <header className="mb-12 max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground mb-4">§02 · Codex of Pieces</p>
        <h1 className="font-display text-6xl md:text-7xl font-bold leading-[0.95]">
          The six<br />
          <span className="text-[color:var(--chai)]">archetypes.</span>
        </h1>
        <p className="mt-6 text-lg text-foreground/75 leading-relaxed">
          Every chess piece, rewritten as a student you've definitely met. Tap
          a card to open the dossier — stats, habitats, weaknesses, and how
          they break the board.
        </p>
      </header>

      {/* Selector strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px border border-[color-mix(in_oklab,var(--ink)_25%,transparent)] mb-px" style={{ background: "color-mix(in oklab, var(--ink) 25%, transparent)" }}>
        {PIECES.map((p) => {
          const isActive = p.key === active.key;
          return (
            <button
              key={p.key}
              onClick={() => setActive(p)}
              className={"group p-5 transition-colors text-left " + (isActive ? "" : "hover:bg-[color:var(--card)]")}
              style={{ background: isActive ? "var(--ink)" : "var(--paper)", color: isActive ? "var(--paper)" : "var(--ink)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={"font-display text-2xl " + (isActive ? "text-[color:var(--gold)]" : "text-[color:var(--chai)]")}>{p.kanji}</div>
                <div className={"font-mono text-[9px] uppercase tracking-[0.2em] px-1.5 py-0.5 border " + (isActive ? "border-[color:var(--paper)]/30" : "border-[color:var(--ink)]/20")}>
                  {p.rarity}
                </div>
              </div>
              <div className="font-display font-bold text-lg leading-tight">{p.archetype}</div>
              <div className={"font-mono text-[10px] uppercase tracking-[0.2em] mt-1 " + (isActive ? "text-[color:var(--paper)]/60" : "text-muted-foreground")}>{p.chessName} · {p.glyph}</div>
            </button>
          );
        })}
      </div>

      <Dossier piece={active} />
    </div>
  );
}

function Dossier({ piece }: { piece: PieceLore }) {
  return (
    <article
      key={piece.key}
      className="border border-[color-mix(in_oklab,var(--ink)_25%,transparent)] grid lg:grid-cols-12 gap-10 p-8 md:p-12 animate-[fade-in_0.3s_ease-out]"
      style={{ background: "var(--paper)" }}
    >
      <div className="lg:col-span-4 space-y-6">
        <div className="relative w-full aspect-square max-w-xs mx-auto grid place-items-center" style={{ background: "var(--ink)" }}>
          <div className="absolute top-3 left-3 font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: "oklch(0.953 0.013 80 / 0.6)" }}>
            № {String(PIECES.findIndex((p) => p.key === piece.key) + 1).padStart(2, "0")}
          </div>
          <div className="absolute top-3 right-3 font-mono text-[10px] uppercase tracking-[0.25em] text-[color:var(--gold)]">{piece.rarity}</div>
          <PieceGlyph type={piece.key} color="w" size={160} />
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: "oklch(0.953 0.013 80 / 0.6)" }}>
            <span>{piece.glyph}</span>
            <span>{piece.chessName}</span>
          </div>
        </div>
        <CodexStats stats={piece.stats} />
      </div>

      <div className="lg:col-span-5 space-y-5">
        <div>
          <div className="font-display text-4xl text-[color:var(--chai)] mb-1">{piece.kanji}</div>
          <h2 className="font-display text-4xl md:text-5xl font-bold leading-tight">{piece.archetype}</h2>
          <p className="mt-2 italic text-foreground/70">"{piece.tagline}"</p>
        </div>
        <p className="text-foreground/85 leading-relaxed">{piece.description}</p>

        <div className="grid sm:grid-cols-2 gap-5 pt-3">
          <CodexField label="Habitat" value={piece.habitat} />
          <CodexField label="Weakness" value={piece.weakness} />
        </div>

        {piece.evolution && (
          <div className="pt-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Evolution paths</div>
            <div className="flex flex-wrap gap-2">
              {piece.evolution.map((e) => (
                <span key={e} className="font-mono text-[11px] uppercase tracking-[0.15em] px-3 py-1.5 text-[color:var(--gold)]" style={{ background: "var(--ink)" }}>
                  → {e}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="lg:col-span-3 space-y-5">
        <div className="paper-card p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Movement</div>
          <p className="text-sm leading-relaxed">{piece.movement}</p>
        </div>
        <div className="p-5" style={{ background: "var(--ink)", color: "var(--paper)" }}>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[color:var(--gold)] mb-2">Signature Ability</div>
          <p className="text-sm font-medium leading-relaxed">{piece.ability}</p>
        </div>
      </div>
    </article>
  );
}

function CodexField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1.5">{label}</div>
      <p className="text-sm leading-relaxed">{value}</p>
    </div>
  );
}

function CodexStats({ stats }: { stats: PieceLore["stats"] }) {
  const rows: [string, number][] = [
    ["Power", stats.power],
    ["Mobility", stats.mobility],
    ["Chaos", stats.chaos],
    ["GPA", stats.gpa],
  ];
  return (
    <div className="paper-card p-5 space-y-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Stat sheet</div>
      {rows.map(([k, v]) => (
        <div key={k} className="space-y-1">
          <div className="flex justify-between items-center font-mono text-[10px] uppercase tracking-[0.2em]">
            <span>{k}</span>
            <span className="text-[color:var(--chai)]">{v}/10</span>
          </div>
          <div className="h-1.5 overflow-hidden" style={{ background: "color-mix(in oklab, var(--ink) 12%, transparent)" }}>
            <div
              className="h-full"
              style={{ width: `${v * 10}%`, background: "linear-gradient(90deg, var(--chai), var(--gold))" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Events page
// ---------------------------------------------------------------------------
function EventsPage() {
  const [drawn, setDrawn] = useState<CampusEvent | null>(null);
  const draw = () => setDrawn(EVENTS[Math.floor(Math.random() * EVENTS.length)]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <header className="mb-12 max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground mb-4">§04 · Chaos Deck</p>
        <h1 className="font-display text-6xl md:text-7xl font-bold leading-[0.95]">
          The week<br />
          <span className="text-[color:var(--chai)]">decides itself.</span>
        </h1>
        <p className="mt-6 text-lg text-foreground/75 leading-relaxed">
          Every five turns the deck draws a card. Sometimes it's a DJ Night.
          Sometimes the WiFi just dies. Plan accordingly. Or don't.
        </p>
      </header>

      <div className="paper-card p-8 md:p-12 mb-16 grid md:grid-cols-12 gap-10 items-center">
        <div className="md:col-span-7">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">drawn card</div>
          {drawn ? (
            <>
              <div
                className="inline-block stamp text-[10px] mb-4"
                style={{ color: CATEGORY_COLOR[drawn.category], borderColor: CATEGORY_COLOR[drawn.category] }}
              >
                {drawn.category}
              </div>
              <h2 className="font-display text-5xl md:text-6xl font-bold leading-none">{drawn.title}</h2>
              <p className="mt-6 text-foreground/85">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mr-2">effect</span>
                {drawn.effect}
              </p>
              <p className="mt-3 italic text-foreground/60">"{drawn.flavor}"</p>
            </>
          ) : (
            <h2 className="font-display text-5xl md:text-6xl font-bold leading-none text-foreground/40">
              Press draw to roll the week.
            </h2>
          )}
        </div>
        <div className="md:col-span-5 flex md:justify-end">
          <button
            onClick={draw}
            className="inline-flex items-center gap-3 px-8 py-5 font-mono uppercase tracking-[0.18em] text-xs hover:bg-[color:var(--chai)] transition-colors"
            style={{ background: "var(--ink)", color: "var(--paper)" }}
          >
            Draw a card →
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px border border-[color-mix(in_oklab,var(--ink)_18%,transparent)]" style={{ background: "color-mix(in oklab, var(--ink) 18%, transparent)" }}>
        {EVENTS.map((e, i) => (
          <div key={e.title} className="p-6 flex flex-col gap-3 hover:bg-[color:var(--card)] transition-colors" style={{ background: "var(--paper)" }}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: CATEGORY_COLOR[e.category] }}>
                {e.category}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">№{String(i + 1).padStart(2, "0")}</span>
            </div>
            <h3 className="font-display text-2xl font-bold leading-tight">{e.title}</h3>
            <p className="text-sm text-foreground/80">{e.effect}</p>
            <p className="text-xs italic text-muted-foreground mt-auto">"{e.flavor}"</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Play page sub-components
// ---------------------------------------------------------------------------
function SegToggle<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex border border-[color:var(--ink)]/40 divide-x divide-[color:var(--ink)]/30">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={"px-3 py-3 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors " + (active ? "" : "hover:bg-[color:var(--ink)]/10")}
            style={active ? { background: "var(--ink)", color: "var(--paper)" } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function SidePanel({
  label, captured, active, thinking, abilitiesUsed, pawnsFrozen,
}: {
  label: string;
  captured: string[];
  active: boolean;
  thinking?: boolean;
  abilitiesUsed?: Partial<Record<AbilityKey, boolean>>;
  pawnsFrozen?: boolean;
}) {
  return (
    <div className={"paper-card p-5 transition-shadow " + (active ? "ring-2 ring-[color:var(--gold)]" : "")}>
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
        {active && (
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--chai)] flex items-center gap-1.5">
            {thinking && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--chai)] animate-pulse" />}
            {thinking ? "thinking" : "to move"}
          </span>
        )}
      </div>
      {pawnsFrozen && (
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--chai)] border border-[color:var(--chai)]/40 px-2 py-1 inline-block">
          Freshers frozen
        </div>
      )}
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">fallen</div>
      <div className="flex flex-wrap gap-1.5 min-h-[2.5rem]">
        {captured.length === 0 && <span className="text-xs text-muted-foreground italic">no losses yet</span>}
        {captured.map((t, i) => (
          <span
            key={i}
            title={pieceLookup[t].archetype}
            className="font-mono text-[10px] px-1.5 py-0.5 border border-[color:var(--ink)]/20 hover:bg-[color:var(--ink)] hover:text-[color:var(--paper)] transition-colors cursor-help"
          >
            {pieceLookup[t].glyph}
          </span>
        ))}
      </div>
      {abilitiesUsed && (
        <>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-4 mb-2">abilities</div>
          <div className="flex flex-wrap gap-1">
            {ABILITY_ORDER.map((a) => (
              <span
                key={a}
                title={ABILITY_NAMES[a] + (abilitiesUsed[a] ? " · used" : " · available")}
                className={"font-mono text-[10px] px-1.5 py-0.5 border " + (abilitiesUsed[a] ? "border-[color:var(--ink)]/20 text-muted-foreground line-through opacity-60" : "border-[color:var(--chai)]/60 text-[color:var(--chai)]")}
              >
                {pieceLookup[a].glyph}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AbilitiesPanel({
  label, color, state, pending, disabled, onCast, onCancel,
}: {
  label: string;
  color: Color;
  state: GameState;
  pending: AbilityKey | null;
  disabled: boolean;
  onCast: (a: AbilityKey) => void;
  onCancel: () => void;
}) {
  return (
    <div className="paper-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
        {pending && (
          <button onClick={onCancel} className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--chai)] hover:underline">cancel</button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {ABILITY_ORDER.map((a) => {
          const used = !!state.abilities.used[color][a];
          const castable = !disabled && !used && canCast(state, color, a);
          const active = pending === a;
          return (
            <button
              key={a}
              disabled={!castable && !active}
              onClick={() => onCast(a)}
              className={
                "text-left px-3 py-2 border transition-colors flex items-start gap-2.5 " +
                (active
                  ? "border-[color:var(--chai)] bg-[color:var(--chai)]/10"
                  : used
                    ? "border-[color:var(--ink)]/20 opacity-40 cursor-not-allowed"
                    : castable
                      ? "border-[color:var(--ink)]/40 hover:bg-[color:var(--ink)]/5"
                      : "border-[color:var(--ink)]/20 opacity-40 cursor-not-allowed")
              }
            >
              <span className="font-mono text-[10px] px-1.5 py-0.5 border border-current shrink-0 mt-0.5">{pieceLookup[a].glyph}</span>
              <span className="flex-1 min-w-0">
                <span className="block font-display text-sm leading-tight">
                  {ABILITY_NAMES[a]}
                  {used && <span className="ml-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">· used</span>}
                </span>
                <span className="block text-[11px] text-foreground/70 leading-snug mt-0.5">{ABILITY_HINTS[a]}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AbilityLog({ log }: { log: GameState["abilities"]["log"] }) {
  if (log.length === 0) return null;
  return (
    <div className="paper-card p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">chronicle</div>
      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {log.slice().reverse().map((entry, i) => (
          <div key={i} className="text-[11px] leading-snug">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] mr-1.5 text-muted-foreground">
              {entry.color === "w" ? "A" : "B"} · {pieceLookup[entry.ability].glyph}
            </span>
            <span className="text-foreground/80">{entry.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MoveLog({ history, board }: { history: GameState["history"]; board: GameState["board"] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history.length]);

  const rows: string[] = [];
  for (let i = 0; i < history.length; i += 2) {
    const w = history[i] ? moveToNotation(board, history[i]) : "";
    const b = history[i + 1] ? moveToNotation(board, history[i + 1]) : "";
    rows.push(`${String(i / 2 + 1).padStart(2, "0")}.  ${w.padEnd(10)}  ${b}`);
  }

  return (
    <div className="paper-card p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">register</div>
      <div ref={scrollRef} className="max-h-56 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-0.5">
        {rows.length === 0 && <div className="italic text-muted-foreground text-xs">no entries yet</div>}
        {rows.map((r, i) => (
          <div key={i} className="whitespace-pre text-foreground/80">{r}</div>
        ))}
      </div>
    </div>
  );
}
