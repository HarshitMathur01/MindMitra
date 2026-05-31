import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import {
  ARCHETYPES, BOARD, applyEffect, cpuStance, cpuSuccessRate, hasWon, initPlayer, move, resolveTile,
  type ArchetypeId, type MinigameKind, type PlayerState, type Stance,
} from "./lib/game";
import { pickEvent, type EventCard, type EventChoice } from "./lib/events";
import { Board } from "./components/Board";
import { PlayerCard } from "./components/PlayerCard";
import { ProxyGame } from "./components/ProxyGame";
import { CanteenGame, ExamGame, FestGame, RaidGame } from "./components/minigames";
import { StartScreen } from "./components/StartScreen";
import { StanceBar } from "./components/StanceBar";
import { EventCardModal } from "./components/EventCardModal";
import { Button } from "@/components/ui/button";
import boxArt from "./assets/box-art.jpg";
import ToolShell from "@/components/mindgym/ToolShell";
import { GameRulesModal } from "../_shared/GameRulesModal";
import { useFirstRun } from "../_shared/useFirstRun";
import "./styles.css";

const ORDER: ArchetypeId[] = ["topper", "back", "fest", "canteen"];

// Pacing — slower, easier to follow without dragging.
const STEP_MS = 200;          // per-tile token hop while a player advances
const STEP_SETTLE_MS = 240;   // beat after the token lands before the tile resolves
const CPU_ROLL_MS = 900;      // delay before a CPU rolls
const TURN_HANDOFF_MS = 650;  // beat before the turn passes to the next player

interface Pending {
  idx: number;
  kind: MinigameKind;
}

