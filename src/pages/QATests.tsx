import Header from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Brain, Heart, Users, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const QATests = () => {
  const navigate = useNavigate();

  const tests = [
    {
      id: "personality",
      title: "Big Five Personality Test",
      description: "Discover your personality traits across five key dimensions",
      icon: Brain,
      duration: "10-15 min",
      questions: 44,
      available: true,
    },
    {
      id: "wellbeing",
      title: "Mental Well-being Assessment", 
      description: "Evaluate your current mental health and wellness state",
      icon: Heart,
      duration: "8-12 min",
      questions: 32,
      available: true,
    },
    {
      id: "social",
      title: "Social Intelligence Quiz",
      description: "Assess your ability to understand and navigate social situations",
      icon: Users,
      duration: "12-18 min", 
      questions: 28,
      available: false,
    },
    {
      id: "cognitive",
      title: "Cognitive Style Assessment",
      description: "Learn about your thinking patterns and decision-making style",
      icon: BookOpen,
      duration: "15-20 min",
      questions: 36,
      available: false,
    },
  ];

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
            Psychological Q&A Tests
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Take scientifically-backed assessments to gain insights into your personality, 
            mental well-being, and psychological patterns.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {tests.map((test) => {
            const Icon = test.icon;
            return (
              <Card key={test.id} className="p-6 hover-lift">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{test.title}</h3>
                      {!test.available && (
                        <span className="bg-accent/20 text-accent text-xs px-2 py-1 rounded-full">
                          Coming Soon
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-sm mb-3">
                      {test.description}
                    </p>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>⏱️ {test.duration}</span>
                      <span>❓ {test.questions} questions</span>
                    </div>
                  </div>
                </div>
                
                <Button 
                  className="w-full"
                  disabled={!test.available}
                  variant={test.available ? "default" : "ghost"}
                >
                  {test.available ? "Start Test" : "Coming Soon"}
                </Button>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default QATests;