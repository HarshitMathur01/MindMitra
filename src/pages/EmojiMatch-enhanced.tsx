import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, RotateCcw, Star, Trophy, Timer, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import { useGameDataSaver } from '@/lib/gameDataSaver';

interface Card {
  id: number;
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
}

const EmojiMatch = () => {
  const navigate = useNavigate();
  const { saveEmojiMatch } = useGameDataSaver();

  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [time, setTime] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameWon, setGameWon] = useState(false);

  const emojis = ["🚀", "🎨", "🌟", "🎯", "🎮", "🎭", "🎊", "🎪"];
  
  const handleGameEnd = async (score: number, correct: number, total: number, duration: number) => {
    try {
      await saveEmojiMatch(score, correct, total, duration);
      console.log('✅ Emoji match result saved!');
    } catch (error) {
      console.error('Failed to save game result:', error);
    }
  };

  const initializeGame = useCallback(() => {
    const shuffledEmojis = [...emojis, ...emojis]
      .sort(() => Math.random() - 0.5)
      .map((emoji, index) => ({
        id: index,
        emoji,
        isFlipped: false,
        isMatched: false,
      }));
    
    setCards(shuffledEmojis);
    setFlippedCards([]);
    setMoves(0);
    setMatches(0);
    setTime(0);
    setGameStarted(false);
    setGameWon(false);
  }, []);

  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (gameStarted && !gameWon) {
      interval = setInterval(() => {
        setTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameStarted, gameWon]);

  useEffect(() => {
    if (matches === emojis.length && !gameWon) {
      setGameWon(true);
      const score = Math.max(1000 - moves * 10 - time * 2, 100);
      handleGameEnd(score, matches, emojis.length, time);
    }
  }, [matches, gameWon, moves, time, emojis.length]);

  const handleCardClick = (cardId: number) => {
    if (!gameStarted) setGameStarted(true);
    
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.isFlipped || card.isMatched || flippedCards.length >= 2) {
      return;
    }

    const newFlippedCards = [...flippedCards, cardId];
    setFlippedCards(newFlippedCards);

    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId ? { ...c, isFlipped: true } : c
      )
    );

    if (newFlippedCards.length === 2) {
      setMoves((prev) => prev + 1);
      
      const [firstId, secondId] = newFlippedCards;
      const firstCard = cards.find((c) => c.id === firstId);
      const secondCard = cards.find((c) => c.id === secondId);

      if (firstCard && secondCard && firstCard.emoji === secondCard.emoji) {
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c) =>
              c.id === firstId || c.id === secondId
                ? { ...c, isMatched: true }
                : c
            )
          );
          setMatches((prev) => prev + 1);
          setFlippedCards([]);
        }, 500);
      } else {
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c) =>
              c.id === firstId || c.id === secondId
                ? { ...c, isFlipped: false }
                : c
            )
          );
          setFlippedCards([]);
        }, 1000);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getPerformanceRating = () => {
    if (moves <= 12) return { rating: "Perfect!", color: "text-green-600", icon: Trophy };
    if (moves <= 16) return { rating: "Great!", color: "text-blue-600", icon: Star };
    if (moves <= 20) return { rating: "Good!", color: "text-yellow-600", icon: Target };
    return { rating: "Keep practicing!", color: "text-gray-600", icon: Timer };
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const cardVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: { 
      scale: 1, 
      opacity: 1,
      transition: {
        type: "spring" as const,
        stiffness: 260,
        damping: 20
      }
    },
    flip: {
      rotateY: 180,
      transition: { duration: 0.3 }
    },
    match: {
      scale: [1, 1.1, 1],
      transition: { duration: 0.4 }
    }
  };

  const celebrationVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: {
        type: "spring" as const,
        stiffness: 300,
        damping: 20
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      <Header />
      
      <motion.div 
        className="container mx-auto px-4 py-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/games')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-all duration-300 hover:scale-105"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Games
          </Button>
          
          <motion.h1 
            className="text-3xl font-bold text-gradient"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            🎭 Emoji Memory Match
          </motion.h1>
          
          <Button
            variant="outline"
            onClick={initializeGame}
            className="flex items-center gap-2 bg-white/70 backdrop-blur-sm hover:bg-white/90 transition-all duration-300 hover:scale-105"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>

        {/* Game Stats */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg wellness-card">
            <div className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Target className="h-5 w-5 text-blue-600 mr-2" />
                <span className="font-semibold text-gray-700">Moves</span>
              </div>
              <motion.p 
                className="text-2xl font-bold text-blue-600"
                key={moves}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                {moves}
              </motion.p>
            </div>
          </Card>
          
          <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg wellness-card">
            <div className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Star className="h-5 w-5 text-green-600 mr-2" />
                <span className="font-semibold text-gray-700">Matches</span>
              </div>
              <motion.p 
                className="text-2xl font-bold text-green-600"
                key={matches}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                {matches}/{emojis.length}
              </motion.p>
            </div>
          </Card>
          
          <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg wellness-card">
            <div className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Timer className="h-5 w-5 text-purple-600 mr-2" />
                <span className="font-semibold text-gray-700">Time</span>
              </div>
              <motion.p 
                className="text-2xl font-bold text-purple-600"
                key={time}
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                {formatTime(time)}
              </motion.p>
            </div>
          </Card>
          
          <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg wellness-card">
            <div className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Trophy className="h-5 w-5 text-yellow-600 mr-2" />
                <span className="font-semibold text-gray-700">Progress</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <motion.div 
                  className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(matches / emojis.length) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <p className="text-sm text-gray-600">{Math.round((matches / emojis.length) * 100)}%</p>
            </div>
          </Card>
        </motion.div>

        {/* Game Board */}
        <motion.div 
          className="max-w-2xl mx-auto"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="grid grid-cols-4 gap-4 mb-8">
            <AnimatePresence>
              {cards.map((card, index) => (
                <motion.div
                  key={card.id}
                  variants={cardVariants}
                  initial="hidden"
                  animate={card.isMatched ? "match" : "visible"}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{ 
                    transformStyle: "preserve-3d",
                    transform: card.isFlipped || card.isMatched ? "rotateY(180deg)" : "rotateY(0deg)"
                  }}
                  transition={{ duration: 0.3 }}
                >
                  <Card 
                    className={`aspect-square cursor-pointer transition-all duration-300 ${
                      card.isMatched 
                        ? 'bg-gradient-to-br from-green-100 to-green-200 border-green-300 shadow-lg' 
                        : card.isFlipped 
                          ? 'bg-gradient-to-br from-blue-100 to-purple-100 border-blue-300 shadow-lg' 
                          : 'bg-gradient-to-br from-gray-100 to-gray-200 hover:from-blue-50 hover:to-purple-50 border-gray-300 hover:shadow-md'
                    }`}
                    onClick={() => handleCardClick(card.id)}
                  >
                    <div className="h-full flex items-center justify-center relative" style={{ backfaceVisibility: "hidden" }}>
                      {card.isFlipped || card.isMatched ? (
                        <motion.span 
                          className="text-4xl"
                          initial={{ scale: 0, rotate: 180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          {card.emoji}
                        </motion.span>
                      ) : (
                        <motion.div 
                          className="w-8 h-8 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full breathing-pulse"
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      )}
                      
                      {card.isMatched && (
                        <motion.div
                          className="absolute top-1 right-1"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.2, type: "spring" }}
                        >
                          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs">✓</span>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Victory Modal */}
        <AnimatePresence>
          {gameWon && (
            <motion.div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                variants={celebrationVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6"
                >
                  <Trophy className="h-10 w-10 text-white" />
                </motion.div>
                
                <h2 className="text-3xl font-bold text-gradient mb-4">
                  Congratulations! 🎉
                </h2>
                
                <div className="space-y-3 mb-6">
                  <p className="text-lg text-gray-700">
                    {getPerformanceRating().rating}
                  </p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="font-semibold text-blue-700">Moves</p>
                      <p className="text-2xl text-blue-600">{moves}</p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <p className="font-semibold text-purple-700">Time</p>
                      <p className="text-2xl text-purple-600">{formatTime(time)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <Button
                    onClick={initializeGame}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                  >
                    Play Again
                  </Button>
                  <Button
                    onClick={() => navigate('/games')}
                    variant="outline"
                    className="flex-1"
                  >
                    Back to Games
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default EmojiMatch;
