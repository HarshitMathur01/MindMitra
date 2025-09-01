import { Brain, MessageSquare, Puzzle, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Header = () => {
  const navigate = useNavigate();

  return (
    <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Brain className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                MindMate
              </h1>
              <p className="text-xs text-muted-foreground">AI & Psychology Hub</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-2">
            <Button variant="ghost" className="gap-2" onClick={() => navigate('/')}>
              <MessageSquare className="h-4 w-4" />
              Chat
            </Button>
            <Button variant="ghost" className="gap-2" onClick={() => navigate('/qa-tests')}>
              <BookOpen className="h-4 w-4" />
              Q&A Tests
            </Button>
            <Button variant="ghost" className="gap-2" onClick={() => navigate('/games')}>
              <Puzzle className="h-4 w-4" />
              Games
            </Button>
          </nav>

          {/* CTA */}
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm">
              Sign In
            </Button>
            <Button size="sm" className="gradient-primary hover-glow">
              Get Started
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;