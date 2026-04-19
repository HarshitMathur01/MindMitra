import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, CheckCircle, Brain, Target, Zap, Clock, TrendingUp, Shield, Flame, Lock, ChevronRight } from "lucide-react";
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
  explanation: string;
}

const DISTORTIONS: CognitiveDistortion[] = [
  { id: 'all-or-nothing', name: 'All-or-Nothing Thinking', description: 'Seeing things in black and white categories', badge: '⚫' },
  { id: 'catastrophizing', name: 'Catastrophizing', description: 'Expecting the worst possible outcome', badge: '💥' },
  { id: 'mind-reading', name: 'Mind Reading', description: 'Assuming you know what others are thinking', badge: '🔮' },
  { id: 'fortune-telling', name: 'Fortune Telling', description: 'Predicting negative future events', badge: '🌙' },
  { id: 'emotional-reasoning', name: 'Emotional Reasoning', description: 'Believing emotions reflect reality', badge: '💭' },
  { id: 'personalization', name: 'Personalization', description: 'Blaming yourself for things outside your control', badge: '👤' },
  { id: 'labeling', name: 'Labeling', description: 'Attaching negative labels to yourself or others', badge: '🏷️' },
  { id: 'should-statements', name: 'Should Statements', description: 'Using "should", "must", or "ought" rigidly', badge: '📏' },
];

const CASE_FILES: CaseFile[] = [
  {
    id: 'case-1',
    thought: "I failed my driving test. I'll never be able to drive. I'm completely hopeless at everything.",
    distortions: ['all-or-nothing', 'catastrophizing', 'labeling'],
    alternatives: [
      "Many people need multiple attempts to pass their driving test. I can learn from this experience and try again.",
      "This was just one test. It doesn't define my abilities in other areas of life.",
      "I can practice more and improve my driving skills before the next test."
    ],
    difficulty: 'easy',
    explanation: "Using words like 'never' and 'completely' is All-or-Nothing thinking. Assuming you'll never drive based on one test is Catastrophizing, and calling yourself 'hopeless' is Labeling."
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
    difficulty: 'easy',
    explanation: "Assuming you know why someone hasn't replied is Mind Reading. Jumping to the conclusion that they 'hate' you is Catastrophizing and All-or-Nothing thinking."
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
    difficulty: 'medium',
    explanation: "Believing that feeling anxious means you will fail is Emotional Reasoning. Predicting embarrassment is Fortune Telling, and assuming the worst possible outcome is Catastrophizing."
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
    difficulty: 'medium',
    explanation: "Taking the entire blame for a team effort is Personalization. Thinking it's 'all' your fault ignores the complex, shared nature of the project (All-or-Nothing thinking)."
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
    difficulty: 'hard',
    explanation: "Using rigid rules like 'should always be perfect' creates impossible standards (Should Statements). Defining yourself entirely by a mistake is All-or-Nothing thinking and Labeling yourself a 'failure'."
  },
  {
    id: 'case-6',
    thought: "I ate a piece of cake on my diet. I completely ruined my progress, I might as well eat the whole thing.",
    distortions: ['all-or-nothing', 'catastrophizing'],
    alternatives: [
      "One piece of cake doesn't erase all the healthy choices I've made.",
      "I can enjoy a treat and still stick to my overall goals.",
      "Progress is about consistency, not perfection."
    ],
    difficulty: 'easy',
    explanation: "Thinking one mistake ruins everything is All-or-Nothing thinking. Assuming the diet is entirely doomed is Catastrophizing."
  },
  {
    id: 'case-7',
    thought: "My boss asked to see me in her office. She's definitely going to fire me over that typo I made yesterday.",
    distortions: ['mind-reading', 'catastrophizing', 'fortune-telling'],
    alternatives: [
      "Managers ask to see employees for many normal reasons, like new projects or routine check-ins.",
      "I don't know what she wants to discuss until I get there.",
      "A single typo rarely leads to being fired without warning."
    ],
    difficulty: 'medium',
    explanation: "Assuming you know what your boss is thinking is Mind Reading. Predicting you'll be fired is Fortune Telling, and expecting the absolute worst is Catastrophizing."
  },
  {
    id: 'case-8',
    thought: "Because I feel so overwhelmed by my messy room, it means it's completely impossible to clean.",
    distortions: ['emotional-reasoning', 'all-or-nothing'],
    alternatives: [
      "I feel overwhelmed, but that doesn't mean I can't start with just 5 minutes of tidying.",
      "My feelings are valid, but they don't dictate what I'm capable of doing.",
      "I can tackle this room one small section at a time."
    ],
    difficulty: 'medium',
    explanation: "Believing that because you feel overwhelmed, the task is actually impossible, is Emotional Reasoning. Viewing the room as one giant 'impossible' task rather than small steps is All-or-Nothing thinking."
  },
  {
    id: 'case-9',
    thought: "I should have known it would rain today. Look at my hair, I'm such an idiot for not checking the weather.",
    distortions: ['should-statements', 'labeling', 'personalization'],
    alternatives: [
      "I made the best decision I could while trying to get out the door quickly.",
      "No one can control or perfectly predict the weather every single day.",
      "Forgetting an umbrella is a normal mistake; it doesn't mean I'm an idiot."
    ],
    difficulty: 'hard',
    explanation: "'Should have known' is a classic Should Statement that applies hindsight unfairly. Blaming yourself for uncontrollable situations is Personalization, and calling yourself an 'idiot' is Labeling."
  },
  {
    id: 'case-10',
    thought: "He looked at his watch while I was talking. I must be boring him to death, I'm terrible at making conversation.",
    distortions: ['mind-reading', 'personalization', 'labeling'],
    alternatives: [
      "He might just be checking the time because he has an appointment soon.",
      "People get distracted sometimes; it doesn't mean I'm a terrible conversationalist.",
      "I can't know for sure why he looked at his watch unless I ask."
    ],
    difficulty: 'hard',
    explanation: "Assuming you know why he looked at his watch is Mind Reading. Taking his action personally as a reflection of your conversational skills is Personalization, and calling yourself 'terrible' is Labeling."
  }
];

