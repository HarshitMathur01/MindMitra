import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, RotateCcw, Brain, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";

interface EmotionCard {
  id: number;
  content: string;
  type: 'emotion' | 'expression' | 'situation' | 'strategy';
  matchGroup: string;
  isFlipped: boolean;
  isMatched: boolean;
}

interface Level {
  id: number;
  name: string;
  description: string;
  cards: Omit<EmotionCard, 'id' | 'isFlipped' | 'isMatched'>[];
}

const EmotionMatch = () => {
  const navigate = useNavigate();
  const [cards, setCards] = useState<EmotionCard[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [time, setTime] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [showEducationalTip, setShowEducationalTip] = useState<string | null>(null);

  const levels: Level[] = [
    {
      id: 1,
      name: "Basic Emotions",
      description: "Match facial expressions with emotion words",
      cards: [
        { content: "😊", type: 'expression', matchGroup: 'happy' },
        { content: "Happy", type: 'emotion', matchGroup: 'happy' },
        { content: "😢", type: 'expression', matchGroup: 'sad' },
        { content: "Sad", type: 'emotion', matchGroup: 'sad' },
        { content: "😠", type: 'expression', matchGroup: 'angry' },
        { content: "Angry", type: 'emotion', matchGroup: 'angry' },
        { content: "😨", type: 'expression', matchGroup: 'scared' },
        { content: "Scared", type: 'emotion', matchGroup: 'scared' },
        { content: "😮", type: 'expression', matchGroup: 'surprised' },
        { content: "Surprised", type: 'emotion', matchGroup: 'surprised' },
        { content: "🤢", type: 'expression', matchGroup: 'disgusted' },
        { content: "Disgusted", type: 'emotion', matchGroup: 'disgusted' },
      ]
    },
    {
      id: 2,
      name: "Complex Emotions",
      description: "Match situations with appropriate emotional responses",
      cards: [
        { content: "Job Interview", type: 'situation', matchGroup: 'anxious' },
        { content: "Anxious", type: 'emotion', matchGroup: 'anxious' },
        { content: "Graduation Day", type: 'situation', matchGroup: 'proud' },
        { content: "Proud", type: 'emotion', matchGroup: 'proud' },
        { content: "Birthday Party", type: 'situation', matchGroup: 'excited' },
        { content: "Excited", type: 'emotion', matchGroup: 'excited' },
        { content: "Missed Opportunity", type: 'situation', matchGroup: 'disappointed' },
        { content: "Disappointed", type: 'emotion', matchGroup: 'disappointed' },
        { content: "First Date", type: 'situation', matchGroup: 'nervous' },
        { content: "Nervous", type: 'emotion', matchGroup: 'nervous' },
        { content: "Helping Others", type: 'situation', matchGroup: 'fulfilled' },
        { content: "Fulfilled", type: 'emotion', matchGroup: 'fulfilled' },
      ]
    },
    {
      id: 3,
      name: "Coping Strategies",
      description: "Match emotions with healthy coping strategies",
      cards: [
        { content: "Stressed", type: 'emotion', matchGroup: 'stress' },
        { content: "Deep Breathing", type: 'strategy', matchGroup: 'stress' },
        { content: "Lonely", type: 'emotion', matchGroup: 'lonely' },
        { content: "Call a Friend", type: 'strategy', matchGroup: 'lonely' },
        { content: "Overwhelmed", type: 'emotion', matchGroup: 'overwhelmed' },
        { content: "Make a To-Do List", type: 'strategy', matchGroup: 'overwhelmed' },
        { content: "Angry", type: 'emotion', matchGroup: 'anger' },
        { content: "Count to Ten", type: 'strategy', matchGroup: 'anger' },
        { content: "Sad", type: 'emotion', matchGroup: 'sadness' },
        { content: "Journal Writing", type: 'strategy', matchGroup: 'sadness' },
        { content: "Restless", type: 'emotion', matchGroup: 'restless' },
        { content: "Go for a Walk", type: 'strategy', matchGroup: 'restless' },
      ]
    }
  ];

  const educationalTips: Record<string, string> = {
    'happy': "Happiness boosts creativity and strengthens social connections!",
    'sad': "Sadness helps us process loss and seek support from others.",
    'angry': "Anger signals that our boundaries may have been crossed.",
    'scared': "Fear helps protect us from potential dangers.",
    'surprised': "Surprise helps us adapt quickly to unexpected changes.",
    'disgusted': "Disgust helps us avoid potentially harmful situations.",
    'anxious': "Anxiety before important events is normal and can help us prepare.",
    'proud': "Pride in achievements motivates us to continue growing.",
    'excited': "Excitement energizes us and makes experiences more memorable.",
    'disappointed': "Disappointment teaches resilience and helps reset expectations.",
    'nervous': "Nervousness shows we care about the outcome.",
    'fulfilled': "Fulfillment comes from aligning actions with our values.",
    'stress': "Deep breathing activates the body's relaxation response.",
    'lonely': "Social connection is a basic human need for mental health.",
    'overwhelmed': "Breaking tasks into smaller steps makes them manageable.",
    'anger': "Pausing before reacting helps us respond more thoughtfully.",
    'sadness': "Writing helps process emotions and gain new perspectives.",
    'restless': "Physical movement releases mood-boosting endorphins."
  };

  const initializeGame = useCallback(() => {
    const levelCards = levels[currentLevel]?.cards || levels[0].cards;
    const shuffledCards = [...levelCards]
      .sort(() => Math.random() - 0.5)
      .map((card, index) => ({
        ...card,
        id: index,
        isFlipped: false,
        isMatched: false,
      }));
    
    setCards(shuffledCards);
    setFlippedCards([]);
    setMoves(0);
    setMatches(0);
    setTime(0);
    setGameStarted(false);
    setGameWon(false);
    setShowEducationalTip(null);
  }, [currentLevel]);

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
    const totalPairs = levels[currentLevel]?.cards.length / 2 || 6;
    if (matches === totalPairs) {
      setGameWon(true);
      setGameStarted(false);
    }
  }, [matches, currentLevel]);

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

      if (firstCard?.matchGroup === secondCard?.matchGroup) {
        // Match found
        setTimeout(() => {
          setCards(prev => prev.map(c => 
            c.id === firstId || c.id === secondId 
              ? { ...c, isMatched: true }
              : c
          ));
          setMatches(prev => prev + 1);
          setFlippedCards([]);
          
          // Show educational tip
          if (firstCard?.matchGroup) {
            setShowEducationalTip(educationalTips[firstCard.matchGroup] || "Great match!");
            setTimeout(() => setShowEducationalTip(null), 3000);
          }
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

  const getCardStyle = (card: EmotionCard) => {
    const baseStyle = "aspect-square flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-105";
    
    if (card.isMatched) {
      return `${baseStyle} bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 opacity-75`;
    }
    
    if (card.isFlipped) {
      if (card.type === 'emotion') {
        return `${baseStyle} bg-primary/10 border-primary/20 text-primary font-semibold`;
      } else if (card.type === 'expression') {
        return `${baseStyle} bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800`;
      } else if (card.type === 'situation') {
        return `${baseStyle} bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800`;
      } else {
        return `${baseStyle} bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800`;
      }
    }
    
    return `${baseStyle} bg-muted hover:bg-muted/80`;
  };

  const getCardContent = (card: EmotionCard) => {
    if (card.isFlipped || card.isMatched) {
      if (card.type === 'expression') {
        return <span className="text-4xl">{card.content}</span>;
      }
      return <span className="text-sm font-medium text-center px-2">{card.content}</span>;
    }
    return <span className="text-primary/60 text-xl">?</span>;
  };

  const nextLevel = () => {
    if (currentLevel < levels.length - 1) {
      setCurrentLevel(prev => prev + 1);
    }
  };

  const previousLevel = () => {
    if (currentLevel > 0) {
      setCurrentLevel(prev => prev - 1);
    }
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
              🧠 Emotion Match Maker
            </h1>
            <p className="text-lg text-muted-foreground mb-6">
              Build emotional intelligence through card matching!
            </p>
            
            {/* Level Selection */}
            <div className="flex justify-center gap-4 mb-6">
              <Button 
                variant="outline" 
                onClick={previousLevel}
                disabled={currentLevel === 0}
                size="sm"
              >
                Previous
              </Button>
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                <span className="font-semibold">Level {currentLevel + 1}: {levels[currentLevel]?.name}</span>
              </div>
              <Button 
                variant="outline" 
                onClick={nextLevel}
                disabled={currentLevel === levels.length - 1}
                size="sm"
              >
                Next
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground mb-6">
              {levels[currentLevel]?.description}
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
                <div className="text-2xl font-bold text-primary">
                  {matches}/{(levels[currentLevel]?.cards.length || 12) / 2}
                </div>
                <div className="text-sm text-muted-foreground">Matches</div>
              </div>
            </div>
            
            <Button onClick={initializeGame} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              New Game
            </Button>
          </div>

          {/* Educational Tip */}
          {showEducationalTip && (
            <div className="text-center mb-6">
              <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-center gap-2 text-blue-700 dark:text-blue-300">
                  <Brain className="h-4 w-4" />
                  <span className="text-sm font-medium">{showEducationalTip}</span>
                </div>
              </Card>
            </div>
          )}

          {gameWon && (
            <div className="text-center mb-6">
              <Card className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Trophy className="h-6 w-6 text-green-600 dark:text-green-400" />
                  <h2 className="text-2xl font-bold text-green-700 dark:text-green-300">
                    Level Complete!
                  </h2>
                </div>
                <p className="text-green-600 dark:text-green-400 mb-4">
                  You completed Level {currentLevel + 1} in {moves} moves and {formatTime(time)}!
                </p>
                {currentLevel < levels.length - 1 && (
                  <Button onClick={nextLevel} className="gap-2">
                    <Brain className="h-4 w-4" />
                    Next Level
                  </Button>
                )}
              </Card>
            </div>
          )}

          <div className="grid grid-cols-3 md:grid-cols-4 gap-3 max-w-2xl mx-auto">
            {cards.map((card) => (
              <Card
                key={card.id}
                className={getCardStyle(card)}
                onClick={() => handleCardClick(card.id)}
              >
                {getCardContent(card)}
              </Card>
            ))}
          </div>

          <div className="text-center mt-8">
            <p className="text-muted-foreground text-sm mb-2">
              Match cards by finding pairs that belong together. Learn about emotions and healthy coping strategies!
            </p>
            <div className="flex justify-center gap-4 text-xs text-muted-foreground">
              <span>🎭 Expressions</span>
              <span>💭 Emotions</span>
              <span>📝 Situations</span>
              <span>🛠️ Strategies</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EmotionMatch;