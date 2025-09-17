import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Puzzle, Brain, Target, Zap, ArrowLeft, Smile, Sparkles, Play } from "lucide-react";
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
      color: "from-purple-500 to-pink-500",
      bgGlow: "bg-purple-100",
    },
    {
      id: "emoji-match",
      title: "Emoji Match",
      description: "Find all the matching emoji pairs! Improve your memory and concentration skills",
      icon: Smile,
      difficulty: "Easy",
      duration: "3-8 min",
      available: true,
      color: "from-yellow-500 to-orange-500",
      bgGlow: "bg-yellow-100",
    },
    {
      id: "emotion-match",
      title: "Emotion Match",
      description: "Match emotions with facial expressions using drag & drop and write your own descriptions",
      icon: Brain,
      difficulty: "Easy",
      duration: "5-10 min",
      available: true,
      color: "from-green-500 to-teal-500",
      bgGlow: "bg-green-100",
    },
    {
      id: "mood-mountain",
      title: "Mood Mountain 🏔️",
      description: "Climb virtual mountains through positive activities and mood regulation exercises",
      icon: Target,
      difficulty: "Easy",
      duration: "10-15 min",
      available: true,
      color: "from-blue-500 to-cyan-500",
      bgGlow: "bg-blue-100",
    },
    {
      id: "thought-detective",
      title: "Thought Detective 🕵️‍♀️",
      description: "Investigate and reframe negative thoughts using cognitive restructuring techniques",
      icon: Brain,
      difficulty: "Medium",
      duration: "8-12 min",
      available: true,
      color: "from-indigo-500 to-purple-500",
      bgGlow: "bg-indigo-100",
    },
    {
      id: "decision",
      title: "Decision Making Lab",
      description: "Explore your decision-making patterns through interactive scenarios",
      icon: Target,
      difficulty: "Easy", 
      duration: "8-15 min",
      available: false,
      color: "from-gray-400 to-gray-500",
      bgGlow: "bg-gray-100",
    },
    {
      id: "reaction",
      title: "Reaction Time Test",
      description: "Measure your cognitive processing speed and attention",
      icon: Zap,
      difficulty: "Easy",
      duration: "3-5 min",
      available: false,
      color: "from-gray-400 to-gray-500",
      bgGlow: "bg-gray-100",
    },
    {
      id: "problem",
      title: "Problem Solving Puzzles",
      description: "Challenge your analytical thinking with psychology-based puzzles",
      icon: Puzzle,
      difficulty: "Hard",
      duration: "10-20 min", 
      available: false,
      color: "from-gray-400 to-gray-500",
      bgGlow: "bg-gray-100",
    },
  ];

  const getDifficultyConfig = (difficulty: string) => {
    switch (difficulty) {
      case "Easy": 
        return { 
          color: "text-emerald-700 bg-emerald-100 border-emerald-200", 
          glow: "shadow-emerald-200",
          icon: "🌱"
        };
      case "Medium": 
        return { 
          color: "text-amber-700 bg-amber-100 border-amber-200", 
          glow: "shadow-amber-200",
          icon: "⚡"
        };
      case "Hard": 
        return { 
          color: "text-red-700 bg-red-100 border-red-200", 
          glow: "shadow-red-200",
          icon: "🔥"
        };
      default: 
        return { 
          color: "text-gray-700 bg-gray-100 border-gray-200", 
          glow: "shadow-gray-200",
          icon: "📋"
        };
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const cardVariants = {
    hidden: { 
      opacity: 0, 
      y: 50,
      scale: 0.9
    },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        type: "spring" as const,
        damping: 25,
        stiffness: 300
      }
    }
  };

  const iconVariants = {
    hover: {
      scale: 1.2,
      rotate: 5,
      transition: {
        type: "spring" as const,
        damping: 15,
        stiffness: 400
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="gap-2 mb-6 hover:bg-white/50 transition-all duration-300 hover:scale-105 hover:shadow-md rounded-full px-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
          
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", damping: 15 }}
              className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center breathing-pulse"
            >
              <Sparkles className="h-10 w-10 text-white" />
            </motion.div>
            
            <motion.h1 
              className="text-5xl font-bold mb-4 text-gradient leading-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              Mindful Games
            </motion.h1>
            
            <motion.p 
              className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              Engage with therapeutic games designed to enhance your cognitive abilities, 
              emotional awareness, and mental well-being through playful interaction.
            </motion.p>
          </div>
        </motion.div>

        <motion.div 
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <AnimatePresence>
            {games.map((game, index) => {
              const Icon = game.icon;
              const difficultyConfig = getDifficultyConfig(game.difficulty);
              
              return (
                <motion.div
                  key={game.id}
                  variants={cardVariants}
                  layout
                  whileHover={{ 
                    y: -8,
                    transition: { duration: 0.3 }
                  }}
                  className="group"
                >
                  <Card className="p-6 h-full bg-white/70 backdrop-blur-sm border-2 border-white/50 hover:border-white/80 transition-all duration-500 hover:shadow-2xl relative overflow-hidden wellness-card">
                    {/* Background Glow Effect */}
                    <div className={`absolute inset-0 ${game.bgGlow} opacity-0 group-hover:opacity-20 transition-opacity duration-500`} />
                    
                    {/* Available Badge */}
                    {game.available && (
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: index * 0.1 + 0.5, type: "spring" }}
                        className="absolute top-4 right-4 w-3 h-3 bg-green-400 rounded-full shadow-lg breathing-pulse"
                      />
                    )}

                    <div className="relative z-10">
                      {/* Icon */}
                      <motion.div 
                        className={`w-16 h-16 bg-gradient-to-r ${game.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg`}
                        variants={iconVariants}
                        whileHover="hover"
                      >
                        <Icon className="h-8 w-8 text-white" />
                      </motion.div>

                      {/* Content */}
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                          <h3 className="font-bold text-xl text-gray-800 group-hover:text-gradient transition-all duration-300">
                            {game.title}
                          </h3>
                          {!game.available && (
                            <motion.span 
                              className="bg-amber-100 text-amber-700 text-xs px-3 py-1 rounded-full border border-amber-200 font-medium"
                              animate={{ scale: [1, 1.05, 1] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            >
                              Coming Soon
                            </motion.span>
                          )}
                        </div>
                        
                        <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                          {game.description}
                        </p>
                        
                        <div className="flex flex-wrap gap-3 text-xs">
                          <motion.span 
                            className={`px-3 py-2 rounded-full border ${difficultyConfig.color} ${difficultyConfig.glow} font-medium flex items-center gap-1`}
                            whileHover={{ scale: 1.05 }}
                            transition={{ type: "spring", damping: 15 }}
                          >
                            <span>{difficultyConfig.icon}</span>
                            {game.difficulty}
                          </motion.span>
                          <span className="flex items-center gap-1 text-gray-600 bg-gray-100 px-3 py-2 rounded-full">
                            ⏱️ {game.duration}
                          </span>
                        </div>
                      </div>
                      
                      {/* Play Button */}
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Button 
                          className={`w-full py-3 rounded-xl font-semibold transition-all duration-300 ${
                            game.available 
                              ? `bg-gradient-to-r ${game.color} hover:shadow-lg text-white border-0` 
                              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          }`}
                          disabled={!game.available}
                          onClick={() => {
                            if (game.available) {
                              if (game.id === 'memory') navigate('/memory-challenge');
                              if (game.id === 'emoji-match') navigate('/emoji-match');
                              if (game.id === 'emotion-match') navigate('/emotion-match');
                              if (game.id === 'mood-mountain') navigate('/mood-mountain');
                              if (game.id === 'thought-detective') navigate('/thought-detective');
                            }
                          }}
                        >
                          {game.available ? (
                            <span className="flex items-center gap-2">
                              <Play className="h-4 w-4" />
                              Play Now
                            </span>
                          ) : (
                            'Coming Soon'
                          )}
                        </Button>
                      </motion.div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>

        {/* Footer Message */}
        <motion.div 
          className="text-center mt-12 p-6 bg-white/50 backdrop-blur-sm rounded-2xl border border-white/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
        >
          <p className="text-gray-600 text-sm leading-relaxed">
            🌟 Each game is designed with therapeutic principles to promote mindfulness, 
            cognitive flexibility, and emotional well-being. Take your time and enjoy the journey!
          </p>
        </motion.div>
      </main>
    </div>
  );
};

export default Games;
