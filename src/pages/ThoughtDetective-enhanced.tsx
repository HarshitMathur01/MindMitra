import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Search, Award, CheckCircle, Brain, Target, Zap, Trophy, Star } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useGameDataSaver } from '@/lib/gameDataSaver';

interface CognitiveDistortion {
  id: string;
  name: string;
  description: string;
  badge: string;
}

interface CaseFile {
  id: string;
  thought: string;
  distortions: string[];
  alternatives: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

const ThoughtDetective = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { saveThoughtDetective } = useGameDataSaver();
  
  const [currentCase, setCurrentCase] = useState<CaseFile | null>(null);
  const [selectedDistortions, setSelectedDistortions] = useState<string[]>([]);
  const [selectedAlternative, setSelectedAlternative] = useState<string>('');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [solvedCases, setSolvedCases] = useState(0);
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());

  const distortions: CognitiveDistortion[] = [
    {
      id: 'all-or-nothing',
      name: 'All-or-Nothing Thinking',
      description: 'Seeing things in black and white categories',
      badge: '⚫'
    },
    {
      id: 'catastrophizing',
      name: 'Catastrophizing',
      description: 'Expecting the worst possible outcome',
      badge: '💥'
    },
    {
      id: 'mind-reading',
      name: 'Mind Reading',
      description: 'Assuming you know what others are thinking',
      badge: '🔮'
    },
    {
      id: 'fortune-telling',
      name: 'Fortune Telling',
      description: 'Predicting negative future events',
      badge: '🌙'
    },
    {
      id: 'emotional-reasoning',
      name: 'Emotional Reasoning',
      description: 'Believing emotions reflect reality',
      badge: '💭'
    },
    {
      id: 'personalization',
      name: 'Personalization',
      description: 'Blaming yourself for things outside your control',
      badge: '👤'
    },
    {
      id: 'labeling',
      name: 'Labeling',
      description: 'Attaching negative labels to yourself or others',
      badge: '🏷️'
    },
    {
      id: 'should-statements',
      name: 'Should Statements',
      description: 'Using "should", "must", or "ought" rigidly',
      badge: '📏'
    }
  ];

  const caseFiles: CaseFile[] = [
    {
      id: 'case-1',
      thought: "I failed my driving test. I'll never be able to drive. I'm completely hopeless at everything.",
      distortions: ['all-or-nothing', 'catastrophizing', 'labeling'],
      alternatives: [
        "Many people need multiple attempts to pass their driving test. I can learn from this experience and try again.",
        "This was just one test. It doesn't define my abilities in other areas of life.",
        "I can practice more and improve my driving skills before the next test."
      ],
      difficulty: 'easy'
    },
    {
      id: 'case-2',
      thought: "My friend didn't reply to my text immediately. They must be angry with me and probably hate me now.",
      distortions: ['mind-reading', 'catastrophizing', 'all-or-nothing'],
      alternatives: [
        "There could be many reasons why they haven't replied yet - they might be busy, sleeping, or not have seen the message.",
        "Even if they're upset about something, it doesn't mean they hate me completely.",
        "I should ask them directly if something's wrong instead of assuming the worst."
      ],
      difficulty: 'easy'
    },
    {
      id: 'case-3',
      thought: "I feel anxious about the presentation, so it must mean I'm going to fail and embarrass myself.",
      distortions: ['emotional-reasoning', 'fortune-telling', 'catastrophizing'],
      alternatives: [
        "Feeling anxious is normal before presentations. It doesn't predict the outcome.",
        "I can prepare well and use techniques to manage my anxiety.",
        "Even if I make mistakes, it won't be the end of the world."
      ],
      difficulty: 'medium'
    },
    {
      id: 'case-4',
      thought: "The team project failed because I didn't contribute enough. It's all my fault that everyone got a bad grade.",
      distortions: ['personalization', 'all-or-nothing'],
      alternatives: [
        "Team projects involve multiple people and factors. The outcome isn't solely my responsibility.",
        "I can identify what I could do differently next time without taking all the blame.",
        "Other team members also had roles and responsibilities in the project's outcome."
      ],
      difficulty: 'medium'
    },
    {
      id: 'case-5',
      thought: "I should always be perfect in my work. If I make any mistakes, I'm a failure as a professional.",
      distortions: ['should-statements', 'all-or-nothing', 'labeling'],
      alternatives: [
        "Making mistakes is part of learning and growing professionally.",
        "Perfectionism can actually hinder performance and well-being.",
        "I can strive for excellence while accepting that mistakes are human and normal."
      ],
      difficulty: 'hard'
    }
  ];

  useEffect(() => {
    if (!currentCase) {
      loadNextCase();
    }
  }, [currentCase]);

  const loadNextCase = () => {
    const availableCases = caseFiles.filter(caseFile => 
      caseFile.difficulty === (level <= 2 ? 'easy' : level <= 4 ? 'medium' : 'hard')
    );
    
    if (availableCases.length > 0) {
      const randomCase = availableCases[Math.floor(Math.random() * availableCases.length)];
      setCurrentCase(randomCase);
      setSelectedDistortions([]);
      setSelectedAlternative('');
    }
  };

  const handleDistortionToggle = (distortionId: string) => {
    setSelectedDistortions(prev => 
      prev.includes(distortionId) 
        ? prev.filter(id => id !== distortionId)
        : [...prev, distortionId]
    );
  };

  const handleAlternativeSelect = (alternative: string) => {
    setSelectedAlternative(alternative);
  };

  const submitCase = async () => {
    if (!currentCase || selectedDistortions.length === 0 || !selectedAlternative) {
      toast({
        title: "Incomplete Analysis",
        description: "Please identify at least one distortion and select an alternative thought.",
        variant: "destructive"
      });
      return;
    }

    // Calculate score based on accuracy
    const correctDistortions = currentCase.distortions.filter(d => selectedDistortions.includes(d));
    const distortionScore = (correctDistortions.length / currentCase.distortions.length) * 50;
    const alternativeScore = currentCase.alternatives.includes(selectedAlternative) ? 30 : 20;
    const difficultyBonus = currentCase.difficulty === 'hard' ? 20 : currentCase.difficulty === 'medium' ? 10 : 5;
    
    const caseScore = Math.round(distortionScore + alternativeScore + difficultyBonus);
    setScore(prev => prev + caseScore);
    setSolvedCases(prev => prev + 1);

    // Check for badges
    const newBadges: string[] = [];
    if (correctDistortions.length === currentCase.distortions.length) {
      newBadges.push('perfectionist');
    }
    if (solvedCases + 1 >= 5) {
      newBadges.push('detective');
    }
    if (currentCase.difficulty === 'hard') {
      newBadges.push('expert');
    }

    setEarnedBadges(prev => [...new Set([...prev, ...newBadges])]);

    toast({
      title: "Case Solved!",
      description: `You earned ${caseScore} points! ${correctDistortions.length}/${currentCase.distortions.length} distortions correct.`,
    });

    // Level up logic
    if ((solvedCases + 1) % 2 === 0) {
      setLevel(prev => prev + 1);
      toast({
        title: "Level Up!",
        description: `You've reached level ${level + 1}!`,
      });
    }

    // Check if game complete
    if (solvedCases + 1 >= 5) {
      setShowResults(true);
      const duration = Math.round((Date.now() - startTime) / 1000);
      try {
        await saveThoughtDetective(score + caseScore, solvedCases + 1, 5, duration);
        console.log('✅ Thought Detective result saved!');
      } catch (error) {
        console.error('Failed to save game result:', error);
      }
    } else {
      setTimeout(() => {
        loadNextCase();
      }, 2000);
    }
  };

  const resetGame = () => {
    setCurrentCase(null);
    setSelectedDistortions([]);
    setSelectedAlternative('');
    setScore(0);
    setLevel(1);
    setSolvedCases(0);
    setEarnedBadges([]);
    setShowResults(false);
    setStartTime(Date.now());
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'hard': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { duration: 0.5 }
    }
  };

  const celebrationVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: {
        type: "spring" as const,
        stiffness: 300,
        damping: 20
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50">
      <motion.div 
        className="container mx-auto px-4 py-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/games')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-all duration-300 hover:scale-105"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Games
          </Button>
          
          <motion.h1 
            className="text-3xl font-bold text-gradient"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            🕵️ Thought Detective
          </motion.h1>
          
          <Button
            variant="outline"
            onClick={resetGame}
            className="flex items-center gap-2 bg-white/70 backdrop-blur-sm hover:bg-white/90 transition-all duration-300 hover:scale-105"
          >
            <Search className="h-4 w-4" />
            New Case
          </Button>
        </div>

        {!showResults && currentCase ? (
          <motion.div 
            className="max-w-6xl mx-auto"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Game Stats */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg wellness-card">
                <div className="p-4 text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Target className="h-5 w-5 text-blue-600 mr-2" />
                    <span className="font-semibold text-gray-700">Score</span>
                  </div>
                  <motion.p 
                    className="text-2xl font-bold text-blue-600"
                    key={score}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    {score}
                  </motion.p>
                </div>
              </Card>
              
              <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg wellness-card">
                <div className="p-4 text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Brain className="h-5 w-5 text-purple-600 mr-2" />
                    <span className="font-semibold text-gray-700">Level</span>
                  </div>
                  <motion.p 
                    className="text-2xl font-bold text-purple-600"
                    key={level}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    {level}
                  </motion.p>
                </div>
              </Card>
              
              <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg wellness-card">
                <div className="p-4 text-center">
                  <div className="flex items-center justify-center mb-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                    <span className="font-semibold text-gray-700">Cases Solved</span>
                  </div>
                  <motion.p 
                    className="text-2xl font-bold text-green-600"
                    key={solvedCases}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    {solvedCases}/5
                  </motion.p>
                </div>
              </Card>
              
              <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg wellness-card">
                <div className="p-4 text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Award className="h-5 w-5 text-yellow-600 mr-2" />
                    <span className="font-semibold text-gray-700">Badges</span>
                  </div>
                  <motion.p 
                    className="text-2xl font-bold text-yellow-600"
                    key={earnedBadges.length}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    {earnedBadges.length}
                  </motion.p>
                </div>
              </Card>
            </motion.div>

            {/* Progress Bar */}
            <motion.div variants={itemVariants} className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Case Progress
                </span>
                <Badge className={`${getDifficultyColor(currentCase.difficulty)}`}>
                  {currentCase.difficulty.toUpperCase()}
                </Badge>
              </div>
              <Progress 
                value={(solvedCases / 5) * 100} 
                className="h-3"
              />
            </motion.div>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* Case File */}
              <motion.div variants={itemVariants}>
                <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-gray-800">
                      <Search className="h-5 w-5" />
                      Case File #{currentCase.id.split('-')[1]}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-50 p-4 rounded-lg mb-6">
                      <p className="text-gray-800 italic">
                        "{currentCase.thought}"
                      </p>
                    </div>
                    
                    <h4 className="font-semibold mb-3 text-gray-800">
                      Identify the cognitive distortions:
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                      {distortions.map((distortion, index) => (
                        <motion.button
                          key={distortion.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05, duration: 0.3 }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleDistortionToggle(distortion.id)}
                          className={`p-3 rounded-lg text-left transition-all duration-300 ${
                            selectedDistortions.includes(distortion.id)
                              ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{distortion.badge}</span>
                            <div>
                              <p className="font-medium">{distortion.name}</p>
                              <p className="text-xs opacity-75">{distortion.description}</p>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Alternative Thoughts */}
              <motion.div variants={itemVariants}>
                <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-gray-800">
                      <Zap className="h-5 w-5" />
                      Choose a Healthier Alternative
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Which alternative thought would be most helpful?
                    </p>
                    
                    <div className="space-y-3 mb-6">
                      {currentCase.alternatives.map((alternative, index) => (
                        <motion.button
                          key={index}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1, duration: 0.3 }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleAlternativeSelect(alternative)}
                          className={`p-4 rounded-lg text-left w-full transition-all duration-300 ${
                            selectedAlternative === alternative
                              ? 'bg-gradient-to-r from-green-500 to-blue-600 text-white shadow-lg'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                        >
                          <p className="text-sm">{alternative}</p>
                        </motion.button>
                      ))}
                    </div>
                    
                    <Button
                      onClick={submitCase}
                      disabled={selectedDistortions.length === 0 || !selectedAlternative}
                      className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white py-3 transition-all duration-300 disabled:opacity-50"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Submit Analysis
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </motion.div>
        ) : showResults ? (
          /* Results Screen */
          <motion.div 
            className="max-w-2xl mx-auto text-center"
            variants={celebrationVariants}
            initial="hidden"
            animate="visible"
          >
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-2xl p-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-20 h-20 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <Brain className="h-10 w-10 text-white" />
              </motion.div>
              
              <h2 className="text-3xl font-bold text-gradient mb-4">
                Detective Mission Complete! 🕵️
              </h2>
              
              <div className="mb-6">
                <p className="text-xl text-gray-700 mb-4">
                  You've successfully analyzed 5 thought patterns!
                </p>
                <p className="text-3xl font-bold text-purple-600 mb-4">
                  Final Score: {score} points
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-indigo-50 p-4 rounded-lg">
                    <p className="font-semibold text-indigo-700">Cases Solved</p>
                    <p className="text-2xl text-indigo-600">{solvedCases}</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="font-semibold text-purple-700">Final Level</p>
                    <p className="text-2xl text-purple-600">{level}</p>
                  </div>
                </div>
                
                {earnedBadges.length > 0 && (
                  <div className="mb-6">
                    <p className="font-semibold text-gray-700 mb-2">Badges Earned:</p>
                    <div className="flex justify-center gap-2">
                      {earnedBadges.map((badge, index) => (
                        <Badge key={index} className="bg-yellow-100 text-yellow-800">
                          {badge === 'perfectionist' && '🎯 Perfectionist'}
                          {badge === 'detective' && '🕵️ Master Detective'}
                          {badge === 'expert' && '🧠 Expert Analyst'}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex gap-4 justify-center">
                <Button
                  onClick={resetGame}
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-8 py-3"
                >
                  New Investigation
                </Button>
                <Button
                  onClick={() => navigate('/games')}
                  variant="outline"
                  className="px-8 py-3"
                >
                  Back to Games
                </Button>
              </div>
            </Card>
          </motion.div>
        ) : (
          <div className="text-center">
            <p>Loading case file...</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ThoughtDetective;
