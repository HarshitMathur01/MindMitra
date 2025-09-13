import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Brain, Heart, Users, ArrowLeft, Sprout, Clock, HelpCircle, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";

const QATests = () => {
  const navigate = useNavigate();

  const tests = [
    {
      id: "wellness-checkin",
      title: "Wellness Check-In",
      description: "Take a moment to check in with yourself through fun metaphors and emojis. A gentle way to explore how you're feeling right now.",
      icon: Sprout,
      duration: "3 min",
      questions: 10,
      available: true,
      color: "from-green-500 to-emerald-500",
      bgGlow: "bg-green-100",
      category: "Self-Assessment"
    },
    {
      id: "personality",
      title: "Big Five Personality Test",
      description: "Discover your personality traits across five key dimensions",
      icon: Brain,
      duration: "10-15 min",
      questions: 44,
      available: true,
      color: "from-purple-500 to-indigo-500",
      bgGlow: "bg-purple-100",
      category: "Personality"
    },
    {
      id: "wellbeing",
      title: "Mental Well-being Assessment", 
      description: "Evaluate your current mental health and wellness state",
      icon: Heart,
      duration: "8-12 min",
      questions: 32,
      available: true,
      color: "from-pink-500 to-rose-500",
      bgGlow: "bg-pink-100",
      category: "Wellness"
    },
    {
      id: "social",
      title: "Social Intelligence Quiz",
      description: "Assess your ability to understand and navigate social situations",
      icon: Users,
      duration: "12-18 min", 
      questions: 28,
      available: false,
      color: "from-gray-400 to-gray-500",
      bgGlow: "bg-gray-100",
      category: "Social Skills"
    },
    {
      id: "cognitive",
      title: "Cognitive Style Assessment",
      description: "Learn about your thinking patterns and decision-making style",
      icon: BookOpen,
      duration: "15-20 min",
      questions: 36,
      available: false,
      color: "from-gray-400 to-gray-500",
      bgGlow: "bg-gray-100",
      category: "Cognition"
    },
  ];

  const getCategoryConfig = (category: string) => {
    switch (category) {
      case "Self-Assessment":
        return { 
          color: "text-green-700 bg-green-100 border-green-200", 
          icon: "🌱"
        };
      case "Personality":
        return { 
          color: "text-purple-700 bg-purple-100 border-purple-200", 
          icon: "🧠"
        };
      case "Wellness":
        return { 
          color: "text-pink-700 bg-pink-100 border-pink-200", 
          icon: "💖"
        };
      case "Social Skills":
        return { 
          color: "text-blue-700 bg-blue-100 border-blue-200", 
          icon: "👥"
        };
      case "Cognition":
        return { 
          color: "text-indigo-700 bg-indigo-100 border-indigo-200", 
          icon: "🔍"
        };
      default:
        return { 
          color: "text-gray-700 bg-gray-100 border-gray-200", 
          icon: "📋"
        };
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.3
      }
    }
  };

  const cardVariants = {
    hidden: { 
      opacity: 0, 
      y: 60,
      scale: 0.8
    },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        type: "spring" as const,
        damping: 20,
        stiffness: 300
      }
    }
  };

  const iconVariants = {
    hover: {
      scale: 1.2,
      rotate: [0, -5, 5, 0],
      transition: {
        duration: 0.6,
        ease: "easeInOut" as const
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
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: "spring", damping: 15 }}
              className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center breathing-pulse"
            >
              <Star className="h-10 w-10 text-white" />
            </motion.div>
            
            <motion.h1 
              className="text-5xl font-bold mb-4 text-gradient leading-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              Psychological Assessments
            </motion.h1>
            
            <motion.p 
              className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              Discover insights about yourself through scientifically-backed assessments 
              designed to enhance self-awareness and personal growth.
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
            {tests.map((test, index) => {
              const Icon = test.icon;
              const categoryConfig = getCategoryConfig(test.category);
              
              return (
                <motion.div
                  key={test.id}
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
                    <div className={`absolute inset-0 ${test.bgGlow} opacity-0 group-hover:opacity-20 transition-opacity duration-500`} />
                    
                    {/* Available Badge */}
                    {test.available && (
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
                        className={`w-16 h-16 bg-gradient-to-r ${test.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg`}
                        variants={iconVariants}
                        whileHover="hover"
                      >
                        <Icon className="h-8 w-8 text-white" />
                      </motion.div>

                      {/* Content */}
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                          <h3 className="font-bold text-xl text-gray-800 group-hover:text-gradient transition-all duration-300">
                            {test.title}
                          </h3>
                          {!test.available && (
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
                          {test.description}
                        </p>
                        
                        <div className="flex flex-wrap gap-3 text-xs mb-4">
                          <motion.span 
                            className={`px-3 py-2 rounded-full border ${categoryConfig.color} font-medium flex items-center gap-1`}
                            whileHover={{ scale: 1.05 }}
                            transition={{ type: "spring", damping: 15 }}
                          >
                            <span>{categoryConfig.icon}</span>
                            {test.category}
                          </motion.span>
                        </div>

                        <div className="flex justify-between items-center text-xs text-gray-600 bg-gray-50 p-3 rounded-lg">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {test.duration}
                          </span>
                          <span className="flex items-center gap-1">
                            <HelpCircle className="h-3 w-3" />
                            {test.questions} questions
                          </span>
                        </div>
                      </div>
                      
                      {/* Start Button */}
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Button 
                          className={`w-full py-3 rounded-xl font-semibold transition-all duration-300 ${
                            test.available 
                              ? `bg-gradient-to-r ${test.color} hover:shadow-lg text-white border-0` 
                              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          }`}
                          disabled={!test.available}
                          onClick={() => test.available && test.id === "wellness-checkin" && navigate('/wellness-checkin')}
                        >
                          {test.available ? (
                            <span className="flex items-center gap-2">
                              <Star className="h-4 w-4" />
                              Start Assessment
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

        {/* Info Cards */}
        <motion.div 
          className="grid md:grid-cols-2 gap-6 mt-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
        >
          <Card className="p-6 bg-white/50 backdrop-blur-sm border border-white/50">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800">How It Works</h3>
            </div>
            <p className="text-gray-600 leading-relaxed">
              Each assessment uses validated psychological scales and questionnaires. 
              Your responses are analyzed to provide personalized insights about your 
              personality, well-being, and cognitive patterns.
            </p>
          </Card>

          <Card className="p-6 bg-white/50 backdrop-blur-sm border border-white/50">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-teal-600 rounded-full flex items-center justify-center">
                <Heart className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800">Your Privacy</h3>
            </div>
            <p className="text-gray-600 leading-relaxed">
              All your responses are completely confidential and secure. 
              The results are for your personal insight and growth, 
              helping you better understand yourself.
            </p>
          </Card>
        </motion.div>

        {/* Footer Message */}
        <motion.div 
          className="text-center mt-12 p-6 bg-white/50 backdrop-blur-sm rounded-2xl border border-white/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.6 }}
        >
          <p className="text-gray-600 text-sm leading-relaxed">
            🌟 Take your time with each assessment. There are no right or wrong answers - 
            just honest reflections that will help you on your journey of self-discovery.
          </p>
        </motion.div>
      </main>
    </div>
  );
};

export default QATests;
