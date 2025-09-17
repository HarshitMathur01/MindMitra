import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { useGameDataSaver } from '@/lib/gameDataSaver';

interface Question {
  id: number;
  text: string;
  metaphor: string;
  options: {
    emoji: string;
    label: string;
    value: number;
  }[];
}

const questions: Question[] = [
  {
    id: 1,
    text: "How would you describe your energy today?",
    metaphor: "Like a battery...",
    options: [
      { emoji: "🔋", label: "Fully charged", value: 5 },
      { emoji: "🔌", label: "Plugged in", value: 4 },
      { emoji: "📱", label: "Half battery", value: 3 },
      { emoji: "🪫", label: "Low battery", value: 2 },
      { emoji: "💀", label: "Completely drained", value: 1 },
    ],
  },
  {
    id: 2,
    text: "Your mood feels like...",
    metaphor: "A weather pattern",
    options: [
      { emoji: "☀️", label: "Bright sunshine", value: 5 },
      { emoji: "⛅", label: "Partly cloudy", value: 4 },
      { emoji: "☁️", label: "Overcast", value: 3 },
      { emoji: "🌧️", label: "Light rain", value: 2 },
      { emoji: "⛈️", label: "Stormy", value: 1 },
    ],
  },
  {
    id: 3,
    text: "Your thoughts today are like...",
    metaphor: "Water in motion",
    options: [
      { emoji: "🌊", label: "Calm ocean", value: 5 },
      { emoji: "🏞️", label: "Gentle stream", value: 4 },
      { emoji: "💧", label: "Steady drip", value: 3 },
      { emoji: "🌀", label: "Swirling whirlpool", value: 2 },
      { emoji: "🌪️", label: "Chaotic rapids", value: 1 },
    ],
  },
  {
    id: 4,
    text: "Your stress level feels like...",
    metaphor: "A pressure cooker",
    options: [
      { emoji: "🧘", label: "Zen garden", value: 5 },
      { emoji: "🍃", label: "Gentle breeze", value: 4 },
      { emoji: "🎈", label: "Balloon pressure", value: 3 },
      { emoji: "🔥", label: "Building heat", value: 2 },
      { emoji: "💥", label: "About to explode", value: 1 },
    ],
  },
  {
    id: 5,
    text: "Your motivation is like...",
    metaphor: "A fire burning",
    options: [
      { emoji: "🔥", label: "Roaring bonfire", value: 5 },
      { emoji: "🕯️", label: "Steady candle", value: 4 },
      { emoji: "✨", label: "Flickering spark", value: 3 },
      { emoji: "🌫️", label: "Smoldering embers", value: 2 },
      { emoji: "💨", label: "Blown out", value: 1 },
    ],
  },
  {
    id: 6,
    text: "Your social energy feels like...",
    metaphor: "A social creature",
    options: [
      { emoji: "🦋", label: "Social butterfly", value: 5 },
      { emoji: "🐝", label: "Busy bee", value: 4 },
      { emoji: "🐱", label: "Curious cat", value: 3 },
      { emoji: "🐢", label: "Slow turtle", value: 2 },
      { emoji: "🦔", label: "Hiding hedgehog", value: 1 },
    ],
  },
  {
    id: 7,
    text: "Your focus today is like...",
    metaphor: "A camera lens",
    options: [
      { emoji: "🔍", label: "Crystal clear", value: 5 },
      { emoji: "📸", label: "In focus", value: 4 },
      { emoji: "👁️", label: "Slightly blurry", value: 3 },
      { emoji: "🌫️", label: "Out of focus", value: 2 },
      { emoji: "💫", label: "Completely scattered", value: 1 },
    ],
  },
  {
    id: 8,
    text: "Your confidence feels like...",
    metaphor: "A mountain climber",
    options: [
      { emoji: "🏔️", label: "Peak summit", value: 5 },
      { emoji: "🧗", label: "Steady climbing", value: 4 },
      { emoji: "🚶", label: "Walking the path", value: 3 },
      { emoji: "🪨", label: "Rocky terrain", value: 2 },
      { emoji: "🕳️", label: "In a valley", value: 1 },
    ],
  },
  {
    id: 9,
    text: "Your sleep quality was like...",
    metaphor: "A cozy blanket",
    options: [
      { emoji: "😴", label: "Wrapped in clouds", value: 5 },
      { emoji: "🛏️", label: "Comfortable bed", value: 4 },
      { emoji: "💤", label: "Restful sleep", value: 3 },
      { emoji: "😵‍💫", label: "Tossing and turning", value: 2 },
      { emoji: "🧟", label: "Walking dead", value: 1 },
    ],
  },
  {
    id: 10,
    text: "Overall, you feel like...",
    metaphor: "A garden in a season",
    options: [
      { emoji: "🌸", label: "Spring bloom", value: 5 },
      { emoji: "🌻", label: "Summer sunshine", value: 4 },
      { emoji: "🍂", label: "Autumn balance", value: 3 },
      { emoji: "❄️", label: "Winter rest", value: 2 },
      { emoji: "🌵", label: "Surviving drought", value: 1 },
    ],
  },
];

