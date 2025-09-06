import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Search, Award, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  
  const [currentCase, setCurrentCase] = useState<CaseFile | null>(null);
  const [selectedDistortions, setSelectedDistortions] = useState<string[]>([]);
  const [selectedAlternative, setSelectedAlternative] = useState<string>('');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [solvedCases, setSolvedCases] = useState(0);
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);

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
      badge: '🌪️'
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
      badge: '🎯'
    },
    {
      id: 'emotional-reasoning',
      name: 'Emotional Reasoning',
      description: 'Believing feelings reflect reality',
      badge: '💭'
    },
    {
      id: 'should-statements',
      name: 'Should Statements',
      description: 'Using "should" or "must" statements',
      badge: '📝'
    }
  ];

  const caseFiles: CaseFile[] = [
    {
      id: '1',
      thought: "I made one mistake in my presentation, so I'm terrible at public speaking.",
      distortions: ['all-or-nothing'],
      alternatives: [
        "I made one mistake, but overall my presentation went well.",
        "Everyone makes mistakes when speaking publicly.",
        "One mistake doesn't define my speaking abilities."
      ],
      difficulty: 'easy'
    },
    {
      id: '2',
      thought: "Everyone at the party thinks I'm boring and doesn't want to talk to me.",
      distortions: ['mind-reading', 'all-or-nothing'],
      alternatives: [
        "I don't know what others are thinking - some people might be enjoying our conversation.",
        "People might be quiet for many reasons unrelated to me.",
        "I can focus on having genuine conversations with those who seem interested."
      ],
      difficulty: 'medium'
    },
    {
      id: '3',
      thought: "If I don't get this job, my career will be ruined forever.",
      distortions: ['catastrophizing', 'fortune-telling'],
      alternatives: [
        "Not getting this job would be disappointing, but there are other opportunities.",
        "My career is built on many experiences, not just one job.",
        "This is one step in my journey, not the end of it."
      ],
      difficulty: 'medium'
    },
    {
      id: '4',
      thought: "I feel anxious about the meeting, so something bad must be going to happen.",
      distortions: ['emotional-reasoning', 'fortune-telling'],
      alternatives: [
        "Feeling anxious doesn't mean something bad will happen.",
        "Anxiety is a normal response to new situations.",
        "I can prepare for the meeting and handle whatever comes up."
      ],
      difficulty: 'hard'
    },
    {
      id: '5',
      thought: "I should always be perfect at everything I do.",
      distortions: ['should-statements', 'all-or-nothing'],
      alternatives: [
        "It's human to make mistakes and learn from them.",
        "I can strive for excellence while accepting that perfection isn't realistic.",
        "Growth comes from challenges and imperfection."
      ],
      difficulty: 'easy'
    }
  ];

  useEffect(() => {
    loadNewCase();
  }, []);

  const loadNewCase = () => {
    const availableCases = caseFiles.filter(c => c.id !== currentCase?.id);
    const randomCase = availableCases[Math.floor(Math.random() * availableCases.length)];
    setCurrentCase(randomCase);
    setSelectedDistortions([]);
    setSelectedAlternative('');
    setShowResults(false);
  };

  const toggleDistortion = (distortionId: string) => {
    setSelectedDistortions(prev => 
      prev.includes(distortionId) 
        ? prev.filter(id => id !== distortionId)
        : [...prev, distortionId]
    );
  };

  const solveCase = () => {
    if (!currentCase) return;

    const correctDistortions = currentCase.distortions;
    const correctlyIdentified = selectedDistortions.filter(d => correctDistortions.includes(d));
    const incorrectlyIdentified = selectedDistortions.filter(d => !correctDistortions.includes(d));
    const missed = correctDistortions.filter(d => !selectedDistortions.includes(d));

    let points = 0;
    if (correctlyIdentified.length === correctDistortions.length && incorrectlyIdentified.length === 0) {
      points = currentCase.difficulty === 'easy' ? 10 : currentCase.difficulty === 'medium' ? 15 : 20;
      if (selectedAlternative) points += 5;
    } else if (correctlyIdentified.length > 0) {
      points = Math.floor((correctlyIdentified.length / correctDistortions.length) * 5);
    }

    setScore(prev => prev + points);
    setSolvedCases(prev => prev + 1);
    setShowResults(true);

    // Check for level up
    const newLevel = Math.floor(score / 50) + 1;
    if (newLevel > level) {
      setLevel(newLevel);
      toast({
        title: "Level Up! 🎉",
        description: `You've reached Detective Level ${newLevel}!`,
      });
    }

    // Check for new badges
    correctlyIdentified.forEach(distortionId => {
      if (!earnedBadges.includes(distortionId)) {
        const distortion = distortions.find(d => d.id === distortionId);
        if (distortion) {
          setEarnedBadges(prev => [...prev, distortionId]);
          toast({
            title: `New Badge Earned! ${distortion.badge}`,
            description: `${distortion.name} Detective`,
          });
        }
      }
    });

    toast({
      title: points > 0 ? "Case Solved!" : "Case Reviewed",
      description: `You earned ${points} clarity points!`,
    });
  };

  if (!currentCase) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-100 to-blue-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/games')}
          className="gap-2 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Games
        </Button>

        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Thought Detective 🕵️‍♀️
            </h1>
            <p className="text-lg text-muted-foreground">
              Investigate negative thoughts and uncover cognitive distortions
            </p>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <Card className="text-center p-4">
              <div className="text-2xl font-bold text-primary">{score}</div>
              <div className="text-sm text-muted-foreground">Clarity Points</div>
            </Card>
            <Card className="text-center p-4">
              <div className="text-2xl font-bold text-primary">Level {level}</div>
              <div className="text-sm text-muted-foreground">Detective Rank</div>
            </Card>
            <Card className="text-center p-4">
              <div className="text-2xl font-bold text-primary">{solvedCases}</div>
              <div className="text-sm text-muted-foreground">Cases Solved</div>
            </Card>
            <Card className="text-center p-4">
              <div className="text-2xl font-bold text-primary">{earnedBadges.length}</div>
              <div className="text-sm text-muted-foreground">Badges Earned</div>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Case File */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Case File #{currentCase.id}
                </CardTitle>
                <Badge variant={currentCase.difficulty === 'easy' ? 'secondary' : currentCase.difficulty === 'medium' ? 'default' : 'destructive'}>
                  {currentCase.difficulty.toUpperCase()}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-accent/10 rounded-lg">
                  <h3 className="font-medium mb-2">Negative Thought:</h3>
                  <p className="text-sm italic">"{currentCase.thought}"</p>
                </div>

                <div>
                  <h3 className="font-medium mb-3">Identify Cognitive Distortions:</h3>
                  <div className="grid grid-cols-1 gap-2">
                    {distortions.map((distortion) => (
                      <Button
                        key={distortion.id}
                        variant={selectedDistortions.includes(distortion.id) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleDistortion(distortion.id)}
                        disabled={showResults}
                        className="justify-start text-left h-auto p-3"
                      >
                        <div>
                          <div className="font-medium">{distortion.badge} {distortion.name}</div>
                          <div className="text-xs opacity-70">{distortion.description}</div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-3">Choose a Balanced Alternative:</h3>
                  <div className="space-y-2">
                    {currentCase.alternatives.map((alternative, index) => (
                      <Button
                        key={index}
                        variant={selectedAlternative === alternative ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedAlternative(alternative)}
                        disabled={showResults}
                        className="w-full text-left h-auto p-3 justify-start"
                      >
                        <span className="text-sm">{alternative}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {!showResults ? (
                  <Button 
                    onClick={solveCase}
                    className="w-full"
                    disabled={selectedDistortions.length === 0}
                  >
                    Solve Case
                  </Button>
                ) : (
                  <Button 
                    onClick={loadNewCase}
                    className="w-full"
                  >
                    Next Case
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Progress & Badges */}
            <div className="space-y-6">
              {showResults && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5" />
                      Case Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium text-green-600">Correct Distortions:</h4>
                        {currentCase.distortions.map(id => {
                          const distortion = distortions.find(d => d.id === id);
                          return (
                            <Badge key={id} variant="secondary" className="mr-2">
                              {distortion?.badge} {distortion?.name}
                            </Badge>
                          );
                        })}
                      </div>
                      {selectedDistortions.filter(d => !currentCase.distortions.includes(d)).length > 0 && (
                        <div>
                          <h4 className="font-medium text-red-600">Incorrectly Selected:</h4>
                          {selectedDistortions.filter(d => !currentCase.distortions.includes(d)).map(id => {
                            const distortion = distortions.find(d => d.id === id);
                            return (
                              <Badge key={id} variant="destructive" className="mr-2">
                                {distortion?.badge} {distortion?.name}
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Detective Badges
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {distortions.map((distortion) => {
                      const earned = earnedBadges.includes(distortion.id);
                      return (
                        <div
                          key={distortion.id}
                          className={`text-center p-3 rounded-lg border ${
                            earned ? 'bg-accent/20 border-accent' : 'bg-muted/20 border-muted'
                          }`}
                        >
                          <div className={`text-2xl mb-1 ${earned ? '' : 'grayscale'}`}>
                            {distortion.badge}
                          </div>
                          <div className="text-xs font-medium">{distortion.name}</div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Progress to Next Level</CardTitle>
                </CardHeader>
                <CardContent>
                  <Progress value={(score % 50) * 2} className="mb-2" />
                  <p className="text-sm text-muted-foreground text-center">
                    {50 - (score % 50)} points to Level {level + 1}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThoughtDetective;