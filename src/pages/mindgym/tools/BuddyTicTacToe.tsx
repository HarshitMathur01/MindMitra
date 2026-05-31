import { useCallback, useEffect, useRef, useState } from "react";
import {
  type Board,
  type Difficulty,
  type Player,
  analyzeMove,
  emptyBoard,
  isDraw,
  pickMove,
  winner,
} from "@/lib/tictactoe";
import * as audio from "@/lib/companion/audio";
import ToolShell from "@/components/mindgym/ToolShell";
import { BuddyCompanion, type BuddyCompanionHandle } from "@/components/companion/BuddyCompanion";

// ---------------------------------------------------------------------------
// Scoped design system — avoids polluting MindMitra globals.
// (The --bt-* tokens + bt-* animations live in index.css, scoped to .bt-game.)
// ---------------------------------------------------------------------------
const BT_CSS = `
.bt-game {
  background-color: transparent;
  color: var(--bt-ink);
  font-family: "Work Sans", ui-sans-serif, system-ui, sans-serif;
}
.bt-game .bt-paper-card {
  background: color-mix(in oklab, var(--bt-paper) 94%, white);
  border: 1px solid color-mix(in oklab, var(--bt-chai) 22%, transparent);
  box-shadow: 0 1px 0 color-mix(in oklab, var(--bt-chai) 12%, transparent),
              0 12px 30px -18px color-mix(in oklab, var(--bt-chai) 35%, transparent);
  border-radius: 0.75rem;
}
.bt-game .bt-label {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  color: color-mix(in oklab, var(--bt-ink) 45%, transparent);
}
.bt-game h1, .bt-game h2, .bt-game h3 {
  font-family: "Shippori Mincho B1", ui-serif, Georgia, serif;
  letter-spacing: -0.01em;
}
`;

const GAMES_TO_COMPLETE = 3;

