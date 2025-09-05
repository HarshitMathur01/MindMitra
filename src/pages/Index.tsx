import Header from "@/components/layout/Header";
import WelcomeHero from "@/components/sections/WelcomeHero";
import FeaturesPreview from "@/components/sections/FeaturesPreview";
import ChatInterface from "@/components/chat/ChatInterface";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Brain, MessageSquare } from "lucide-react";
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
        
        {/* Interactive Chat Section */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Start Your Conversation
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Begin chatting with your AI psychology assistant right now. Ask questions, 
                get insights, or explore your mental wellness journey.
              </p>
            </div>
            
            <div className="max-w-4xl mx-auto">
              {user ? (
                <ChatInterface />
              ) : (
                <div className="text-center py-12 gradient-chat rounded-xl border">
                  <MessageSquare className="h-16 w-16 text-primary mx-auto mb-6" />
                  <h3 className="text-xl font-semibold mb-4">Sign in to start chatting</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Create an account or sign in to save your conversations and get personalized insights.
                  </p>
                  <Button 
                    onClick={() => navigate('/auth')} 
                    className="gradient-primary hover-glow"
                  >
                    Get Started
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>

        <FeaturesPreview />
      </main>
    </div>
  );
};

export default Index;
