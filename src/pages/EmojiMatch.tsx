import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import Confetti from "react-confetti";
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
  const audio = new Audio(file);
  audio.play();
};

const EmojiMatch = () => {
  const navigate = useNavigate();
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [time, setTime] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameWon, setGameWon] = useState(false);

  const emojis = ["😁", "🥰", "😅", "😆", "😉", "🤩", "😋", "😎"];

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
    if (matches === emojis.length) {
      setGameWon(true);
      setGameStarted(false);
      playSound("/sounds/win.mp3");
    }
  }, [matches]);

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
    <div className="min-h-screen relative bg-gradient-to-br from-pink-100 via-yellow-100 to-indigo-100 dark:from-gray-900 dark:via-purple-900 dark:to-pink-900">
      <Header />
      {gameWon && <Confetti recycle={false} numberOfPieces={400} />}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/games")}
            className="gap-2 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Games
          </Button>

          <div className="text-center mb-8">
            <h1 className="text-5xl font-extrabold mb-4 bg-gradient-to-r from-pink-500 via-yellow-500 to-indigo-500 bg-clip-text text-transparent drop-shadow-lg">
              Emoji Match
            </h1>
            <p className="text-lg text-muted-foreground mb-6">
              Flip the cards and find all the matching emoji pairs!
            </p>

            <div className="flex justify-center gap-8 mb-6">
              <div className="text-center">
                <div className="text-3xl font-extrabold text-pink-600">{moves}</div>
                <div className="text-sm text-muted-foreground">Moves</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-extrabold text-yellow-600">{formatTime(time)}</div>
                <div className="text-sm text-muted-foreground">Time</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-extrabold text-indigo-600">{matches}/{emojis.length}</div>
                <div className="text-sm text-muted-foreground">Matches</div>
              </div>
            </div>

            <Button
              onClick={initializeGame}
              className="gap-2 bg-pink-500 hover:bg-pink-600 text-white shadow-lg"
            >
              <RotateCcw className="h-4 w-4" />
              New Game
            </Button>
          </div>

          <Dialog open={gameWon} onOpenChange={setGameWon}>
            <DialogContent className="sm:max-w-md rounded-2xl shadow-2xl border-2 border-pink-400 bg-gradient-to-r from-pink-100 via-yellow-100 via-green-100 to-indigo-200">
              <DialogHeader>
                <DialogTitle className="text-3xl font-extrabold text-black-700 text-center drop-shadow-md">
                  Congratulations!
                </DialogTitle>
                <DialogDescription className="text-center text-lg text-black-800 font-semibold mt-2">
                  You completed the game!
                </DialogDescription>
              </DialogHeader>

              <div className="text-center mt-4 space-y-2">
                <p className="text-xl text-indigo-700">
                  Moves: <span className="font-bold">{moves}</span>
                </p>
                <p className="text-xl text-indigo-700">
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

          <div className="grid grid-cols-4 gap-4 max-w-md mx-auto">
            {cards.map((card) => (
              <Card
                key={card.id}
                className={`
                  aspect-square flex items-center justify-center text-3xl cursor-pointer
                  transition-all duration-500 hover:scale-110 hover:rotate-3
                  border-4 rounded-2xl shadow-lg
                  ${card.isFlipped || card.isMatched
                    ? "bg-gradient-to-br from-yellow-100 via-pink-100 to-purple-100 border-pink-400"
                    : "bg-gradient-to-br from-indigo-200 via-purple-200 to-pink-200 border-indigo-300 hover:border-pink-400"
                  }
                  ${card.isMatched ? "opacity-75 scale-105" : ""}
                `}
                onClick={() => handleCardClick(card.id)}
              >
                {card.isFlipped || card.isMatched ? (
                  <span className="text-3xl">{card.emoji}</span>
                ) : (
                  <span className="text-indigo-600 text-2xl">?</span>
                )}
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default EmojiMatch;
