import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";

interface Card {
  id: number;
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
}

const EmojiMatch = () => {
  const navigate = useNavigate();
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [time, setTime] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameWon, setGameWon] = useState(false);

  const emojis = ["🚀", "🎨", "🌟", "🎯", "🎮", "🎭", "🎊", "🎪"];

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
        setTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameStarted, gameWon]);

  useEffect(() => {
    if (matches === emojis.length) {
      setGameWon(true);
      setGameStarted(false);
    }
  }, [matches]);

  const handleCardClick = (cardId: number) => {
    if (!gameStarted) setGameStarted(true);
    
    const card = cards.find(c => c.id === cardId);
    if (!card || card.isFlipped || card.isMatched || flippedCards.length === 2) {
      return;
    }

    const newFlippedCards = [...flippedCards, cardId];
    setFlippedCards(newFlippedCards);

    setCards(prev => prev.map(c => 
      c.id === cardId ? { ...c, isFlipped: true } : c
    ));

    if (newFlippedCards.length === 2) {
      setMoves(prev => prev + 1);
      
      const [firstId, secondId] = newFlippedCards;
      const firstCard = cards.find(c => c.id === firstId);
      const secondCard = cards.find(c => c.id === secondId);

      if (firstCard?.emoji === secondCard?.emoji) {
        // Match found
        setTimeout(() => {
          setCards(prev => prev.map(c => 
            c.id === firstId || c.id === secondId 
              ? { ...c, isMatched: true }
              : c
          ));
          setMatches(prev => prev + 1);
          setFlippedCards([]);
        }, 500);
      } else {
        // No match
        setTimeout(() => {
          setCards(prev => prev.map(c => 
            c.id === firstId || c.id === secondId 
              ? { ...c, isFlipped: false }
              : c
          ));
          setFlippedCards([]);
        }, 1000);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/games')}
            className="gap-2 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Games
          </Button>
          
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              🎮 Emoji Match
            </h1>
            <p className="text-lg text-muted-foreground mb-6">
              Find all the matching emoji pairs!
            </p>
            
            <div className="flex justify-center gap-8 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{moves}</div>
                <div className="text-sm text-muted-foreground">Moves</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{formatTime(time)}</div>
                <div className="text-sm text-muted-foreground">Time</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{matches}/{emojis.length}</div>
                <div className="text-sm text-muted-foreground">Matches</div>
              </div>
            </div>
            
            <Button onClick={initializeGame} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              New Game
            </Button>
          </div>

          {gameWon && (
            <div className="text-center mb-6">
              <Card className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
                <h2 className="text-2xl font-bold text-green-700 dark:text-green-300 mb-2">
                  🎉 Congratulations!
                </h2>
                <p className="text-green-600 dark:text-green-400">
                  You completed the game in {moves} moves and {formatTime(time)}!
                </p>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-4 gap-3 max-w-md mx-auto">
            {cards.map((card) => (
              <Card
                key={card.id}
                className={`
                  aspect-square flex items-center justify-center text-3xl cursor-pointer
                  transition-all duration-300 hover:scale-105
                  ${card.isFlipped || card.isMatched 
                    ? 'bg-primary/10 border-primary/20' 
                    : 'bg-muted hover:bg-muted/80'
                  }
                  ${card.isMatched ? 'opacity-75' : ''}
                `}
                onClick={() => handleCardClick(card.id)}
              >
                {card.isFlipped || card.isMatched ? (
                  <span className="text-2xl">{card.emoji}</span>
                ) : (
                  <span className="text-primary/60 text-xl">?</span>
                )}
              </Card>
            ))}
          </div>

          <div className="text-center mt-8">
            <p className="text-muted-foreground text-sm">
              Click on cards to flip them and find matching pairs. Try to complete the game in as few moves as possible!
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EmojiMatch;