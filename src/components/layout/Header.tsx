import { MessageSquare, Puzzle, BookOpen, LogOut, User, Stethoscope, Menu, X, Settings, Users, GraduationCap, ChevronDown, CircleUserRound, Gamepad2, Dumbbell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import { useScrollAnimations } from "@/hooks/useScrollAnimations";
import { useState, useRef, useEffect } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { scrollY, scrollDirection } = useScrollAnimations();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [weCircleOpen, setWeCircleOpen] = useState(false);
  const [mobileWeCircleOpen, setMobileWeCircleOpen] = useState(false);
  const [moodArcadeOpen, setMoodArcadeOpen] = useState(false);
  const [mobileMoodArcadeOpen, setMobileMoodArcadeOpen] = useState(false);
  const weCircleRef = useRef<HTMLDivElement>(null);
  const moodArcadeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (weCircleRef.current && !weCircleRef.current.contains(e.target as Node)) {
        setWeCircleOpen(false);
      }
      if (moodArcadeRef.current && !moodArcadeRef.current.contains(e.target as Node)) {
        setMoodArcadeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const weCircleItems = [
    { label: 'Therapist Bridge', icon: Stethoscope, path: '/therapist-bridge' },
    { label: 'Peer Support', icon: Users, path: '/peer-support' },
    { label: 'Resources', icon: GraduationCap, path: '/psychological-content' },
  ];

  const moodArcadeItems = [
    { label: 'MindGym', icon: Dumbbell, path: '/mindgym' },
    { label: 'Games', icon: Puzzle, path: '/games' },
    { label: 'Q&A Tests', icon: BookOpen, path: '/qa-tests' },
  ];

  const navItems = [
    { label: 'Chat', icon: MessageSquare, path: '/chat' },
  ];

  return (
    <motion.header
      className="border-b bg-card/95 sticky top-0 z-50 transition-all duration-300"
      initial={{ y: 0, opacity: 1 }}
      animate={{
        y: scrollDirection === 'down' && scrollY > 100 ? -100 : 0,
        opacity: scrollDirection === 'down' && scrollY > 100 ? 0.95 : 1
      }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
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
              className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden"
              whileHover={{ rotate: 5, scale: 1.1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <img src="/image.png" alt="MindMitra Logo" className="w-10 h-10 object-contain" />
            </motion.div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                MindMitra
              </h1>
              <p className="text-xs text-muted-foreground">Your Wellness Companion</p>
            </div>
          </motion.div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {/* WeCircle Dropdown */}
            <div className="relative" ref={weCircleRef}>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="ghost"
                  className={`gap-2 transition-all duration-300 text-sm relative ${weCircleItems.some(i => location.pathname === i.path)
                    ? 'bg-primary/15 text-primary font-semibold'
                    : 'hover:bg-primary/10'
                    }`}
                  onClick={() => setWeCircleOpen(prev => !prev)}
                >
                  <CircleUserRound className="h-4 w-4" />
                  WeCircle
                  <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${weCircleOpen ? 'rotate-180' : ''}`} />
                  {weCircleItems.some(i => location.pathname === i.path) && (
                    <motion.span
                      className="absolute inset-x-2 bottom-0.5 h-0.5 rounded-full bg-primary"
                      layoutId="activeNavUnderline"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </Button>
              </motion.div>
              <AnimatePresence>
                {weCircleOpen && (
                  <motion.div
                    className="absolute top-full left-0 mt-1 w-48 rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-lg z-50 overflow-hidden"
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                  >
                    {weCircleItems.map((item) => {
                      const isActive = location.pathname === item.path;
                      return (
                        <button
                          key={item.path}
                          onClick={() => { navigate(item.path); setWeCircleOpen(false); }}
                          className={`flex items-center gap-3 w-full px-4 py-3 text-sm transition-colors ${isActive
                            ? 'bg-primary/15 text-primary font-semibold'
                            : 'text-muted-foreground hover:bg-primary/10'
                            }`}
                        >
                          <item.icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-primary/70'}`} />
                          {item.label}
                          {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mood Arcade Dropdown */}
            <div className="relative" ref={moodArcadeRef}>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="ghost"
                  className={`gap-2 transition-all duration-300 text-sm relative ${moodArcadeItems.some(i => location.pathname === i.path)
                    ? 'bg-primary/15 text-primary font-semibold'
                    : 'hover:bg-primary/10'
                    }`}
                  onClick={() => setMoodArcadeOpen(prev => !prev)}
                >
                  <Gamepad2 className="h-4 w-4" />
                  Mood Arcade
                  <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${moodArcadeOpen ? 'rotate-180' : ''}`} />
                  {moodArcadeItems.some(i => location.pathname === i.path) && (
                    <motion.span
                      className="absolute inset-x-2 bottom-0.5 h-0.5 rounded-full bg-primary"
                      layoutId="activeNavUnderline"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </Button>
              </motion.div>
              <AnimatePresence>
                {moodArcadeOpen && (
                  <motion.div
                    className="absolute top-full left-0 mt-1 w-48 rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-lg z-50 overflow-hidden"
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                  >
                    {moodArcadeItems.map((item) => {
                      const isActive = location.pathname === item.path;
                      return (
                        <button
                          key={item.path}
                          onClick={() => { navigate(item.path); setMoodArcadeOpen(false); }}
                          className={`flex items-center gap-3 w-full px-4 py-3 text-sm transition-colors ${isActive
                            ? 'bg-primary/15 text-primary font-semibold'
                            : 'text-muted-foreground hover:bg-primary/10'
                            }`}
                        >
                          <item.icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-primary/70'}`} />
                          {item.label}
                          {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

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
                        className="absolute inset-x-2 bottom-0.5 h-0.5 rounded-full bg-primary"
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
              className="md:hidden p-2 rounded-lg hover:bg-background transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <ThemeToggle />
            {user ? (
              <div className="flex items-center gap-3">
                <motion.div
                  className="flex items-center gap-2 cursor-pointer rounded-xl px-2 py-1 hover:bg-primary/10 transition-colors duration-200"
                  onClick={() => navigate('/profile')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  title="View your profile"
                >
                  <Avatar className="h-8 w-8 ring-2 ring-primary/20 hover:ring-primary/50 transition-all duration-200">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                      {user.email?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:block">
                    <p className="text-xs text-muted-foreground leading-none mb-0.5">Signed in as</p>
                    <span className="text-sm font-medium leading-none">
                      {user.email?.split('@')[0]}
                    </span>
                  </div>
                </motion.div>
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
            className="md:hidden border-t border-border bg-surface/95 backdrop-blur-md"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="container mx-auto px-4 py-3 space-y-1">
              {/* WeCircle collapsible in mobile */}
              <div>
                <button
                  onClick={() => setMobileWeCircleOpen(prev => !prev)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${weCircleItems.some(i => location.pathname === i.path)
                    ? 'bg-primary/15 text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-primary/10'
                    }`}
                >
                  <CircleUserRound className="h-4 w-4 text-primary/70" />
                  WeCircle
                  <ChevronDown className={`h-3 w-3 ml-auto transition-transform duration-200 ${mobileWeCircleOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {mobileWeCircleOpen && (
                    <motion.div
                      className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-primary/20 pl-3"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {weCircleItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                          <button
                            key={item.path}
                            onClick={() => { navigate(item.path); setMobileMenuOpen(false); setMobileWeCircleOpen(false); }}
                            className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors ${isActive
                              ? 'bg-primary/15 text-primary font-semibold'
                              : 'text-muted-foreground hover:bg-primary/10'
                              }`}
                          >
                            <item.icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-primary/70'}`} />
                            {item.label}
                            {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Mood Arcade collapsible in mobile */}
              <div>
                <button
                  onClick={() => setMobileMoodArcadeOpen(prev => !prev)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${moodArcadeItems.some(i => location.pathname === i.path)
                    ? 'bg-primary/15 text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-primary/10'
                    }`}
                >
                  <Gamepad2 className="h-4 w-4 text-primary/70" />
                  Mood Arcade
                  <ChevronDown className={`h-3 w-3 ml-auto transition-transform duration-200 ${mobileMoodArcadeOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {mobileMoodArcadeOpen && (
                    <motion.div
                      className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-primary/20 pl-3"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {moodArcadeItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                          <button
                            key={item.path}
                            onClick={() => { navigate(item.path); setMobileMenuOpen(false); setMobileMoodArcadeOpen(false); }}
                            className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors ${isActive
                              ? 'bg-primary/15 text-primary font-semibold'
                              : 'text-muted-foreground hover:bg-primary/10'
                              }`}
                          >
                            <item.icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-primary/70'}`} />
                            {item.label}
                            {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive
                      ? 'bg-primary/15 text-primary font-semibold'
                      : 'text-muted-foreground hover:bg-primary/10'
                      }`}
                  >
                    <item.icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-primary/70'}`} />
                    {item.label}
                    {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                  </button>
                );
              })}
              {user && (
                <>
                  <div className="border-t border-border my-1" />
                  <button
                    onClick={() => { navigate('/profile'); setMobileMenuOpen(false); }}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${location.pathname === '/profile' ? 'bg-primary/15 text-primary font-semibold' : 'text-muted-foreground hover:bg-primary/10'
                      }`}
                  >
                    <User className="h-4 w-4 text-primary/70" />
                    My Profile
                  </button>
                  <button
                    onClick={() => { navigate('/settings'); setMobileMenuOpen(false); }}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${location.pathname === '/settings' ? 'bg-primary/15 text-primary font-semibold' : 'text-muted-foreground hover:bg-primary/10'
                      }`}
                  >
                    <Settings className="h-4 w-4 text-primary/70" />
                    Settings
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};

export default Header;