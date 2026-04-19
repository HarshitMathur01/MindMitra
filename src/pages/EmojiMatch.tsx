import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import Confetti from "react-confetti";
import { useGameDataSaver } from "@/lib/gameDataSaver";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Card {
  id: number;
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
}

const playSound = (file: string) => {
  try {
    const audio = new Audio(file);
    audio.play().catch(() => { });
  } catch (e) {
    // Ignore audio errors silently
  }
};

const EMOJIS = ["😁", "🥰", "😅", "😆", "😉", "🤩", "😋", "😎"];

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

  const initializeGame = useCallback(() => {
    const shuffledEmojis = [...EMOJIS, ...EMOJIS]
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
    if (matches > 0 && matches === EMOJIS.length) {
      setGameWon(true);
      setGameStarted(false);
      playSound("/sounds/win.mp3");

      // Save game result — all pairs matched
      const efficiencyScore = Math.max(0, 100 - (moves - EMOJIS.length) * 5);

      if (saveEmojiMatch) {
        saveEmojiMatch(
          efficiencyScore,     // score based on move efficiency
          matches,             // correctClassifications = matched pairs
          EMOJIS.length,       // totalImages = total pairs
          time,                // duration in seconds
          [],                  // no classification data for card matching
        ).catch((err) => console.error('Failed to save EmojiMatch result:', err));
      }
    }
  }, [matches, moves, time, saveEmojiMatch]);

  const handleCardClick = (cardId: number) => {
    if (!gameStarted) setGameStarted(true);

    const card = cards.find((c) => c.id === cardId);
    if (!card || card.isFlipped || card.isMatched || flippedCards.length === 2) {
      return;
    }

    playSound("/sounds/flip.mp3");

    const newFlippedCards = [...flippedCards, cardId];
    setFlippedCards(newFlippedCards);

    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, isFlipped: true } : c))
    );

    if (newFlippedCards.length === 2) {
      setMoves((prev) => prev + 1);

      const [firstId, secondId] = newFlippedCards;
      const firstCard = cards.find((c) => c.id === firstId);
      const secondCard = cards.find((c) => c.id === secondId);

      if (firstCard?.emoji === secondCard?.emoji) {
        setTimeout(() => {
          playSound("/sounds/match.mp3");
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
          playSound("/sounds/wrong.mp3");
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
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col relative bg-background text-foreground transition-colors duration-300">
      <Header />
      {gameWon && <Confetti recycle={false} numberOfPieces={400} />}
      <main className="flex-1 container mx-auto px-4 py-2 flex flex-col items-center justify-center overflow-hidden">
        <div className="w-full max-w-2xl mx-auto flex flex-col items-center h-full justify-center">
          <div className="w-full flex justify-start mb-2">
            <Button
              variant="ghost"
              onClick={() => navigate("/games")}
              className="gap-2"
              size="sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>

          <div className="text-center w-full mb-4 flex-shrink-0">
            <h1 className="text-3xl sm:text-4xl font-extrabold mb-2 bg-gradient-to-r from-pink-500 via-yellow-500 to-indigo-500 bg-clip-text text-transparent drop-shadow-lg">
              Emoji Match
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mb-4 hidden sm:block">
              Flip the cards and find all the matching emoji pairs!
            </p>

            <div className="flex justify-center gap-4 sm:gap-8 mb-4">
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-extrabold text-pink-600 dark:text-pink-400">{moves}</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Moves</div>
              </div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-extrabold text-yellow-600 dark:text-yellow-400">{formatTime(time)}</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Time</div>
              </div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">{matches}/{EMOJIS.length}</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Matches</div>
              </div>
            </div>

            <Button
              onClick={initializeGame}
              size="sm"
              className="gap-2 bg-pink-500 hover:bg-pink-600 text-white shadow-lg"
            >
              <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4" />
              New Game
            </Button>
          </div>

          <Dialog open={gameWon} onOpenChange={setGameWon}>
            <DialogContent className="sm:max-w-md rounded-2xl shadow-2xl border-2 border-pink-400 dark:border-primary/50 bg-gradient-to-r from-pink-100 via-yellow-100 via-green-100 to-indigo-200 dark:from-surface dark:via-surface dark:to-surface">
              <DialogHeader>
                <DialogTitle className="text-3xl font-extrabold text-foreground text-center drop-shadow-md">
                  Congratulations!
                </DialogTitle>
                <DialogDescription className="text-center text-lg text-muted-foreground font-semibold mt-2">
                  You completed the game!
                </DialogDescription>
              </DialogHeader>

              <div className="text-center mt-4 space-y-2">
                <p className="text-xl text-indigo-700 dark:text-indigo-300">
                  Moves: <span className="font-bold">{moves}</span>
                </p>
                <p className="text-xl text-indigo-700 dark:text-indigo-300">
                  Time: <span className="font-bold">{formatTime(time)}</span>
                </p>
              </div>

              <div className="flex justify-center mt-6">
                <Button
                  onClick={initializeGame}
                  className="bg-yellow-500 hover:bg-indigo-600 text-white shadow-lg"
                >
                  Play Again
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <div className="w-full grid grid-cols-4 gap-2 sm:gap-3 max-w-[260px] sm:max-w-xs md:max-w-[320px] mx-auto perspective-1000 mb-2">
            {cards.map((card, index) => (
              <div
                key={card.id}
                className={`relative aspect-square cursor-pointer group origin-center ${gameWon ? 'animate-bounce' : ''}`}
                style={{
                  perspective: "1000px",
                  animationDelay: gameWon ? `${index * 50}ms` : '0ms'
                }}
                onClick={() => handleCardClick(card.id)}
              >
                <div
                  className="w-full h-full transition-transform duration-300 ease-out"
                  style={{
                    transformStyle: "preserve-3d",
                    transform: card.isFlipped || card.isMatched ? "rotateY(180deg)" : "rotateY(0deg)"
                  }}
                >
                  {/* Front Face (Hidden when Flipped) */}
                  <Card
                    className={`absolute inset-0 flex items-center justify-center border-4 rounded-2xl shadow-lg
                      bg-gradient-to-br from-indigo-200 via-purple-200 to-pink-200 border-indigo-300 dark:from-surface dark:via-background dark:to-surface dark:border-border
                      group-hover:scale-105 group-hover:-translate-y-1 transition-transform duration-300
                    `}
                    style={{ backfaceVisibility: "hidden" }}
                  >
                    <span className="text-indigo-600 dark:text-muted-foreground text-2xl sm:text-3xl font-bold font-sans">?</span>
                  </Card>

                  {/* Back Face (Emoji) */}
                  <Card
                    className={`absolute inset-0 flex items-center justify-center border-4 rounded-2xl shadow-lg
                      bg-gradient-to-br from-yellow-100 via-pink-100 to-purple-100 border-pink-400 dark:from-surface dark:via-primary/10 dark:to-surface dark:border-primary/40
                      ${card.isMatched ? "ring-4 ring-green-400/50 scale-95 opacity-80" : ""}
                    `}
                    style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                  >
                    <span className="text-3xl sm:text-4xl drop-shadow-md transform transition-transform animate-in zoom-in spin-in-12 duration-300">{card.emoji}</span>
                  </Card>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default EmojiMatch;
