import { Brain, MessageSquare, Puzzle, BookOpen, LogOut, User, Stethoscope, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import { useScrollAnimations } from "@/hooks/useScrollAnimations";
import { useState } from "react";

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { scrollY, scrollDirection } = useScrollAnimations();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'Therapist Bridge', icon: Stethoscope, path: '/therapist-bridge' },
    { label: 'Chat', icon: MessageSquare, path: '/chat' },
    { label: 'Q&A Tests', icon: BookOpen, path: '/qa-tests' },
    { label: 'Games', icon: Puzzle, path: '/games' },
  ];

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
                MindMitra
              </h1>
              <p className="text-xs text-muted-foreground">Your Wellness Companion</p>
            </div>
          </motion.div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <motion.div key={item.path} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    variant="ghost"
                    className={`gap-2 transition-all duration-300 text-sm relative ${isActive
                        ? 'bg-primary/15 text-primary font-semibold'
                        : 'hover:bg-primary/10'
                      }`}
                    onClick={() => navigate(item.path)}
                  >
                    <item.icon className={`h-4 w-4 ${isActive ? 'text-primary' : ''}`} />
                    {item.label}
                    {isActive && (
                      <motion.span
                        className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-4/5 rounded-full bg-gradient-to-r from-primary to-accent"
                        layoutId="activeNavUnderline"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                  </Button>
                </motion.div>
              );
            })}
          </nav>

          {/* Right: Auth + Mobile Toggle */}
          <div className="flex items-center gap-3">
            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-bold">
                      {user.email?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:block">
                    <p className="text-xs text-muted-foreground leading-none mb-0.5">Signed in as</p>
                    <span className="text-sm font-medium leading-none">
                      {user.email?.split('@')[0]}
                    </span>
                  </div>
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

      {/* Mobile Navigation Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="md:hidden border-t bg-white/95 backdrop-blur-md"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="container mx-auto px-4 py-3 space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive
                        ? 'bg-primary/15 text-primary font-semibold'
                        : 'text-gray-700 hover:bg-primary/10'
                      }`}
                  >
                    <item.icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-primary/70'}`} />
                    {item.label}
                    {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};

export default Header;