const WellnessCheckIn = () => {
  const navigate = useNavigate();
  const { saveWellnessCheckIn } = useGameDataSaver();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [startTime] = useState<number>(Date.now());

  const handleAnswer = (value: number) => {
    setAnswers(prev => ({ ...prev, [questions[currentQuestion].id]: value }));
  };

  const handleNext = async () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      setShowResults(true);
      
      // Save wellness check-in data
      try {
        const totalScore = Object.values(answers).reduce((sum, score) => sum + score, 0);
        const averageScore = totalScore / Object.keys(answers).length;
        const categories = questions.map(q => q.metaphor);
        const duration = Date.now() - startTime;
        
        await saveWellnessCheckIn(
          answers,
          Math.round(averageScore * 20), // Convert to 0-100 scale
          categories
        );
      } catch (error) {
        console.error('Failed to save WellnessCheckIn data:', error);
      }
    }
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const handleRestart = () => {
    setCurrentQuestion(0);
    setAnswers({});
    setShowResults(false);
  };

  const calculateResults = () => {
    const totalScore = Object.values(answers).reduce((sum, score) => sum + score, 0);
    const averageScore = totalScore / Object.keys(answers).length;
    
    if (averageScore >= 4.5) return { level: "Thriving", emoji: "🌟", description: "You're doing exceptionally well! Your wellbeing is flourishing." };
    if (averageScore >= 3.5) return { level: "Balanced", emoji: "⚖️", description: "You're in a good place with some areas to nurture." };
    if (averageScore >= 2.5) return { level: "Managing", emoji: "🌱", description: "You're coping well, with room for self-care and growth." };
    if (averageScore >= 1.5) return { level: "Struggling", emoji: "🤗", description: "Things feel challenging right now. Consider reaching out for support." };
    return { level: "Overwhelmed", emoji: "💙", description: "You're going through a tough time. Please prioritize self-care and seek help." };
  };

  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const canGoNext = answers[questions[currentQuestion]?.id] !== undefined;

  if (showResults) {
    const results = calculateResults();
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Card className="max-w-2xl mx-auto p-8 text-center">
            <div className="text-6xl mb-4">{results.emoji}</div>
            <h1 className="text-3xl font-bold mb-4 text-primary">{results.level}</h1>
            <p className="text-lg text-muted-foreground mb-8">{results.description}</p>
            
            <div className="grid gap-4 mb-8">
              <Button onClick={handleRestart} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Take Again
              </Button>
              <Button variant="outline" onClick={() => navigate('/qa-tests')}>
                Back to Q&A Tests
              </Button>
              <Button variant="ghost" onClick={() => navigate('/')}>
                Home
              </Button>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  const question = questions[currentQuestion];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/qa-tests')}
            className="gap-2 mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Q&A Tests
          </Button>

          <div className="mb-6">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>Question {currentQuestion + 1} of {questions.length}</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <Card className="p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">{question.text}</h2>
              <p className="text-muted-foreground italic">{question.metaphor}</p>
            </div>

            <div className="grid gap-3 mb-8">
              {question.options.map((option) => (
                <Button
                  key={option.value}
                  variant={answers[question.id] === option.value ? "default" : "outline"}
                  className="h-auto py-4 text-left justify-start gap-4"
                  onClick={() => handleAnswer(option.value)}
                >
                  <span className="text-2xl">{option.emoji}</span>
                  <span className="text-base">{option.label}</span>
                </Button>
              ))}
            </div>

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentQuestion === 0}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              
              <Button
                onClick={handleNext}
                disabled={!canGoNext}
                className="gap-2"
              >
                {currentQuestion === questions.length - 1 ? 'See Results' : 'Next'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default WellnessCheckIn;