function CampusLudo({ onEnded }: { onEnded?: () => void }) {
  const [humans, setHumans] = useState<Set<ArchetypeId> | null>(null);
  const [players, setPlayers] = useState<PlayerState[]>(() => ORDER.map(initPlayer));
  const [turn, setTurn] = useState(0);
  const [stance, setStance] = useState<Stance>("study");
  const [dice, setDice] = useState<number | null>(null);
  const [diceFace, setDiceFace] = useState<number>(1);
  const [rolling, setRolling] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [event, setEvent] = useState<{ idx: number; card: EventCard } | null>(null);
  const [shake, setShake] = useState(false);
  const [ended, setEnded] = useState(false);
  // Token currently hopping tile-by-tile (overrides its board position visually).
  const [moving, setMoving] = useState<{ id: ArchetypeId; pos: number } | null>(null);
  const hopTimer = useRef<number | null>(null);

  // First-run "how to play" overlay (remembered per device).
  const [rulesSeen, markRulesSeen] = useFirstRun("mindmitra_mindgym_rules_campus-ludo_v1");
  const [rulesOpen, setRulesOpen] = useState(false);
  useEffect(() => {
    if (humans && rulesSeen) {
      setRulesOpen(true);
      markRulesSeen();
    }
  }, [humans, rulesSeen, markRulesSeen]);
  useEffect(() => () => { if (hopTimer.current) window.clearInterval(hopTimer.current); }, []);

  const activeIdx = useMemo(() => {
    let i = turn % players.length;
    for (let n = 0; n < players.length; n++) {
      if (players[i].alive && !hasWon(players[i])) return i;
      i = (i + 1) % players.length;
    }
    return turn % players.length;
  }, [turn, players]);

  const active = players[activeIdx];
  const winner = players.find(hasWon);
  const isHumanTurn = !!(active && humans?.has(active.id));
  const allDetained = players.every((p) => !p.alive);

  // Surface graduation / whole-batch-detention to the host ToolShell.
  useEffect(() => {
    if (ended) onEnded?.();
  }, [ended, onEnded]);

  // Reset stance on turn change; CPU stance is auto-picked
  useEffect(() => {
    if (!active) return;
    if (humans?.has(active.id)) {
      setStance("study");
    } else {
      setStance(cpuStance(active.id));
    }
  }, [activeIdx, active, humans]);

  function addLog(msg: string) {
    setLog((l) => [msg, ...l].slice(0, 8));
  }

  function startGame(humanIds: ArchetypeId[]) {
    setHumans(new Set(humanIds));
    setPlayers(ORDER.map(initPlayer));
    setTurn(0);
    setDice(null);
    setEnded(false);
    setLog([`Semester I begins. ${humanIds.length} human${humanIds.length === 1 ? "" : "s"} on deck.`]);
  }

  function backToMenu() {
    setHumans(null);
    setPending(null);
    setEvent(null);
    setEnded(false);
  }

  function rollDice() {
    if (rolling || winner || pending || event || ended || moving) return;
    setRolling(true);
    const roll = 1 + Math.floor(Math.random() * 6);
    // animated cycling faces
    let ticks = 0;
    const cycle = window.setInterval(() => {
      setDiceFace(1 + Math.floor(Math.random() * 6));
      ticks++;
      if (ticks >= 8) {
        window.clearInterval(cycle);
        setDiceFace(roll);
        setDice(roll);
        setRolling(false);
        stepPlayer(activeIdx, roll);
      }
    }, 70);
  }

  // CPU auto-play
  const cpuTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!humans || winner || pending || event || rolling || ended || moving) return;
    if (isHumanTurn || !active?.alive) {
      if (!active?.alive && humans) advanceTurnSoon();
      return;
    }
    cpuTimer.current = window.setTimeout(() => rollDice(), CPU_ROLL_MS);
    return () => {
      if (cpuTimer.current) window.clearTimeout(cpuTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, winner, pending, event, rolling, isHumanTurn, humans, ended, moving]);

  function advanceTurnSoon() {
    window.setTimeout(() => setTurn((t) => t + 1), TURN_HANDOFF_MS);
  }

  // CPU auto-resolves minigames
  useEffect(() => {
    if (!pending) return;
    const p = players[pending.idx];
    if (humans?.has(p.id)) return;
    const rate = cpuSuccessRate(p.id, pending.kind);
    const success = Math.random() < rate;
    const t = window.setTimeout(() => resolveMinigame(success), 1100);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  // CPU auto-picks event card
  useEffect(() => {
    if (!event) return;
    const p = players[event.idx];
    if (humans?.has(p.id)) return;
    const choice = event.card.choices[Math.floor(Math.random() * 2)];
    const t = window.setTimeout(() => resolveEvent(choice), 1200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  function flashDeltas(name: string, e: { attendance?: number; cash?: number; reputation?: number }) {
    const parts: string[] = [];
    if (e.attendance) parts.push(`${e.attendance > 0 ? "+" : ""}${e.attendance} attendance`);
    if (e.cash)       parts.push(`${e.cash > 0 ? "+" : ""}₹${e.cash}`);
    if (e.reputation) parts.push(`${e.reputation > 0 ? "+" : ""}${e.reputation} rep`);
    if (!parts.length) return;
    const positive = (e.attendance ?? 0) + (e.cash ?? 0) + (e.reputation ?? 0) > 0;
    const fn = positive ? toast.success : toast.error;
    fn(name, { description: parts.join(" · "), duration: 2000 });
  }

  // Animate the token hopping one tile at a time, then resolve the landing tile.
  function stepPlayer(idx: number, steps: number) {
    const startPos = players[idx].position;
    const mover = players[idx].id;
    setMoving({ id: mover, pos: startPos });
    let k = 0;
    if (hopTimer.current) window.clearInterval(hopTimer.current);
    hopTimer.current = window.setInterval(() => {
      k++;
      setMoving({ id: mover, pos: (startPos + k) % BOARD.length });
      if (k >= steps) {
        if (hopTimer.current) window.clearInterval(hopTimer.current);
        hopTimer.current = null;
        window.setTimeout(() => {
          // Commit position + clear `moving` together (React batches) so the
          // token never flickers back to its start tile.
          resolveStep(idx, steps);
          setMoving(null);
        }, STEP_SETTLE_MS);
      }
    }, STEP_MS);
  }

  function resolveStep(idx: number, steps: number) {
    setPlayers((prev) => {
      const next = [...prev];
      const moved = move(next[idx], steps);
      const tile = BOARD[moved.position];
      const effect = resolveTile(moved, tile, stance);
      const stats = { attendance: effect.attendance, cash: effect.cash, reputation: effect.reputation };
      const afterEffect = applyEffect(moved, stats);
      next[idx] = afterEffect;

      addLog(`${ARCHETYPES[idx].name} rolled ${steps} → ${tile.emoji} ${tile.label}. ${effect.message}`);
      if (effect.attendance || effect.cash || effect.reputation) {
        flashDeltas(`${tile.emoji} ${tile.label}`, stats);
      }

      if (effect.triggersMinigame) {
        setPending({ idx, kind: effect.triggersMinigame });
        return next;
      }
      if (effect.triggersEvent) {
        setEvent({ idx, card: pickEvent(afterEffect) });
        return next;
      }

      checkWinAndAdvance(next, idx);
      return next;
    });
  }

  function checkWinAndAdvance(state: PlayerState[], fromIdx: number) {
    if (hasWon(state[fromIdx])) {
      const name = ARCHETYPES[fromIdx].name;
      addLog(`🏆 ${name} graduated! Game over.`);
      toast.success(`🎓 ${name} graduates!`, { description: "Convocation complete.", duration: 5000 });
      confetti({ particleCount: 160, spread: 90, origin: { y: 0.6 } });
      setEnded(true);
      return;
    }
    if (!state[fromIdx].alive) {
      addLog(`💤 ${ARCHETYPES[fromIdx].name} hit 0 attendance — detained.`);
      toast.error(`${ARCHETYPES[fromIdx].name} detained`, { description: "Attendance hit zero." });
      triggerShake();
    }
    if (state.every((p) => !p.alive)) {
      addLog(`📛 The whole batch is detained. Game over.`);
      toast.error("Whole batch detained. Semester ended.");
      setEnded(true);
      return;
    }
    setTurn((t) => t + 1);
  }

  function triggerShake() {
    setShake(true);
    window.setTimeout(() => setShake(false), 450);
  }

  // ---- Minigame outcome → stat delta ----
  function minigameReward(kind: MinigameKind, success: boolean): { attendance?: number; cash?: number; reputation?: number; msg: string } {
    switch (kind) {
      case "proxy":
        return success ? { attendance: 12, msg: "Proxy signed." } : { attendance: -15, msg: "Caught by the professor!" };
      case "canteen":
        return success ? { cash: -10, reputation: 4, msg: "Haggled the chai down." } : { cash: -25, reputation: -2, msg: "Overpaid. Embarrassing." };
      case "exam":
        return success ? { attendance: 6, reputation: 5, msg: "Aced the cram." } : { attendance: -20, reputation: -3, msg: "Blanked out completely." };
      case "fest":
        return success ? { cash: 35, reputation: 8, msg: "Crowd went wild!" } : { reputation: -8, msg: "Stage flop. Painful." };
      case "raid":
        return success ? { reputation: 3, msg: "Hidden in time." } : { attendance: -12, cash: -20, msg: "Warden caught you red-handed." };
    }
  }

  function resolveMinigame(success: boolean) {
    if (!pending) return;
    const { idx, kind } = pending;
    setPending(null);
    const reward = minigameReward(kind, success);
    setPlayers((prev) => {
      const next = [...prev];
      next[idx] = applyEffect(next[idx], reward);
      const name = ARCHETYPES[idx].name;
      addLog(`${success ? "✅" : "❌"} ${name}: ${reward.msg}`);
      flashDeltas(`${name} — ${success ? "win" : "fail"}`, reward);
      if (!success) triggerShake();
      checkWinAndAdvance(next, idx);
      return next;
    });
  }

  function resolveEvent(choice: EventChoice) {
    if (!event) return;
    const { idx } = event;
    setEvent(null);
    setPlayers((prev) => {
      const next = [...prev];
      next[idx] = applyEffect(next[idx], choice);
      const name = ARCHETYPES[idx].name;
      addLog(`📜 ${name} chose "${choice.label}". ${choice.resultMessage}`);
      flashDeltas(`${name} — ${choice.label}`, choice);
      checkWinAndAdvance(next, idx);
      return next;
    });
  }

  const rulesModal = (
    <GameRulesModal
      open={rulesOpen}
      onClose={() => setRulesOpen(false)}
      scopeClassName="cl-scope"
      title="Campus Ludo — how to play"
      solidBg="var(--primary)"
      solidFg="var(--primary-foreground)"
    >
      <p>
        Walk <strong>32 tiles</strong> around campus to <strong>graduate</strong> and win.
        Each turn: pick a stance, roll the dice, survive the tile you land on.
      </p>
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] opacity-60 mb-2">Your stance each turn</p>
        <ul className="space-y-1.5">
          <li><strong>Study</strong> — safest for attendance, lighter on cash.</li>
          <li><strong>Bunk</strong> — skip the grind, but attendance &amp; reputation slip.</li>
          <li><strong>Hustle</strong> — chase cash &amp; placements, costs attendance.</li>
        </ul>
      </div>
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] opacity-60 mb-2">Tiles you'll land on</p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
          <li>📚 Lecture — proxy mini-game</li>
          <li>📖 Library — bank attendance</li>
          <li>🍵 Canteen — haggle mini-game</li>
          <li>🎤 Festival — perform on stage</li>
          <li>📝 Exam — cram mini-game</li>
          <li>💼 Placement — earn cash</li>
          <li>❗ Surprise — event card / raid</li>
          <li>🌳 Chill — relax, lose a little</li>
          <li>🏠 Hostel — safe square, rest up</li>
        </ul>
      </div>
      <p style={{ color: "var(--destructive)" }}>
        If your <strong>attendance hits 0 you're detained</strong> — out of the game. Keep it above zero!
      </p>
      <p className="opacity-70">Mini-games and event cards pop up automatically — just react.</p>
    </GameRulesModal>
  );

  if (!humans) return (
    <>
      <StartScreen onStart={startGame} onHowToPlay={() => setRulesOpen(true)} />
      {rulesModal}
    </>
  );

  const showMinigame = pending && humans.has(players[pending.idx].id);

  return (
    <>
    <main className={`min-h-screen px-3 sm:px-6 py-6 sm:py-10 ${shake ? "animate-shake" : ""}`}>
      <header className="max-w-6xl mx-auto mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-[0.35em] uppercase text-muted-foreground">
            A boxed game of survival, samosas & semesters
          </p>
          <h1 className="font-display text-4xl sm:text-6xl text-primary leading-[0.95]">
            Campus Ludo
            <span className="block font-display italic text-foreground/80 text-2xl sm:text-3xl mt-1">
              Hostel Hustle
            </span>
          </h1>
        </div>
        <div className="hidden sm:flex items-end gap-3">
          <Button variant="secondary" size="sm" onClick={backToMenu}>Change players</Button>
          <div className="w-56 h-20 overflow-hidden rounded-sm ornate-border">
            <img
              src={boxArt}
              alt="Vintage illustration of an Indian college campus"
              className="w-full h-full object-cover"
              style={{ objectPosition: "center 60%" }}
            />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div>
          <Board players={players} activeId={active.id} moving={moving} />

          <div className="paper-card mt-6 p-4 sm:p-5 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={`paper-card ornate-border w-20 h-20 flex items-center justify-center font-display text-4xl text-primary ${rolling ? "animate-dice" : ""}`}
                >
                  {rolling ? diceFace : (dice ?? "·")}
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                    {ended ? "Final bell" : moving ? "On the move" : isHumanTurn ? "Your turn" : "CPU rolling"}
                  </p>
                  <p className="font-display text-2xl text-primary">
                    {winner ? `${ARCHETYPES.find((a) => a.id === winner.id)!.name} wins` : ARCHETYPES[activeIdx].name}
                  </p>
                  <p className="text-xs text-muted-foreground italic">
                    {ended ? "Game over." : ARCHETYPES[activeIdx].perk}
                  </p>
                </div>
              </div>
              <div className="sm:ml-auto flex items-center gap-2">
                <button
                  onClick={() => setRulesOpen(true)}
                  aria-label="How to play"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                >
                  ?
                </button>
                {ended || allDetained ? (
                  <>
                    <Button onClick={() => startGame(Array.from(humans))} className="font-display tracking-wide">New Semester</Button>
                    <Button variant="secondary" onClick={backToMenu}>Menu</Button>
                  </>
                ) : (
                  <Button
                    onClick={rollDice}
                    disabled={rolling || !!pending || !!event || !isHumanTurn || !!moving}
                    className="font-display tracking-wide text-base px-6"
                  >
                    {isHumanTurn ? (moving ? "Moving…" : "Roll the dice") : `${ARCHETYPES[activeIdx].name} thinking…`}
                  </Button>
                )}
              </div>
            </div>
            {!ended && isHumanTurn && !pending && !event && (
              <StanceBar stance={stance} onChange={setStance} disabled={rolling} />
            )}
            {!ended && !isHumanTurn && (
              <p className="text-[11px] text-muted-foreground italic">
                CPU stance: <strong className="text-foreground not-italic capitalize">{stance}</strong>
              </p>
            )}
          </div>

          <div className="paper-card mt-4 p-4">
            <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-2">
              The Register
            </p>
            <ul className="space-y-1.5 text-sm">
              {log.map((l, i) => (
                <li key={i} className={i === 0 ? "text-foreground animate-fade-in" : "text-muted-foreground"}>
                  — {l}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <aside className="space-y-3">
          {players.map((p, i) => (
            <PlayerCard key={p.id} player={p} active={i === activeIdx && !ended} />
          ))}
          <div className="paper-card p-4 text-xs text-muted-foreground leading-relaxed">
            <p className="font-display text-base text-foreground mb-1">How to survive</p>
            Walk 32 tiles to graduate. Pick a <strong className="text-foreground">stance</strong>{" "}
            each turn, win the tile mini-games, and dodge event cards. Hit zero attendance →{" "}
            <strong className="text-destructive">detained</strong>.
            <button
              onClick={() => setRulesOpen(true)}
              className="mt-2 block text-[11px] uppercase tracking-[0.2em] underline underline-offset-4 text-primary hover:opacity-80 transition-opacity"
            >
              ? Full rules
            </button>
          </div>
        </aside>
      </div>

      <ProxyGame
        open={!!showMinigame && pending!.kind === "proxy"}
        onResolve={({ success }) => resolveMinigame(success)}
      />
      <CanteenGame
        open={!!showMinigame && pending!.kind === "canteen"}
        onResolve={({ success }) => resolveMinigame(success)}
      />
      <ExamGame
        open={!!showMinigame && pending!.kind === "exam"}
        onResolve={({ success }) => resolveMinigame(success)}
      />
      <FestGame
        open={!!showMinigame && pending!.kind === "fest"}
        onResolve={({ success }) => resolveMinigame(success)}
      />
      <RaidGame
        open={!!showMinigame && pending!.kind === "raid"}
        onResolve={({ success }) => resolveMinigame(success)}
      />
      <EventCardModal
        open={!!event && humans.has(players[event.idx].id)}
        card={event?.card ?? null}
        onPick={resolveEvent}
      />
    </main>
    {rulesModal}
    </>
  );
}

export default function CampusLudoApp() {
  const [completed, setCompleted] = useState(false);
  return (
    <ToolShell
      toolId="campus-ludo"
      title="Campus Ludo · Hostel Hustle"
      clinicalBasis="Light cognitive break. Dice + stance choices + quick mini-games engage attention, planning and emotion regulation in a low-stakes, playful frame."
      xp={50}
      completed={completed}
      onReset={() => setCompleted(false)}
      themeAccent="amber"
      surfaceTone="warm"
      showParticles={false}
      contentPlacement="top"
      showSupportButton={false}
    >
      <div className="cl-scope">
        <CampusLudo onEnded={() => setCompleted(true)} />
      </div>
    </ToolShell>
  );
}
