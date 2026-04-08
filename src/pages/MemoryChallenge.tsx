import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, RotateCcw, Trophy, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import TherapeuticGameShell from "@/components/mindgym/TherapeuticGameShell";
import { useGameDataSaver } from "@/lib/gameDataSaver";

const MemoryChallenge = () => {
  const navigate = useNavigate();
  const { saveMemoryChallenge } = useGameDataSaver();
  const successAudio = useRef<HTMLAudioElement | null>(null);
  const wrongAudio = useRef<HTMLAudioElement | null>(null);

  const [gameState, setGameState] = useState<'ready' | 'showing' | 'playing' | 'finished'>('ready');
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerSequence, setPlayerSequence] = useState<number[]>([]);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [showingIndex, setShowingIndex] = useState(0);
  const [activeCard, setActiveCard] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());

  const gridSize = 9;
  const cards = Array.from({ length: gridSize }, (_, i) => i);


  useEffect(() => {
    successAudio.current = new Audio("/sounds/win.mp3");
    wrongAudio.current = new Audio("/sounds/wrong.mp3");

    const savedBest = window.localStorage.getItem("memoryChallengeBestScore");
    if (savedBest) {
      setBestScore(Number(savedBest));
    }
  }, []);

  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score);
      window.localStorage.setItem("memoryChallengeBestScore", String(score));
    }
  }, [score, bestScore]);

  const generateSequence = useCallback((level: number) => {
    const newSequence: number[] = [];
    for (let i = 0; i < level + 2; i++) {
      newSequence.push(Math.floor(Math.random() * gridSize));
    }
    return newSequence;
  }, []);

  const startGame = useCallback((level = currentLevel) => {
    const newSequence = generateSequence(level);
    setSequence(newSequence);
    setPlayerSequence([]);
    setGameState("showing");
    setShowingIndex(0);
  }, [currentLevel, generateSequence]);

  const resetGame = () => {
    setGameState("ready");
    setSequence([]);
    setPlayerSequence([]);
    setCurrentLevel(1);
    setScore(0);
    setShowingIndex(0);
    setActiveCard(null);
    setStartTime(Date.now());
  };


  useEffect(() => {
    if (gameState === "showing" && showingIndex < sequence.length) {
      const timeout = setTimeout(() => {
        setActiveCard(sequence[showingIndex]);

        setTimeout(() => {
          setActiveCard(null);
          setShowingIndex((prev) => prev + 1);
        }, 600);
      }, 400);

      return () => clearTimeout(timeout);
    } else if (gameState === "showing" && showingIndex >= sequence.length) {
      setTimeout(() => {
        setGameState("playing");
      }, 800);
    }
  }, [gameState, showingIndex, sequence]);

  const handleCardClick = (cardIndex: number) => {
    if (gameState !== "playing") return;

    const newPlayerSequence = [...playerSequence, cardIndex];
    setPlayerSequence(newPlayerSequence);


    if (sequence[newPlayerSequence.length - 1] !== cardIndex) {
      wrongAudio.current?.play();
      setGameState("finished");

      // Save game result to Supabase
      const duration = Math.round((Date.now() - startTime) / 1000);
      const maxSequenceLength = sequence.length;
      saveMemoryChallenge(score, 1, duration, maxSequenceLength).catch(
        (err) => console.error('Failed to save MemoryChallenge result:', err)
      );
      return;
    }


    if (newPlayerSequence.length === sequence.length) {
      successAudio.current?.play();
      setScore((prev) => prev + currentLevel * 10);
      const nextLevel = currentLevel + 1;
      setCurrentLevel(nextLevel);

      setTimeout(() => {
        startGame(nextLevel);
      }, 1000);
    }
  };

  const gameStatusLabel =
    gameState === "ready"
      ? "Ready"
      : gameState === "showing"
        ? "Memorize"
        : gameState === "playing"
          ? "Repeat"
          : "Finished";

  const getCardStyle = (index: number) => {
    const baseStyle =
      "w-full aspect-square rounded-2xl border-2 transition-all duration-500 cursor-pointer flex items-center justify-center text-2xl font-bold shadow-lg backdrop-blur-md";

    if (activeCard === index) {
      return `${baseStyle} bg-gradient-to-br from-cyan-200 via-blue-200 to-indigo-200 
  text-gray-800 
  border-2 border-cyan-300 
  ring-2 ring-blue-100 ring-offset-1 ring-offset-indigo-100 
  scale-110 shadow-xl`;
    }

    if (gameState === "playing") {
      return `${baseStyle} bg-crushed-silk/20 hover:scale-105 hover:shadow-xl border-white/30 text-white`;
    }

    return `${baseStyle} bg-crushed-silk/10 border-white/20 text-white opacity-60 cursor-default`;
  };

  return (
    <TherapeuticGameShell
      title="Memory Challenge"
      gameId="memory-challenge"
      xp={score}
      completed={gameState === "finished"}
      onReset={resetGame}
      themePhase={gameState === "finished" ? "success" : gameState === "playing" ? "focus" : "idle"}
    >
      <div className="max-w-md mx-auto w-full flex flex-col items-center">
        {gameState === "ready" && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-8 mt-12"
          >
            <div className="bg-white/5 backdrop-blur-md p-8 rounded-3xl border border-white/10">
              <p className="text-white/70 mb-8 leading-relaxed text-lg font-light">
                Watch the sequence of shifting lights, then repeat it to strengthen your focus and anchor your mind in the present moment.
              </p>
              <button 
                onClick={() => startGame()} 
                className="w-full py-5 rounded-2xl bg-teal-500 hover:bg-teal-600 text-white font-medium tracking-wide shadow-[0_0_20px_rgba(20,184,166,0.3)] transition-all duration-300"
              >
                Begin Focus Exercise
              </button>
            </div>
            
            {(bestScore > 0) && (
              <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/5 border border-white/10">
                <span className="text-white/40 text-sm uppercase tracking-widest">Personal Best</span>
                <span className="text-teal-400 font-semibold">{bestScore} XP</span>
              </div>
            )}
          </motion.div>
        )}

        {(gameState === "showing" || gameState === "playing") && (
          <div className="w-full flex flex-col items-center space-y-8 mt-4">
            <div className="flex w-full justify-between items-center px-4">
               <div className="text-center">
                 <p className="text-xs text-white/40 uppercase tracking-widest mb-1">Level</p>
                 <p className="text-2xl font-light text-white/90">{currentLevel}</p>
               </div>
               <div className="text-center">
                 <p className="text-sm font-medium text-teal-400 mb-1">{gameState === "showing" ? "Observe..." : "Your Turn"}</p>
                 <div className="flex gap-1 justify-center mt-2 h-1.5 w-32 bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      className="bg-teal-400 h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${gameState === 'showing' ? ((showingIndex)/sequence.length)*100 : ((playerSequence.length)/sequence.length)*100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                 </div>
               </div>
               <div className="text-center">
                 <p className="text-xs text-white/40 uppercase tracking-widest mb-1">XP</p>
                 <p className="text-2xl font-light text-white/90">{score}</p>
               </div>
            </div>

            <div className="grid grid-cols-3 gap-4 p-6 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl w-full aspect-square">
              {cards.map((index) => {
                const isActive = activeCard === index;
                const isClickable = gameState === "playing";
                
                return (
                  <motion.button
                    key={index}
                    whileHover={isClickable ? { scale: 1.05 } : {}}
                    whileTap={isClickable ? { scale: 0.95 } : {}}
                    onClick={() => handleCardClick(index)}
                    disabled={!isClickable}
                    className={`rounded-2xl transition-all duration-300 relative overflow-hidden backdrop-blur-sm ${
                      isActive 
                        ? "bg-teal-400 border border-teal-300 shadow-[0_0_30px_rgba(45,212,191,0.5)] scale-105 z-10" 
                        : "bg-white/5 border border-white/10 hover:bg-white/10 opacity-70"
                    }`}
                  >
                     {isActive && (
                       <motion.div 
                         initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
                         className="absolute inset-0 bg-white/20 rounded-2xl"
                       />
                     )}
                  </motion.button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </TherapeuticGameShell>
  );
};
export default MemoryChallenge;
