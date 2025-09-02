import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, RotateCcw, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";

const MemoryChallenge = () => {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState<'ready' | 'showing' | 'playing' | 'finished'>('ready');
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerSequence, setPlayerSequence] = useState<number[]>([]);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [showingIndex, setShowingIndex] = useState(0);
  const [activeCard, setActiveCard] = useState<number | null>(null);

  const gridSize = 9; // 3x3 grid
  const cards = Array.from({ length: gridSize }, (_, i) => i);

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
    setGameState('showing');
    setShowingIndex(0);
  };

  const resetGame = () => {
    setGameState('ready');
    setSequence([]);
    setPlayerSequence([]);
    setCurrentLevel(1);
    setScore(0);
    setShowingIndex(0);
    setActiveCard(null);
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
      return;
    }

    // Check if sequence complete
    if (newPlayerSequence.length === sequence.length) {
      setScore(prev => prev + currentLevel * 10);
      setCurrentLevel(prev => prev + 1);
      
      setTimeout(() => {
        startGame();
      }, 1000);
    }
  };

  const getCardStyle = (index: number) => {
    const baseStyle = "w-full aspect-square rounded-lg border-2 transition-all duration-300 cursor-pointer flex items-center justify-center text-2xl font-bold";
    
    if (activeCard === index) {
      return `${baseStyle} bg-primary text-primary-foreground border-primary shadow-lg scale-105`;
    }
    
    if (gameState === 'playing') {
      return `${baseStyle} bg-card border-border hover:bg-accent hover:border-accent-foreground`;
    }
    
    return `${baseStyle} bg-muted border-muted cursor-default`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/games')}
            className="gap-2 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Games
          </Button>
          
          <h1 className="text-3xl font-bold mb-2">Memory Challenge</h1>
          <p className="text-muted-foreground">
            Watch the sequence, then repeat it by clicking the cards in the same order.
          </p>
        </div>

        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{currentLevel}</div>
              <div className="text-sm text-muted-foreground">Level</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-accent">{score}</div>
              <div className="text-sm text-muted-foreground">Score</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold">{sequence.length}</div>
              <div className="text-sm text-muted-foreground">Sequence</div>
            </Card>
          </div>

          {/* Progress */}
          {gameState === 'playing' && (
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Progress</span>
                <span>{playerSequence.length} / {sequence.length}</span>
              </div>
              <Progress value={(playerSequence.length / sequence.length) * 100} />
            </div>
          )}

          {/* Game Grid */}
          <Card className="p-6">
            <div className="grid grid-cols-3 gap-3 mb-6">
              {cards.map((index) => (
                <div
                  key={index}
                  className={getCardStyle(index)}
                  onClick={() => handleCardClick(index)}
                >
                  {activeCard === index && '✨'}
                </div>
              ))}
            </div>

            {/* Game Controls */}
            <div className="flex gap-2 justify-center">
              {gameState === 'ready' && (
                <Button onClick={startGame} className="gap-2">
                  <Trophy className="h-4 w-4" />
                  Start Game
                </Button>
              )}
              
              {gameState === 'showing' && (
                <div className="text-center">
                  <div className="text-lg font-semibold mb-2">Watch the sequence!</div>
                  <div className="text-muted-foreground">
                    Showing {showingIndex + 1} of {sequence.length}
                  </div>
                </div>
              )}
              
              {gameState === 'playing' && (
                <div className="text-center">
                  <div className="text-lg font-semibold">Your turn!</div>
                  <div className="text-muted-foreground">Click the cards in order</div>
                </div>
              )}
              
              {gameState === 'finished' && (
                <div className="text-center space-y-4">
                  <div>
                    <div className="text-lg font-semibold">Game Over!</div>
                    <div className="text-muted-foreground">
                      You reached level {currentLevel} with a score of {score}
                    </div>
                  </div>
                  <Button onClick={resetGame} className="gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Play Again
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default MemoryChallenge;