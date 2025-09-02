import Header from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Puzzle, Brain, Target, Zap, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Games = () => {
  const navigate = useNavigate();

  const games = [
    {
      id: "memory",
      title: "Memory Challenge",
      description: "Test and improve your working memory with pattern recognition games",
      icon: Brain,
      difficulty: "Medium",
      duration: "5-10 min",
      available: true,
    },
    {
      id: "decision",
      title: "Decision Making Lab",
      description: "Explore your decision-making patterns through interactive scenarios",
      icon: Target,
      difficulty: "Easy", 
      duration: "8-15 min",
      available: false,
    },
    {
      id: "reaction",
      title: "Reaction Time Test",
      description: "Measure your cognitive processing speed and attention",
      icon: Zap,
      difficulty: "Easy",
      duration: "3-5 min",
      available: false,
    },
    {
      id: "problem",
      title: "Problem Solving Puzzles",
      description: "Challenge your analytical thinking with psychology-based puzzles",
      icon: Puzzle,
      difficulty: "Hard",
      duration: "10-20 min", 
      available: false,
    },
  ];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Easy": return "text-green-600 bg-green-50";
      case "Medium": return "text-yellow-600 bg-yellow-50";
      case "Hard": return "text-red-600 bg-red-50";
      default: return "text-muted-foreground bg-muted";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="gap-2 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
          
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Psychological Games
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Engage with interactive games designed to provide insights into your cognitive 
            abilities, behavior patterns, and decision-making processes.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {games.map((game) => {
            const Icon = game.icon;
            return (
              <Card key={game.id} className="p-6 hover-lift">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
                    <Icon className="h-6 w-6 text-accent" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{game.title}</h3>
                      {!game.available && (
                        <span className="bg-accent/20 text-accent text-xs px-2 py-1 rounded-full">
                          Coming Soon
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-sm mb-3">
                      {game.description}
                    </p>
                    <div className="flex gap-4 text-xs">
                      <span className={`px-2 py-1 rounded-full ${getDifficultyColor(game.difficulty)}`}>
                        {game.difficulty}
                      </span>
                      <span className="text-muted-foreground">⏱️ {game.duration}</span>
                    </div>
                  </div>
                </div>
                
                <Button 
                  className="w-full"
                  disabled={!game.available}
                  onClick={() => game.available && game.id === 'memory' && navigate('/memory-challenge')}
                >
                  {game.available ? 'Play Now' : 'Coming Soon'}
                </Button>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default Games;