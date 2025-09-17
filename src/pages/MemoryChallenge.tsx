import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, RotateCcw, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import { motion, AnimatePresence } from "framer-motion";

const MemoryChallenge = () => {
  const navigate = useNavigate();
  const successAudio = useRef<HTMLAudioElement | null>(null);
  const wrongAudio = useRef<HTMLAudioElement | null>(null);

  const [gameState, setGameState] = useState<'ready' | 'showing' | 'playing' | 'finished'>('ready');
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerSequence, setPlayerSequence] = useState<number[]>([]);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [showingIndex, setShowingIndex] = useState(0);
  const [activeCard, setActiveCard] = useState<number | null>(null);

  const gridSize = 9; 
  const cards = Array.from({ length: gridSize }, (_, i) => i);

  
  useEffect(() => {
    successAudio.current = new Audio("/sounds/win.mp3");
    wrongAudio.current = new Audio("/sounds/wrong.mp3");
  }, []);

  const generateSequence = useCallback((level: number) => {
    const newSequence: number[] = [];
    for (let i = 0; i < level + 2; i++) {
      newSequence.push(Math.floor(Math.random() * gridSize));
    }
    return newSequence;
  }, []);

  const startGame = () => {
    const newSequence = generateSequence(currentLevel);
    setSequence(newSequence);
    setPlayerSequence([]);
    setGameState("showing");
    setShowingIndex(0);
  };

  const resetGame = () => {
    setGameState("ready");
    setSequence([]);
    setPlayerSequence([]);
    setCurrentLevel(1);
    setScore(0);
    setShowingIndex(0);
    setActiveCard(null);
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
      return;
    }

    
    if (newPlayerSequence.length === sequence.length) {
      successAudio.current?.play(); 
      setScore((prev) => prev + currentLevel * 10);
      setCurrentLevel((prev) => prev + 1);

      setTimeout(() => {
        startGame();
      }, 1000);
    }
  };

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
      return `${baseStyle} bg-white/20 hover:scale-105 hover:shadow-xl border-white/30 text-white`;
    }

    return `${baseStyle} bg-white/10 border-white/20 text-white opacity-60 cursor-default`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-pink-200 via-purple-200 to-yellow-100 flex flex-col">
      <Header />
      <main className="container mx-auto px-4 py-10 max-w-2xl text-center">
        {/* Back Button & Title */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/games")}
            className="gap-2 mb-6 text-lg font-medium text-purple-700 hover:text-purple-900"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Games
          </Button>

          <h1 className="text-4xl font-extrabold mb-3 bg-gradient-to-r from-pink-600 via-red-500 to-purple-600 bg-clip-text text-transparent">
            Memory Challenge
          </h1>
          <p className="text-muted-foreground text-lg">
             Watch the sequence, then repeat it by clicking the magical cards in the same order.
          </p>
        </div>

        {/* Game State Messages */}
        <div className="mb-6">
          {gameState === "ready" && (
            <div className="flex justify-center">
              <Button onClick={startGame} className="gap-2 px-6 py-3 text-lg rounded-xl">
                <Trophy className="h-5 w-5" />
                Start Game
              </Button>
            </div>
          )}

          {gameState === "showing" && (
            <div className="text-center">
              <div className="text-xl font-semibold text-purple-700 mb-1"> Watch the sequence!</div>
              <div className="text-muted-foreground">
                Showing {showingIndex + 1} of {sequence.length}
              </div>
            </div>
          )}

          {gameState === "playing" && (
            <div className="text-center">
              <div className="text-xl font-semibold text-pink-600">Your turn!</div>
              <div className="text-muted-foreground">Click the cards in order </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card className="p-5 text-center rounded-2xl shadow-md bg-white/50 backdrop-blur-md">
            <div className="text-3xl font-bold text-purple-600">{currentLevel}</div>
            <div className="text-sm text-muted-foreground">Level</div>
          </Card>
          <Card className="p-5 text-center rounded-2xl shadow-md bg-white/50 backdrop-blur-md">
            <div className="text-3xl font-bold text-pink-600">{score}</div>
            <div className="text-sm text-muted-foreground">Score</div>
          </Card>
          <Card className="p-5 text-center rounded-2xl shadow-md bg-white/50 backdrop-blur-md">
            <div className="text-3xl font-bold text-yellow-600">{sequence.length}</div>
            <div className="text-sm text-muted-foreground">Sequence</div>
          </Card>
        </div>

        {/* Progress */}
        {gameState === "playing" && (
          <div className="mb-8">
            <div className="flex justify-between text-sm mb-2 text-purple-700">
              <span>Progress</span>
              <span>
                {playerSequence.length} / {sequence.length}
              </span>
            </div>
            <Progress value={(playerSequence.length / sequence.length) * 100} className="h-3" />
          </div>
        )}

        {/* Game Grid */}
        <Card className="p-8 rounded-2xl bg-white/40 backdrop-blur-lg shadow-lg border border-white/50">
          <div className="grid grid-cols-3 gap-4">
            {cards.map((index) => (
              <div
                key={index}
                className={getCardStyle(index)}
                onClick={() => handleCardClick(index)}
              >
                {activeCard === index && (
                  <span className="text-4xl">👻</span>
                )}
              </div>
            ))}
          </div>
        </Card>

      </main>

      {/* GAME OVER POPUP */}
      <AnimatePresence>
        {gameState === "finished" && (
          <motion.div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Card className="p-8 rounded-2xl bg-white/10 backdrop-blur-lg shadow-1xl border border-white/30 text-center">
              <div className="flex justify-center space-x-2 mb-6">
                {"GAME OVER".split("").map((letter, i) => (
                  <motion.span
                    key={i}
                    className="text-5xl font-extrabold text-red-600"
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.2 }}
                  >
                    {letter}
                  </motion.span>
                ))}
              </div>
              <p className="text-white mb-6 drop-shadow-lg">
                You reached level {currentLevel} with a score of {score}
              </p>
              <Button onClick={resetGame} className="gap-2 px-6 py-3 rounded-xl">
                <RotateCcw className="h-5 w-5" />
                Play Again
              </Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MemoryChallenge;
