import { Brain, MessageSquare, Puzzle, BookOpen, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import { useScrollAnimations } from "@/hooks/useScrollAnimations";

const Header = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { scrollY, scrollDirection } = useScrollAnimations();

  return (
    <motion.header 
      className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-50 transition-all duration-300"
      initial={{ y: 0, opacity: 1 }}
      animate={{ 
        y: scrollDirection === 'down' && scrollY > 100 ? -100 : 0,
        opacity: scrollDirection === 'down' && scrollY > 100 ? 0.95 : 1
      }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      style={{
        boxShadow: scrollY > 50 ? '0 4px 20px rgba(0,0,0,0.1)' : '0 1px 3px rgba(0,0,0,0.05)'
      }}
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Enhanced Logo with hover animation */}
          <motion.div 
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate('/')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <motion.div 
              className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center"
              whileHover={{ rotate: 5, scale: 1.1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Brain className="h-6 w-6 text-primary-foreground" />
            </motion.div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                MindMate
              </h1>
              <p className="text-xs text-muted-foreground">AI & Psychology Hub</p>
            </div>
          </motion.div>

          {/* Enhanced Navigation with hover effects */}
          <nav className="hidden md:flex items-center gap-2">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button variant="ghost" className="gap-2 hover:bg-primary/10 transition-all duration-300" onClick={() => navigate('/chat')}>
                <MessageSquare className="h-4 w-4" />
                Chat
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button variant="ghost" className="gap-2 hover:bg-primary/10 transition-all duration-300" onClick={() => navigate('/qa-tests')}>
                <BookOpen className="h-4 w-4" />
                Q&A Tests
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button variant="ghost" className="gap-2 hover:bg-primary/10 transition-all duration-300" onClick={() => navigate('/games')}>
                <Puzzle className="h-4 w-4" />
                Games
              </Button>
            </motion.div>
          </nav>

          {/* Auth Section */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {user.email?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium hidden md:inline">
                    {user.email}
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={signOut} className="gap-2">
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => navigate('/auth')}>
                  Sign In
                </Button>
                <Button size="sm" className="gradient-primary hover-glow" onClick={() => navigate('/auth')}>
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.header>
  );
};

export default Header;