import Header from "@/components/layout/Header";
import WelcomeHero from "@/components/sections/WelcomeHero";
import FeaturesPreview from "@/components/sections/FeaturesPreview";
import StatsSection from "@/components/sections/StatsSection";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Brain, MessageSquare, ArrowRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Brain className="h-12 w-12 text-primary mx-auto mb-4 pulse-gentle" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <WelcomeHero />
        
        {/* Advanced Chat Call-to-Action */}
        <section className="py-20 bg-gradient-to-br from-primary/5 via-accent/5 to-background">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Experience Advanced AI Psychology Chat
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Dive deep into personalized conversations with our enhanced AI assistant. 
                Get professional insights, explore your mental wellness, and track your progress.
              </p>
            </div>
            
            <div className="max-w-4xl mx-auto">
              <div className="grid md:grid-cols-2 gap-8 mb-12">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="font-semibold">Advanced Features</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Voice input and transcription</li>
                    <li>• Message search and organization</li>
                    <li>• Quick topic categories</li>
                    <li>• Conversation history</li>
                  </ul>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center">
                      <Brain className="h-4 w-4 text-accent" />
                    </div>
                    <h3 className="font-semibold">Psychology Focus</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Mental health insights</li>
                    <li>• Personality analysis</li>
                    <li>• Stress management guidance</li>
                    <li>• Therapeutic techniques</li>
                  </ul>
                </div>
              </div>
              
              <div className="text-center">
                {user ? (
                  <Button 
                    onClick={() => navigate('/chat')} 
                    className="gradient-primary hover-glow text-lg px-8 py-6 h-auto"
                  >
                    <MessageSquare className="h-5 w-5 mr-2" />
                    Start Advanced Chat
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <Button 
                      onClick={() => navigate('/auth')} 
                      className="gradient-primary hover-glow text-lg px-8 py-6 h-auto"
                    >
                      Sign In to Start Chatting
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Create a free account to save your conversations and get personalized insights
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <StatsSection />
        <FeaturesPreview />
      </main>
    </div>
  );
};

export default Index;