const SUPPORTIVE_MESSAGES = [
  "You're rewiring your brain right now",
  "Each pattern you spot makes you stronger",
  "Your emotional IQ just leveled up",
  "This skill protects you in real life",
  "Therapists train years for this — you're doing it now",
];

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
  const [allIdentifiedDistortions, setAllIdentifiedDistortions] = useState<string[]>([]);
  const [totalCorrectDistortions, setTotalCorrectDistortions] = useState(0);
  const [totalPossibleDistortions, setTotalPossibleDistortions] = useState(0);

  // Engagement states (ethical and user-supportive)
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showPauseReminder, setShowPauseReminder] = useState(false);
  const [peakScore, setPeakScore] = useState(0);
  const [revealedHint, setRevealedHint] = useState(false);
  const [motivationalMsg, setMotivationalMsg] = useState('');
  const [lastScoreDelta, setLastScoreDelta] = useState(0);
  const [showScoreFloat, setShowScoreFloat] = useState(false);
  const [showCaseFeedback, setShowCaseFeedback] = useState(false);

  // Lightweight session timer for context
  useEffect(() => {
    if (showResults) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, showResults]);

  useEffect(() => {
    if (currentCase) return;
    const availableCases = CASE_FILES.filter(caseFile =>
      caseFile.difficulty === (level <= 2 ? 'easy' : level <= 4 ? 'medium' : 'hard')
    );
    if (availableCases.length === 0) return;
    const randomCase = availableCases[Math.floor(Math.random() * availableCases.length)];
    setCurrentCase(randomCase);
    setSelectedDistortions([]);
    setSelectedAlternative('');
    setRevealedHint(false);
  }, [currentCase, level]);

  // Gentle pause reminder if user is idle while on a streak
  useEffect(() => {
    if (streak < 2 || showResults) return;
    const timeout = setTimeout(() => setShowPauseReminder(true), 20000);
    return () => { clearTimeout(timeout); setShowPauseReminder(false); };
  }, [streak, solvedCases, showResults]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const loadNextCase = () => {
    const availableCases = CASE_FILES.filter(caseFile =>
      caseFile.difficulty === (level <= 2 ? 'easy' : level <= 4 ? 'medium' : 'hard')
    );
    if (availableCases.length > 0) {
      const randomCase = availableCases[Math.floor(Math.random() * availableCases.length)];
      setCurrentCase(randomCase);
      setSelectedDistortions([]);
      setSelectedAlternative('');
      setRevealedHint(false);
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
        title: "Almost there...",
        description: "You're so close! Just identify a distortion and pick an alternative to unlock your points.",
        variant: "destructive"
      });
      return;
    }

    const correctDistortions = currentCase.distortions.filter(d => selectedDistortions.includes(d));
    const distortionScore = (correctDistortions.length / currentCase.distortions.length) * 50;
    const alternativeScore = currentCase.alternatives.includes(selectedAlternative) ? 30 : 20;
    const difficultyBonus = currentCase.difficulty === 'hard' ? 20 : currentCase.difficulty === 'medium' ? 10 : 5;

    // Streak bonus rewards consistent practice
    const isPerfect = correctDistortions.length === currentCase.distortions.length;
    const newStreak = isPerfect ? streak + 1 : 0;
    setStreak(newStreak);
    const streakBonus = newStreak >= 2 ? newStreak * 5 : 0;

    const caseScore = Math.round(distortionScore + alternativeScore + difficultyBonus + streakBonus);
    setLastScoreDelta(caseScore);
    setShowScoreFloat(true);
    setTimeout(() => setShowScoreFloat(false), 1500);

    const newScore = score + caseScore;
    setScore(newScore);
    if (newScore > peakScore) setPeakScore(newScore);
    setSolvedCases(prev => prev + 1);

    setAllIdentifiedDistortions(prev => [...new Set([...prev, ...selectedDistortions])]);
    setTotalCorrectDistortions(prev => prev + correctDistortions.length);
    setTotalPossibleDistortions(prev => prev + currentCase.distortions.length);

    // Random supportive message reinforces effort
    setMotivationalMsg(SUPPORTIVE_MESSAGES[Math.floor(Math.random() * SUPPORTIVE_MESSAGES.length)]);

    const newBadges: string[] = [];
    if (isPerfect) newBadges.push('perfectionist');
    if (solvedCases + 1 >= 5) newBadges.push('detective');
    if (currentCase.difficulty === 'hard') newBadges.push('expert');
    if (newStreak >= 3) newBadges.push('streak-master');
    setEarnedBadges(prev => [...new Set([...prev, ...newBadges])]);

    const streakMsg = newStreak >= 2 ? ` | ${newStreak}x streak bonus!` : '';
    toast({
      title: isPerfect ? "Perfect Analysis!" : "Case Solved!",
      description: `+${caseScore} points${streakMsg} — ${correctDistortions.length}/${currentCase.distortions.length} distortions correct.`,
    });

    if ((solvedCases + 1) % 2 === 0) {
      setLevel(prev => prev + 1);
      toast({ title: "Level Up!", description: `Level ${level + 1} unlocked — harder cases ahead!` });
    }

    setShowCaseFeedback(true);
  };

  const handleNextCase = async () => {
    setShowCaseFeedback(false);

    if (solvedCases >= 5) {
      setShowResults(true);
      const duration = Math.round((Date.now() - startTime) / 1000);
      const accuracyPct = Math.round((totalCorrectDistortions / Math.max(totalPossibleDistortions, 1)) * 100);
      try {
        await saveThoughtDetective(solvedCases, accuracyPct, duration, allIdentifiedDistortions);
      } catch (error) {
        console.error('Failed to save game result:', error);
      }
    } else {
      loadNextCase();
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
    setAllIdentifiedDistortions([]);
    setTotalCorrectDistortions(0);
    setTotalPossibleDistortions(0);
    setStreak(0);
    setElapsedSeconds(0);
    setPeakScore(0);
    setMotivationalMsg('');
  };

  const getDifficultyConfig = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return { color: 'text-emerald-700 bg-emerald-50 border-emerald-200', label: 'EASY', xp: '5' };
      case 'medium': return { color: 'text-amber-700 bg-amber-50 border-amber-200', label: 'MEDIUM', xp: '10' };
      case 'hard': return { color: 'text-rose-700 bg-rose-50 border-rose-200', label: 'HARD', xp: '20' };
      default: return { color: 'text-muted-foreground bg-surface', label: '', xp: '0' };
    }
  };

  // Progress starts with an initial visual boost
  const progressPercent = Math.min(100, 10 + (solvedCases / 5) * 90);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
  };

  const itemVariants = {
    hidden: { y: 16, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.4, ease: "easeOut" as const } }
  };

  const isReady = selectedDistortions.length > 0 && selectedAlternative;

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <motion.div
        className="container mx-auto px-4 py-6 max-w-6xl"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => {
              if (solvedCases > 0 && !showResults) {
                toast({
                  title: "Leave this session?",
                  description: `Current run progress (${score} points) is saved only after 5 completed cases.`,
                  variant: "destructive",
                });
                setTimeout(() => navigate('/games'), 2500);
                return;
              }
              navigate('/games');
            }}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-all duration-200"
          >
            <ArrowLeft className="h-5 w-5" />
            Back
          </Button>

          <div className="flex items-center gap-3">
            {/* Live timer */}
            {!showResults && (
              <div className="flex items-center gap-1.5 rounded-full bg-surface/80 px-3 py-1.5 text-xs font-mono font-semibold text-muted-foreground backdrop-blur-sm">
                <Clock className="h-3.5 w-3.5" />
                {formatTime(elapsedSeconds)}
              </div>
            )}

            <Button
              variant="outline"
              onClick={resetGame}
              className="flex items-center gap-2 bg-surface/70 backdrop-blur-sm hover:bg-surface/90 transition-all duration-200 text-sm"
            >
              <Search className="h-4 w-4" />
              New Case
            </Button>
          </div>
        </div>

        {/* Pause reminder */}
        <AnimatePresence>
          {showPauseReminder && !showResults && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800"
            >
              <Flame className="h-4 w-4 text-amber-500 shrink-0" />
              <span>Taking a short breath is okay. Continue when you're ready; your <strong>{streak}x streak</strong> is still here.</span>
            </motion.div>
          )}
        </AnimatePresence>

        {!showResults && currentCase ? (
          <motion.div variants={containerVariants} initial="hidden" animate="visible">

            {/* Stats bar — compact, always visible */}
            <motion.div variants={itemVariants} className="grid grid-cols-4 gap-3 mb-5">
              {[
                { icon: Target, label: 'Score', value: score, color: 'text-primary', extra: peakScore > score ? `Peak: ${peakScore}` : null },
                { icon: Flame, label: 'Streak', value: `${streak}x`, color: streak >= 2 ? 'text-orange-500' : 'text-muted-foreground', extra: streak >= 2 ? `+${streak * 5} bonus` : null },
                { icon: Brain, label: 'Level', value: level, color: 'text-purple-600', extra: null },
                { icon: Shield, label: 'Solved', value: `${solvedCases}/5`, color: 'text-emerald-600', extra: null },
              ].map((stat) => (
                <div key={stat.label} className="relative rounded-2xl bg-surface/60 backdrop-blur-sm p-3 text-center">
                  <stat.icon className={`h-4 w-4 mx-auto mb-1 ${stat.color}`} />
                  <motion.p
                    className={`text-xl font-bold ${stat.color}`}
                    key={String(stat.value)}
                    initial={{ scale: 1.15 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    {stat.value}
                  </motion.p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">{stat.label}</p>
                  {stat.extra && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{stat.extra}</p>
                  )}
                </div>
              ))}
            </motion.div>

            {/* Progress bar */}
            <motion.div variants={itemVariants} className="mb-6">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Case Progress</span>
                  <Badge className={`text-[10px] border ${getDifficultyConfig(currentCase.difficulty).color}`}>
                    {getDifficultyConfig(currentCase.difficulty).label} +{getDifficultyConfig(currentCase.difficulty).xp}xp
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">{5 - solvedCases} cases left</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-surface overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-primary via-purple-500 to-indigo-500"
                  initial={{ width: '10%' }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </div>
            </motion.div>

            {/* Motivational nudge */}
            <AnimatePresence>
              {motivationalMsg && (
                <motion.p
                  key={motivationalMsg}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-xs font-medium text-primary/80 mb-4 italic"
                >
                  {motivationalMsg}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Case File */}
              <motion.div variants={itemVariants}>
                <Card className="bg-surface/50 backdrop-blur-sm border border-border/60 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-foreground">
                      <div className="flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        Case #{currentCase.id.split('-')[1]}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* The thought — spotlighted */}
                    <div className="relative bg-gradient-to-br from-rose-50/80 to-amber-50/60 dark:from-rose-900/10 dark:to-amber-900/10 border border-rose-200/40 dark:border-rose-800/20 p-5 rounded-2xl mb-5">
                      <div className="absolute -top-2 left-4 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full">
                        Negative thought
                      </div>
                      <p className="text-foreground text-[15px] leading-relaxed italic mt-1">
                        "{currentCase.thought}"
                      </p>
                    </div>

                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-sm text-foreground">
                        Identify the distortions:
                      </h4>
                      {/* Optional hint */}
                      {!revealedHint && (
                        <button
                          onClick={() => setRevealedHint(true)}
                          className="text-[11px] font-medium text-primary/70 hover:text-primary transition-colors underline underline-offset-2"
                        >
                          Show hint
                        </button>
                      )}
                    </div>

                    {/* Hint */}
                    <AnimatePresence>
                      {revealedHint && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mb-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-900/10 border border-indigo-200/50 px-3 py-2 text-xs text-indigo-700 dark:text-indigo-300"
                        >
                          This thought contains <strong>{currentCase.distortions.length} distortions</strong>. You've selected {selectedDistortions.length}.
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="grid grid-cols-1 gap-1.5">
                      {DISTORTIONS.map((distortion, index) => {
                        const isSelected = selectedDistortions.includes(distortion.id);
                        const isCorrect = currentCase.distortions.includes(distortion.id);
                        let buttonClasses = 'bg-surface/60 hover:bg-crushed-silk border-border/40 text-foreground';

                        if (showCaseFeedback) {
                          if (isCorrect && isSelected) {
                            buttonClasses = 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-transparent shadow-md';
                          } else if (isCorrect && !isSelected) {
                            buttonClasses = 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 text-foreground border-dashed';
                          } else if (!isCorrect && isSelected) {
                            buttonClasses = 'bg-rose-50 dark:bg-rose-900/20 border-rose-300 dark:border-rose-700 text-foreground';
                          } else {
                            buttonClasses = 'bg-surface/30 border-border/20 text-muted-foreground opacity-50';
                          }
                        } else if (isSelected) {
                          buttonClasses = 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-transparent shadow-md shadow-indigo-500/20';
                        }

                        return (
                          <motion.button
                            key={distortion.id}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.04, duration: 0.25 }}
                            whileTap={!showCaseFeedback ? { scale: 0.97 } : {}}
                            onClick={() => !showCaseFeedback && handleDistortionToggle(distortion.id)}
                            disabled={showCaseFeedback}
                            className={`p-3 rounded-xl text-left transition-all duration-200 border ${buttonClasses}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-base">{distortion.badge}</span>
                              <div className="min-w-0">
                                <p className="font-medium text-sm">{distortion.name}</p>
                                <p className={`text-[11px] leading-snug ${isSelected && !showCaseFeedback ? 'text-white/70' : showCaseFeedback && isCorrect && isSelected ? 'text-white/80' : 'text-muted-foreground'}`}>{distortion.description}</p>
                              </div>
                              {showCaseFeedback ? (
                                isCorrect ? (
                                  <CheckCircle className={`h-4 w-4 ml-auto shrink-0 ${isSelected ? 'text-white' : 'text-emerald-500'}`} />
                                ) : isSelected ? (
                                  <Lock className="h-4 w-4 ml-auto shrink-0 text-rose-500" />
                                ) : null
                              ) : isSelected ? (
                                <CheckCircle className="h-4 w-4 ml-auto shrink-0" />
                              ) : null}
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Alternative Thoughts & Feedback */}
              <motion.div variants={itemVariants}>
                <AnimatePresence mode="wait">
                  {!showCaseFeedback ? (
                    <motion.div
                      key="alternatives"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="h-full"
                    >
                      <Card className="bg-surface/50 backdrop-blur-sm border border-border/60 shadow-lg h-full">
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-2 text-foreground">
                            <Zap className="h-5 w-5" />
                            Choose a Healthier Alternative
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-xs text-muted-foreground mb-4">
                            Which reframe would help the most? Pick wisely — it's worth 30 points.
                          </p>

                          <div className="space-y-2.5 mb-5">
                            {currentCase.alternatives.map((alternative, index) => {
                              const isSelected = selectedAlternative === alternative;
                              return (
                                <motion.button
                                  key={index}
                                  initial={{ opacity: 0, y: 12 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: index * 0.08, duration: 0.3 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => handleAlternativeSelect(alternative)}
                                  className={`p-4 rounded-xl text-left w-full transition-all duration-200 border ${isSelected
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-transparent shadow-md shadow-emerald-500/20'
                                    : 'bg-surface/60 hover:bg-crushed-silk border-border/40 text-foreground'
                                    }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-xs ${isSelected ? 'border-white bg-white/20' : 'border-border'}`}>
                                      {isSelected && <CheckCircle className="h-3.5 w-3.5" />}
                                    </span>
                                    <p className="text-sm leading-relaxed">{alternative}</p>
                                  </div>
                                </motion.button>
                              );
                            })}
                          </div>

                          {/* Submit with floating score preview */}
                          <div className="relative">
                            <AnimatePresence>
                              {showScoreFloat && (
                                <motion.div
                                  initial={{ opacity: 1, y: 0 }}
                                  animate={{ opacity: 0, y: -40 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.3 }}
                                  className="absolute -top-6 left-1/2 -translate-x-1/2 text-lg font-bold text-primary pointer-events-none"
                                >
                                  +{lastScoreDelta}
                                </motion.div>
                              )}
                            </AnimatePresence>

                            <Button
                              onClick={submitCase}
                              disabled={!isReady}
                              className={`w-full py-3 text-white font-semibold transition-all duration-300 ${isReady
                                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:scale-[1.01]'
                                : 'bg-surface text-muted-foreground opacity-50 cursor-not-allowed'
                                }`}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              {isReady ? 'Submit Analysis' : `Select distortion${selectedDistortions.length === 0 ? 's' : ''} & alternative`}
                            </Button>

                            {/* Guided next step */}
                            {selectedDistortions.length > 0 && !selectedAlternative && (
                              <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-center text-[11px] text-primary/70 mt-2 font-medium"
                              >
                                Great eye! Now pick an alternative to complete your analysis
                              </motion.p>
                            )}
                          </div>

                          {/* Progress preview */}
                          {solvedCases < 4 && (
                            <div className="mt-4 flex items-center gap-2 rounded-xl bg-surface/60 px-3 py-2.5 border border-border/30">
                              <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <p className="text-[11px] text-muted-foreground">
                                {solvedCases < 2
                                  ? `Solve ${2 - solvedCases} more to unlock Medium difficulty`
                                  : `Solve ${4 - solvedCases} more to unlock Hard difficulty`
                                }
                              </p>
                              <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="feedback"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4, type: 'spring' }}
                      className="h-full"
                    >
                      <Card className="bg-gradient-to-b from-indigo-50/80 to-purple-50/80 dark:from-indigo-900/20 dark:to-purple-900/20 backdrop-blur-md border border-indigo-200/60 dark:border-indigo-800/40 shadow-xl h-full flex flex-col">
                        <CardHeader className="pb-2 border-b border-indigo-100/50 dark:border-indigo-800/50">
                          <CardTitle className="flex items-center gap-2 text-indigo-900 dark:text-indigo-300">
                            <Brain className="h-5 w-5" />
                            Analysis Report
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-5 flex-1 flex flex-col max-h-full">

                          <div className="flex-1 space-y-5">
                            <div className="rounded-xl bg-white/60 dark:bg-black/20 p-4 border border-indigo-100/50 dark:border-indigo-900/30">
                              <h4 className="text-xs font-bold uppercase tracking-widest text-indigo-800/70 dark:text-indigo-400 mb-2">Why This Works</h4>
                              <p className="text-sm text-foreground leading-relaxed">
                                {currentCase.explanation}
                              </p>
                            </div>

                            <div className="rounded-xl bg-emerald-50/60 dark:bg-emerald-900/10 p-4 border border-emerald-100/50 dark:border-emerald-900/30">
                              <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-800/70 dark:text-emerald-400 mb-2">Your Reframe</h4>
                              <div className="flex items-start gap-2">
                                <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-500 mt-0.5 shrink-0" />
                                <p className="text-sm text-foreground italic font-medium">"{selectedAlternative}"</p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-8 relative">
                            <AnimatePresence>
                              {showScoreFloat && (
                                <motion.div
                                  initial={{ opacity: 1, y: 0, scale: 0.8 }}
                                  animate={{ opacity: 0, y: -50, scale: 1.2 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.3, ease: "easeOut" }}
                                  className="absolute -top-10 left-1/2 -translate-x-1/2 text-2xl font-black text-indigo-600 dark:text-indigo-400 pointer-events-none drop-shadow-md"
                                >
                                  +{lastScoreDelta}
                                </motion.div>
                              )}
                            </AnimatePresence>

                            <Button
                              onClick={handleNextCase}
                              className="w-full py-6 text-white font-bold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg shadow-indigo-500/30 text-lg rounded-xl transition-all duration-300 hover:scale-[1.02]"
                            >
                              {solvedCases >= 5 ? 'View Final Results' : 'Continue Investigation'}
                              <ChevronRight className="h-5 w-5 ml-1" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

            </div>
          </motion.div>
        ) : showResults ? (
          /* Results screen */
          <motion.div
            className="max-w-2xl mx-auto text-center"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
          >
            <Card className="bg-surface/80 backdrop-blur-sm border-0 shadow-2xl p-8 overflow-hidden relative">
              {/* Celebration gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 pointer-events-none" />

              <div className="relative z-10">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                  className="w-20 h-20 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/25"
                >
                  <Brain className="h-10 w-10 text-white" />
                </motion.div>

                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Mission Complete!
                </h2>
                <p className="text-sm text-muted-foreground mb-6">
                  You analyzed 5 thought patterns in {formatTime(elapsedSeconds)}
                </p>

                {/* Score */}
                <div className="mb-6">
                  <p className="text-5xl font-bold text-primary mb-1">{score}</p>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Points</p>
                  <p className="text-sm mt-2 font-medium text-muted-foreground">
                    {score >= 400 ? 'Expert Analyst' : score >= 300 ? 'Skilled Detective' : score >= 200 ? 'Rising Analyst' : 'Rookie Detective - Keep practicing'}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="rounded-2xl bg-surface p-3">
                    <p className="text-lg font-bold text-emerald-600">{solvedCases}</p>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Cases</p>
                  </div>
                  <div className="rounded-2xl bg-surface p-3">
                    <p className="text-lg font-bold text-purple-600">Lv.{level}</p>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Level</p>
                  </div>
                  <div className="rounded-2xl bg-surface p-3">
                    <p className="text-lg font-bold text-orange-500">{streak}x</p>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Best Streak</p>
                  </div>
                </div>

                {earnedBadges.length > 0 && (
                  <div className="mb-6">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Badges Earned</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {earnedBadges.map((badge, index) => (
                        <motion.div
                          key={index}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.4 + index * 0.15 }}
                        >
                          <Badge className="bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300 border border-amber-200 px-3 py-1">
                            {badge === 'perfectionist' && '🎯 Perfect Eye'}
                            {badge === 'detective' && '🕵️ Master Detective'}
                            {badge === 'expert' && '🧠 Expert Analyst'}
                            {badge === 'streak-master' && '🔥 Streak Master'}
                          </Badge>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reflection summary */}
                <div className="rounded-2xl bg-primary/5 border border-primary/10 p-4 mb-6">
                  <p className="text-xs font-semibold text-primary mb-1">
                    Your mental shield is getting stronger
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    You can now recognize {allIdentifiedDistortions.length} distortion types. Regular reflection helps you notice negative spirals earlier and respond with more balanced thoughts.
                  </p>
                </div>

                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={resetGame}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-6 py-3 shadow-lg shadow-indigo-500/20"
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Beat Your Score
                  </Button>
                  <Button
                    onClick={() => navigate('/games')}
                    variant="outline"
                    className="px-6 py-3"
                  >
                    Back to Games
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        ) : (
          <div className="text-center py-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.3, repeat: Infinity, ease: "linear" }}
              className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto"
            />
            <p className="mt-3 text-sm text-muted-foreground">Loading case file...</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ThoughtDetective;
