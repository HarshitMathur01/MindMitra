import Header from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Puzzle, Brain, Target, Zap, ArrowLeft, Smile, Lock, Sparkles, TrendingUp, Clock, Star, Flame } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useState } from "react";

const Games = () => {
  const navigate = useNavigate();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const games = [
    {
      id: "memory",
      title: "Memory Challenge",
      description: "Test and improve your working memory with pattern recognition games",
      icon: Brain,
      difficulty: "Medium",
      duration: "5-10 min",
      available: true,
      color: "from-blue-400 to-blue-600",
    },
    {
      id: "emoji-match",
      title: "Emoji Match",
      description: "Find all the matching emoji pairs! Improve your memory and concentration skills",
      icon: Smile,
      difficulty: "Easy",
      duration: "3-8 min",
      available: true,
      color: "from-pink-400 to-pink-600",
    },
    {
      id: "emotion-match",
      title: "Emotion Match",
      description: "Match emotions with facial expressions using drag & drop and write your own descriptions",
      icon: Brain,
      difficulty: "Easy",
      duration: "5-10 min",
      available: true,
      color: "from-purple-400 to-purple-600",
    },
    {
      id: "mood-mountain",
      title: "Mood Mountain 🏔️",
      description: "Climb virtual mountains through positive activities and mood regulation exercises",
      icon: Target,
      difficulty: "Easy",
      duration: "10-15 min",
      available: true,
      color: "from-green-400 to-green-600",
    },
    {
      id: "thought-detective",
      title: "Thought Detective 🕵️‍♀️",
      description: "Investigate and reframe negative thoughts using cognitive restructuring techniques",
      icon: Brain,
      difficulty: "Medium",
      duration: "8-12 min",
      available: true,
      color: "from-indigo-400 to-indigo-600",
    },
    {
      id: "balloon",
      title: "Pop the Negativity",
      description: "Pop balloons to reveal positive affirmations and boost your mood",
      icon: Target,
      difficulty: "Easy",
      duration: "15 sec", 
      available: true,
      color: "from-amber-400 to-amber-600",
    },
    {
      id: "decision",
      title: "Decision Making Lab",
      description: "Explore your decision-making patterns through interactive scenarios",
      icon: Target,
      difficulty: "Easy", 
      duration: "8-15 min",
      available: false,
      color: "from-teal-400 to-teal-600",
    },
    {
      id: "reaction",
      title: "Reaction Time Test",
      description: "Measure your cognitive processing speed and attention",
      icon: Zap,
      difficulty: "Easy",
      duration: "3-5 min",
      available: false,
      color: "from-yellow-400 to-yellow-600",
    },
    {
      id: "problem",
      title: "Problem Solving Puzzles",
      description: "Challenge your analytical thinking with psychology-based puzzles",
      icon: Puzzle,
      difficulty: "Hard",
      duration: "10-20 min", 
      available: false,
      color: "from-red-400 to-red-600",
    },
    
  ];

  const getDifficultyConfig = (difficulty: string) => {
    switch (difficulty) {
      case "Easy": 
        return { 
          icon: Star, 
          gradient: "from-green-400 to-emerald-500",
          shadow: "shadow-green-200",
          text: "text-green-700",
          bg: "bg-gradient-to-r from-green-50 to-emerald-50"
        };
      case "Medium": 
        return { 
          icon: Zap, 
          gradient: "from-amber-400 to-orange-500",
          shadow: "shadow-amber-200",
          text: "text-amber-700",
          bg: "bg-gradient-to-r from-amber-50 to-orange-50"
        };
      case "Hard": 
        return { 
          icon: Flame, 
          gradient: "from-red-400 to-rose-500",
          shadow: "shadow-red-200",
          text: "text-red-700",
          bg: "bg-gradient-to-r from-red-50 to-rose-50"
        };
      default: 
        return { 
          icon: Star, 
          gradient: "from-gray-400 to-gray-500",
          shadow: "shadow-gray-200",
          text: "text-gray-700",
          bg: "bg-gray-50"
        };
    }
  };

  const availableGames = games.filter(g => g.available);
  const comingSoonGames = games.filter(g => !g.available);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-purple-50/50">
      <Header />
      
      {/* Animated Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-16">
        {/* Floating decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-10 right-10 w-32 h-32 bg-blue-200/20 rounded-full" />
          <div className="absolute bottom-20 left-20 w-40 h-40 bg-purple-200/15 rounded-full" />
        </div>

        <main className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Button 
              variant="ghost" 
              onClick={() => navigate('/')}
              className="gap-2 mb-6 hover:bg-white/50 transition-all group"
            >
              <motion.div
                whileHover={{ x: -4 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <ArrowLeft className="h-4 w-4" />
              </motion.div>
              Back to Home
            </Button>
            
            <div className="max-w-4xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="inline-flex items-center gap-2 bg-white/40 backdrop-blur-sm rounded-full px-4 py-2 mb-4 border border-white/60"
              >
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Interactive Psychology Games</span>
              </motion.div>

              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent"
              >
                Psychological Games
              </motion.h1>
              
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="text-lg text-gray-700 max-w-2xl mb-6"
              >
                Engage with interactive games designed to provide insights into your cognitive 
                abilities, behavior patterns, and decision-making processes.
              </motion.p>

              {/* Stats Counter */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="flex flex-wrap gap-6 text-sm"
              >
                <div className="flex items-center gap-2 bg-white/80 rounded-lg px-4 py-2 border border-white/60">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="font-semibold text-green-900">{availableGames.length} Games Available</span>
                </div>
                <div className="flex items-center gap-2 bg-white/80 rounded-lg px-4 py-2 border border-white/60">
                  <Lock className="h-4 w-4 text-purple-600" />
                  <span className="font-semibold text-purple-900">{comingSoonGames.length} Coming Soon</span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </main>
      </div>

      {/* Games Grid */}
      <main className="container mx-auto px-4 py-12">
        {/* Available Games */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Available Now</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-12">
            {availableGames.map((game, index) => {
              const Icon = game.icon;
              const difficultyConfig = getDifficultyConfig(game.difficulty);
              const DifficultyIcon = difficultyConfig.icon;
              const isHovered = hoveredCard === game.id;
              
              return (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.6 + index * 0.08 }}
                  onMouseEnter={() => setHoveredCard(game.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{ willChange: 'transform' }}
                  className="group perspective-1000 cursor-pointer"
                >
                  <Card className={`
                    relative p-6 h-full overflow-hidden
                    bg-white/90
                    border-2 transition-all duration-300
                    ${isHovered 
                      ? 'border-transparent shadow-2xl' 
                      : 'border-gray-200 hover:border-gray-300'
                    }
                  `}>

                    <div className="relative z-10">
                      <div className="flex items-start gap-4 mb-4">
                        {/* Animated Icon */}
                        <motion.div 
                          className={`relative w-14 h-14 bg-gradient-to-br ${game.color} rounded-xl flex items-center justify-center shadow-lg`}
                          whileHover={{ 
                            rotate: [0, -5, 5, 0],
                            scale: 1.1
                          }}
                          transition={{ duration: 0.5 }}
                        >
                          <Icon className="h-7 w-7 text-white" />
                        </motion.div>
                        
                        <div className="flex-1">
                          <h3 className="font-bold text-lg mb-2 text-gray-900 group-hover:text-blue-600 transition-colors">
                            {game.title}
                          </h3>
                          <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                            {game.description}
                          </p>
                        </div>
                      </div>
                      
                      {/* Enhanced Badges */}
                      <div className="flex items-center gap-3 mb-4">
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded-full
                            ${difficultyConfig.bg}
                            border border-${difficultyConfig.text.replace('text-', '')}-200
                            shadow-sm ${difficultyConfig.shadow}
                          `}
                        >
                          <DifficultyIcon className={`h-3.5 w-3.5 ${difficultyConfig.text}`} />
                          <span className={`text-xs font-semibold ${difficultyConfig.text}`}>
                            {game.difficulty}
                          </span>
                        </motion.div>
                        
                        <div className="flex items-center gap-1.5 text-gray-500">
                          <Clock className="h-3.5 w-3.5" />
                          <span className="text-xs font-medium">{game.duration}</span>
                        </div>
                      </div>
                      
                      {/* Enhanced Button */}
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Button 
                          className={`
                            w-full bg-gradient-to-r ${game.color}
                            text-white font-semibold shadow-md
                            hover:shadow-xl transition-all duration-300
                            group/btn
                          `}
                          onClick={() => {
                            if (game.id === 'memory') navigate('/memory-challenge');
                            if (game.id === 'emoji-match') navigate('/emoji-match');
                            if (game.id === 'emotion-match') navigate('/emotion-match');
                            if (game.id === 'mood-mountain') navigate('/mood-mountain');
                            if (game.id === 'thought-detective') navigate('/thought-detective');
                            if (game.id === 'balloon') navigate('/balloon-pop');
                          }}
                        >
                          <span>Play Now</span>
                          <span className="inline-block ml-2">→</span>
                        </Button>
                      </motion.div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Coming Soon Games */}
        {comingSoonGames.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1 }}
          >
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Coming Soon</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {comingSoonGames.map((game, index) => {
                const Icon = game.icon;
                const difficultyConfig = getDifficultyConfig(game.difficulty);
                const DifficultyIcon = difficultyConfig.icon;
                
                return (
                  <motion.div
                    key={game.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 1.1 + index * 0.08 }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="group"
                  >
                    <Card className="relative p-6 h-full overflow-hidden bg-white/40 backdrop-blur-sm border-2 border-dashed border-gray-300">
                      {/* Lock Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-br from-gray-50/80 to-gray-100/80 backdrop-blur-[2px] z-10 flex items-center justify-center">
                        <motion.div
                          animate={{ 
                            scale: [1, 1.1, 1],
                            rotate: [0, 5, -5, 0]
                          }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="bg-white/90 p-4 rounded-full shadow-lg"
                        >
                          <Lock className="h-8 w-8 text-gray-400" />
                        </motion.div>
                      </div>

                      <div className="relative opacity-50">
                        <div className="flex items-start gap-4 mb-4">
                          <div className={`w-14 h-14 bg-gradient-to-br ${game.color} rounded-xl flex items-center justify-center opacity-60`}>
                            <Icon className="h-7 w-7 text-white" />
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-bold text-lg text-gray-900">{game.title}</h3>
                              <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full font-medium">
                                Soon
                              </span>
                            </div>
                            <p className="text-gray-600 text-sm mb-3">
                              {game.description}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${difficultyConfig.bg}`}>
                            <DifficultyIcon className={`h-3.5 w-3.5 ${difficultyConfig.text}`} />
                            <span className={`text-xs font-semibold ${difficultyConfig.text}`}>
                              {game.difficulty}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-gray-500">
                            <Clock className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">{game.duration}</span>
                          </div>
                        </div>
                        
                        <Button className="w-full" disabled>
                          Coming Soon
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default Games;