type GameResult =
  | { kind: "win"; player: Player; line: readonly number[] }
  | { kind: "draw" }
  | null;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function BuddyTicTacToe() {
  const buddyRef = useRef<BuddyCompanionHandle>(null);
  const [board, setBoard]       = useState<Board>(() => emptyBoard());
  const [turn, setTurn]         = useState<Player>("X");
  const [result, setResult]     = useState<GameResult>(null);
  const [difficulty, setDiff]   = useState<Difficulty>("chill");
  const [lastMove, setLastMove] = useState<number | null>(null);
  const [shake, setShake]       = useState(false);
  const [gamesPlayed, setGames] = useState(0);
  const [completed, setCompleted] = useState(false);

  const boardRef = useRef(board);
  useEffect(() => { boardRef.current = board; }, [board]);

  // Evaluate board after a move; return true if the game is over.
  const settle = useCallback((next: Board): boolean => {
    const b = buddyRef.current;
    const w = winner(next);
    if (w) {
      setResult({ kind: "win", player: w.player, line: w.line });
      if (w.player === "O") {
        b?.react({ kind: "buddyWin" });
        audio.sfx.win();
        b?.flash(1.2);
        b?.burst("win");
        burstConfetti();
      } else {
        b?.react({ kind: "playerWin" });
        audio.sfx.lose();
        b?.burst("lose");
        setShake(true);
        window.setTimeout(() => setShake(false), 420);
      }
      setGames((g) => g + 1);
      return true;
    }
    if (isDraw(next)) {
      setResult({ kind: "draw" });
      b?.react({ kind: "draw" });
      audio.sfx.draw();
      b?.burst("draw");
      setGames((g) => g + 1);
      return true;
    }
    return false;
  }, []);

  // Human (X) plays.
  const handleCell = useCallback((i: number) => {
    if (result || turn !== "X" || board[i]) return;
    audio.unlockAudio();
    audio.sfx.markPlace();
    const next = board.slice();
    next[i] = "X";
    setBoard(next);
    setLastMove(i);
    const movesPlayed = next.filter((c) => c !== null).length;
    const analysis = analyzeMove(board, next, "X");
    const notable = !!analysis && (
      analysis.createdFork || analysis.blockedOpponent ||
      analysis.givesOpponentWin || analysis.createsThreat
    );
    if (notable || Math.random() < 0.6) {
      buddyRef.current?.react({ kind: "playerMove", movesPlayed, analysis });
    } else {
      buddyRef.current?.notifyInteraction();
    }
    if (settle(next)) return;
    setTurn("O");
  }, [board, turn, result, settle]);

  // Buddy (O) plays after a thinking beat.
  useEffect(() => {
    if (result || turn !== "O") return;
    buddyRef.current?.react({ kind: "thinking" });
    const t = window.setTimeout(() => {
      const cur = boardRef.current;
      if (winner(cur) || isDraw(cur)) return;
      const mv = pickMove(cur, "O", difficulty);
      if (mv < 0) return;
      const next = cur.slice();
      next[mv] = "O";
      setBoard(next);
      setLastMove(mv);
      audio.sfx.buddyMove();
      const movesPlayed = next.filter((c) => c !== null).length;
      const analysis = analyzeMove(cur, next, "O");
      const notable = !!analysis && (
        analysis.createdFork || analysis.blockedOpponent || analysis.createsThreat
      );
      if (notable || Math.random() < 0.7) {
        buddyRef.current?.react({ kind: "buddyMove", movesPlayed, analysis });
      }
      if (!settle(next)) setTurn("X");
    }, 950);
    return () => window.clearTimeout(t);
  }, [turn, result, difficulty, settle]);

  // Trigger session completion after GAMES_TO_COMPLETE rounds.
  useEffect(() => {
    if (gamesPlayed >= GAMES_TO_COMPLETE && !completed) {
      setCompleted(true);
    }
  }, [gamesPlayed, completed]);

  const newGame = useCallback(() => {
    audio.unlockAudio();
    audio.sfx.uiPop();
    setBoard(emptyBoard());
    setTurn("X");
    setResult(null);
    setLastMove(null);
    buddyRef.current?.react({ kind: "newGame" });
  }, []);

  const resetAll = useCallback(() => {
    setGames(0);
    setCompleted(false);
    newGame();
  }, [newGame]);

  const winLine    = result?.kind === "win" ? result.line : null;
  const statusText = result
    ? result.kind === "draw"
      ? "Draw — cat's game."
      : result.player === "X"
        ? "You win! 🎉"
        : "Buddy wins."
    : turn === "X"
      ? "Your turn — you're X"
      : "Buddy is thinking…";

  const progressLabel = `${gamesPlayed} / ${GAMES_TO_COMPLETE} games`;

  return (
    <ToolShell
      toolId="buddy-tictactoe"
      title="Buddy Match"
      clinicalBasis="A short playful break reduces cognitive fatigue. Playing Tic-Tac-Toe against a reactive companion triggers mild positive affect and keeps attention focused — a micro-reset for an overloaded mind."
      xp={50}
      completed={completed}
      onReset={resetAll}
      themeAccent="teal"
      surfaceTone="warm"
      showParticles={false}
      contentPlacement="top"
    >
      {/* inject scoped CSS */}
      <style dangerouslySetInnerHTML={{ __html: BT_CSS }} />

      <div className="bt-game w-full max-w-5xl mx-auto px-4 md:px-6 pt-24 sm:pt-28 pb-8">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold leading-none" style={{ fontFamily: '"Shippori Mincho B1", ui-serif, Georgia, serif' }}>
              Tic-Tac-Toe{" "}
              <span style={{ color: "var(--bt-chai)" }}>vs</span>{" "}
              Buddy
            </h1>
            <p className="mt-1.5 text-sm opacity-70 max-w-sm">
              You're <strong>X</strong>, the buddy is <strong>O</strong>.
              Play {GAMES_TO_COMPLETE} rounds to finish the session.
            </p>
          </div>
          <div className="flex w-full items-center gap-2 flex-wrap sm:w-auto">
            <span className="bt-label px-2 py-1.5 rounded-md" style={{ background: "color-mix(in oklab, var(--bt-chai) 12%, transparent)" }}>
              {progressLabel}
            </span>
            <DifficultyToggle value={difficulty} onChange={setDiff} />
            <button
              onClick={newGame}
              className="px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-widest transition-colors"
              style={{ background: "var(--bt-ink)", color: "var(--bt-paper)" }}
            >
              New game
            </button>
          </div>
        </div>

        {/* Board (hero) + Buddy (companion). Single grid; `order` puts the buddy
            on top on phones/tablets and to the right on desktop, so the heavy 3D
            stage mounts once and the buddy controller keeps running across
            breakpoints. */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,360px)] lg:gap-6 lg:items-center">
          {/* Game board — the hero */}
          <div className={["bt-paper-card p-5 order-2 lg:order-1", shake ? "bt-shake" : ""].join(" ")}>
            <div className="mb-3 flex items-center justify-between">
              <span className="bt-label">board</span>
              <span className="bt-label" style={{ color: "var(--bt-ink)", opacity: 0.75 }}>
                {statusText}
              </span>
            </div>

            <div className="relative grid grid-cols-3 gap-2">
              {board.map((cell, i) => {
                const isWin  = winLine?.includes(i);
                const playable = !result && turn === "X" && !cell;
                return (
                  <button
                    key={i}
                    onClick={() => handleCell(i)}
                    disabled={!playable}
                    aria-label={`cell ${i + 1}${cell ? `, ${cell}` : ", empty"}`}
                    className={[
                      "group relative grid place-items-center rounded-xl select-none transition-all duration-200",
                      "text-[clamp(2rem,9vw,4.5rem)] font-bold leading-none",
                      isWin
                        ? "bt-cell-win"
                        : "hover:-translate-y-0.5",
                      i === lastMove && !isWin ? "bt-cell-ring" : "",
                      playable ? "cursor-pointer" : "cursor-default",
                    ].join(" ")}
                    style={{
                      aspectRatio: "1/1",
                      background: isWin
                        ? "color-mix(in oklab,var(--bt-gold) 30%,transparent)"
                        : "var(--bt-board-light)",
                      fontFamily: '"Shippori Mincho B1", ui-serif, Georgia, serif',
                    }}
                  >
                    {cell ? (
                      <span
                        key={`${i}-${cell}`}
                        className="bt-mark-pop"
                        style={{ color: cell === "X" ? "var(--bt-chai)" : "var(--bt-ink)" }}
                      >
                        {cell}
                      </span>
                    ) : (
                      playable && (
                        <span className="opacity-0 group-hover:opacity-20 transition-opacity" style={{ color: "var(--bt-chai)" }}>X</span>
                      )
                    )}
                  </button>
                );
              })}

              {/* Animated win stroke */}
              {winLine && (
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="absolute inset-0 h-full w-full pointer-events-none z-[2]"
                >
                  <line
                    x1={cellCx(winLine[0])}
                    y1={cellCy(winLine[0])}
                    x2={cellCx(winLine[winLine.length - 1])}
                    y2={cellCy(winLine[winLine.length - 1])}
                    stroke="var(--bt-chai)"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    className="bt-winline"
                  />
                </svg>
              )}
            </div>

            {result && (
              <p className="mt-4 text-center text-xl font-bold" style={{ fontFamily: '"Shippori Mincho B1", ui-serif, Georgia, serif' }}>
                {result.kind === "draw"
                  ? "It's a draw."
                  : result.player === "X"
                    ? "You win! 🎉"
                    : "Buddy wins!"}
              </p>
            )}
          </div>

          {/* Buddy — the companion. The reusable component owns the responsive
              stage, speech bubble, props, idle behaviour and mute. */}
          <div className="bt-paper-card p-3 order-1 lg:order-2">
            <BuddyCompanion ref={buddyRef} variant="full" />
            <p className="mt-2 px-1 bt-label hidden lg:block">
              drag to rotate · scroll to zoom · he reacts to the game
            </p>
          </div>
        </div>
      </div>
    </ToolShell>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cellCx(i: number) { return ((i % 3) + 0.5) * (100 / 3); }
function cellCy(i: number) { return (Math.floor(i / 3) + 0.5) * (100 / 3); }

function DifficultyToggle({ value, onChange }: { value: Difficulty; onChange: (d: Difficulty) => void }) {
  return (
    <div className="inline-flex rounded-lg overflow-hidden border text-[11px] font-mono uppercase tracking-widest" style={{ borderColor: "color-mix(in oklab,var(--bt-ink) 22%,transparent)" }}>
      {(["chill", "sharp"] as const).map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className="px-3 py-2 transition-colors"
          style={value === d
            ? { background: "var(--bt-ink)", color: "var(--bt-paper)" }
            : { background: "transparent", color: "color-mix(in oklab,var(--bt-ink) 55%,transparent)" }
          }
          title={d === "chill" ? "Buddy plays loose — you can win" : "Buddy plays optimally — try to beat it!"}
        >
          {d}
        </button>
      ))}
    </div>
  );
}

function burstConfetti() {
  if (typeof document === "undefined") return;
  const root = document.createElement("div");
  root.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:60;overflow:hidden";
  document.body.appendChild(root);
  const colors = ["#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#a855f7", "#ec4899"];
  for (let i = 0; i < 80; i++) {
    const p = document.createElement("div");
    const size = 6 + Math.random() * 8;
    p.style.cssText = `position:absolute;left:50%;top:30%;width:${size}px;height:${size * 0.4}px;background:${colors[i % colors.length]};border-radius:2px;transform:translate(-50%,-50%) rotate(${Math.random() * 360}deg);transition:transform 1.6s cubic-bezier(.2,.7,.3,1),opacity 1.6s ease-out;opacity:1`;
    root.appendChild(p);
    requestAnimationFrame(() => {
      const dx = (Math.random() - 0.5) * window.innerWidth;
      const dy = (Math.random() * 0.7 + 0.3) * window.innerHeight;
      p.style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) rotate(${Math.random() * 720}deg)`;
      p.style.opacity = "0";
    });
  }
  setTimeout(() => root.remove(), 1800);
}
