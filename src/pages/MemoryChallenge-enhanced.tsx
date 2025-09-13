import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, RotateCcw, Trophy, Sparkles, Brain, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import { useGameDataSaver } from '@/lib/gameDataSaver';

const MemoryChallenge = () => {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<'ready' | 'showing' | 'playing' | 'finished'>('ready');
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerSequence, setPlayerSequence] = useState<number[]>([]);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [showingIndex, setShowingIndex] = useState(0);
  const [activeCard, setActiveCard] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const { saveMemoryChallenge } = useGameDataSaver(); 
  const gridSize = 9; // 3x3 grid
  const cards = Array.from({ length: gridSize }, (_, i) => i);

  const generateSequence = useCallback((level: number) => {
    const newSequence: number[] = [];
    for (let i = 0; i < level + 2; i++) {
      newSequence.push(Math.floor(Math.random() * gridSize));
    }
    return newSequence;
  }, []);

  const handleGameComplete = async (
    finalScore: number, 
    mistakes: number, 
    duration: number, 
    finalSequence: number
  ) => {
    try {
      await saveMemoryChallenge(finalScore, mistakes, duration, finalSequence);
      console.log('✅ Memory challenge result saved!');
    } catch (error) {
      console.error('Failed to save game result:', error);
    }
  };

  const startGame = () => {
    const newSequence = generateSequence(currentLevel);
    setSequence(newSequence);
    setPlayerSequence([]);
    setGameState('showing');
    setShowingIndex(0);
    setStartTime(Date.now());
    setShowSuccess(false);
  };

  const resetGame = () => {
    setGameState('ready');
    setSequence([]);
    setPlayerSequence([]);
    setCurrentLevel(1);
    setScore(0);
    setShowingIndex(0);
    setActiveCard(null);
    setStartTime(null);
    setShowSuccess(false);
  };

  // Show sequence to player
  useEffect(() => {
    if (gameState === 'showing' && showingIndex < sequence.length) {
      const timeout = setTimeout(() => {
        setActiveCard(sequence[showingIndex]);
        
        setTimeout(() => {
          setActiveCard(null);
          setShowingIndex(prev => prev + 1);
        }, 600);
      }, 200);

      return () => clearTimeout(timeout);
    } else if (gameState === 'showing' && showingIndex >= sequence.length) {
      setTimeout(() => {
        setGameState('playing');
      }, 800);
    }
  }, [gameState, showingIndex, sequence]);

  const handleCardClick = (cardIndex: number) => {
    if (gameState !== 'playing') return;

    const newPlayerSequence = [...playerSequence, cardIndex];
    setPlayerSequence(newPlayerSequence);

    // Check if correct so far
    if (sequence[newPlayerSequence.length - 1] !== cardIndex) {
      setGameState('finished');
      const duration = startTime ? Date.now() - startTime : 0;
      handleGameComplete(score, 1, duration, sequence.length);
      return;
    }

    // Check if sequence complete
    if (newPlayerSequence.length === sequence.length) {
      setScore(prev => prev + currentLevel * 10);
      setCurrentLevel(prev => prev + 1);
      setShowSuccess(true);
      
      setTimeout(() => {
        startGame();
      }, 1500);
    }
  };

  const getCardStyle = (index: number) => {
    const baseClasses = "w-full aspect-square rounded-2xl border-2 transition-all duration-300 cursor-pointer flex items-center justify-center text-3xl font-bold shadow-lg";
    
    if (activeCard === index) {
      return `${baseClasses} bg-gradient-to-br from-blue-500 to-purple-600 text-white border-purple-400 scale-110 shadow-2xl`;
    }
    
    if (gameState === 'playing') {
      return `${baseClasses} bg-white/70 backdrop-blur-sm border-gray-200 hover:bg-gradient-to-br hover:from-blue-100 hover:to-purple-100 hover:border-blue-300 hover:scale-105`;
    }
    
    return `${baseClasses} bg-gray-100 border-gray-200 cursor-default opacity-60`;
  };

  const cardVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: { 
      scale: 1, 
      opacity: 1,
      transition: {
        type: "spring" as const,
        damping: 15,
        stiffness: 300
      }
    },
    active: {
      scale: 1.1,
      boxShadow: "0 10px 30px rgba(59, 130, 246, 0.4)",
      transition: {
        type: "spring" as const,
        damping: 10,
        stiffness: 400
      }
    }
  };

  const statsVariants = {
    hidden: { y: -20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: {
        type: "spring" as const,
        damping: 20,
        stiffness: 300
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Button 
            variant="ghost" 
            onClick={() => navigate('/games')}
            className="gap-2 mb-6 hover:bg-white/50 transition-all duration-300 hover:scale-105 hover:shadow-md rounded-full px-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Games
          </Button>
          
          <div className="text-center">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: "spring", damping: 15 }}
              className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center breathing-pulse"
            >
              <Brain className="h-10 w-10 text-white" />
            </motion.div>
            
            <motion.h1 
              className="text-4xl font-bold mb-4 text-gradient"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              Memory Challenge
            </motion.h1>
            
            <motion.p 
              className="text-lg text-muted-foreground max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              Watch the glowing sequence carefully, then repeat it by clicking the cards in the same order. 
              Challenge your working memory and concentration!
            </motion.p>
          </div>
        </motion.div>

        <motion.div 
          className="space-y-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          {/* Stats */}
          <motion.div 
            className="grid grid-cols-3 gap-6"
            variants={statsVariants}
            initial="hidden"
            animate="visible"
          >
            <Card className="p-6 text-center bg-white/70 backdrop-blur-sm border-2 border-white/50 hover:shadow-lg transition-all duration-300">
              <motion.div 
                className="text-3xl font-bold text-purple-600 mb-2"
                animate={{ scale: currentLevel > 1 ? [1, 1.2, 1] : 1 }}
                transition={{ duration: 0.5 }}
              >
                {currentLevel}
              </motion.div>
              <div className="text-sm text-muted-foreground font-medium">Level</div>
            </Card>
            
            <Card className="p-6 text-center bg-white/70 backdrop-blur-sm border-2 border-white/50 hover:shadow-lg transition-all duration-300">
              <motion.div 
                className="text-3xl font-bold text-pink-600 mb-2"
                animate={{ scale: score > 0 ? [1, 1.2, 1] : 1 }}
                transition={{ duration: 0.5 }}
                key={score}
              >
                {score}
              </motion.div>
              <div className="text-sm text-muted-foreground font-medium">Score</div>
            </Card>
            
            <Card className="p-6 text-center bg-white/70 backdrop-blur-sm border-2 border-white/50 hover:shadow-lg transition-all duration-300">
              <motion.div 
                className="text-3xl font-bold text-blue-600 mb-2"
                animate={{ scale: sequence.length > 0 ? [1, 1.1, 1] : 1 }}
                transition={{ duration: 0.3 }}
              >
                {sequence.length}
              </motion.div>
              <div className="text-sm text-muted-foreground font-medium">Sequence</div>
            </Card>
          </motion.div>

          {/* Progress */}
          <AnimatePresence>
            {gameState === 'playing' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="p-4 bg-white/70 backdrop-blur-sm border-2 border-white/50">
                  <div className="flex justify-between text-sm mb-3 font-medium">
                    <span>Progress</span>
                    <span>{playerSequence.length} / {sequence.length}</span>
                  </div>
                  <Progress 
                    value={(playerSequence.length / sequence.length) * 100} 
                    className="h-3"
                  />
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success Message */}
          <AnimatePresence>
            {showSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -20 }}
                transition={{ type: "spring", damping: 15 }}
                className="text-center p-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl shadow-lg"
              >
                <Sparkles className="h-8 w-8 mx-auto mb-2" />
                <p className="text-lg font-bold">Perfect! Moving to next level...</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Game Grid */}
          <Card className="p-8 bg-white/70 backdrop-blur-sm border-2 border-white/50 shadow-xl">
            <motion.div 
              className="grid grid-cols-3 gap-4 mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, staggerChildren: 0.1 }}
            >
              {cards.map((index) => (
                <motion.div
                  key={index}
                  className={getCardStyle(index)}
                  onClick={() => handleCardClick(index)}
                  variants={cardVariants}
                  initial="hidden"
                  animate={activeCard === index ? "active" : "visible"}
                  whileHover={gameState === 'playing' ? { scale: 1.05 } : {}}
                  whileTap={gameState === 'playing' ? { scale: 0.95 } : {}}
                >
                  {activeCard === index && (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="text-4xl"
                    >
                      ✨
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </motion.div>

            {/* Game Controls */}
            <div className="flex flex-col items-center space-y-4">
              <AnimatePresence mode="wait">
                {gameState === 'ready' && (
                  <motion.div
                    key="ready"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="text-center"
                  >
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button 
                        onClick={startGame} 
                        className="gap-3 px-8 py-4 text-lg bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-full shadow-lg"
                      >
                        <Trophy className="h-5 w-5" />
                        Start Challenge
                      </Button>
                    </motion.div>
                  </motion.div>
                )}
                
                {gameState === 'showing' && (
                  <motion.div
                    key="showing"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="text-center"
                  >
                    <div className="text-xl font-bold mb-2 text-gradient">
                      Watch carefully! 👀
                    </div>
                    <div className="text-muted-foreground">
                      Showing {showingIndex + 1} of {sequence.length}
                    </div>
                    <motion.div 
                      className="w-2 h-2 bg-blue-500 rounded-full mx-auto mt-2 breathing-pulse"
                    />
                  </motion.div>
                )}
                
                {gameState === 'playing' && (
                  <motion.div
                    key="playing"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="text-center"
                  >
                    <div className="text-xl font-bold text-gradient mb-2">
                      Your turn! 🎯
                    </div>
                    <div className="text-muted-foreground">
                      Click the cards in the same order
                    </div>
                  </motion.div>
                )}
                
                {gameState === 'finished' && (
                  <motion.div
                    key="finished"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="text-center space-y-6"
                  >
                    <div className="p-6 bg-gradient-to-r from-blue-100 to-purple-100 rounded-2xl">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring" }}
                      >
                        <Target className="h-12 w-12 mx-auto mb-4 text-purple-600" />
                      </motion.div>
                      <div className="text-2xl font-bold text-gradient mb-2">
                        Game Complete! 🎉
                      </div>
                      <div className="text-muted-foreground">
                        You reached level <span className="font-bold text-purple-600">{currentLevel}</span> with a score of <span className="font-bold text-pink-600">{score}</span>
                      </div>
                    </div>
                    
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button 
                        onClick={resetGame} 
                        className="gap-3 px-8 py-4 text-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-full shadow-lg"
                      >
                        <RotateCcw className="h-5 w-5" />
                        Play Again
                      </Button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>
        </motion.div>
      </main>
    </div>
  );
};

export default MemoryChallenge;
