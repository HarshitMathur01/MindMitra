import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft } from "lucide-react"; 
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import Confetti from "react-confetti";

interface Activity {
  id: string;
  name: string;
  points: number;
  category: "exercise" | "social" | "creative" | "self-care";
}

interface Weather {
  type: "sunny" | "cloudy" | "rainy";
  description: string;
}

const activities: Activity[] = [
  { id: "1", name: "Take a 10-minute walk", points: 20, category: "exercise" },
  { id: "2", name: "Call a friend", points: 15, category: "social" },
  { id: "3", name: "Write in a journal", points: 15, category: "creative" },
  { id: "4", name: "Meditate for 5 minutes", points: 10, category: "self-care" },
  { id: "5", name: "Stretch for 5 minutes", points: 15, category: "exercise" },
  { id: "6", name: "Listen to uplifting music", points: 15, category: "self-care" },
  { id: "7", name: "Practice deep breathing", points: 10, category: "self-care" },
];

const weathers: Weather[] = [
  { type: "sunny", description: "Beautiful clear day for climbing!" },
  { type: "cloudy", description: "Partly cloudy but still good progress" },
  { type: "rainy", description: "Stormy weather, but you can push through" },
];

const activityToElement: Record<string, string> = {
  "1": "clouds",
  "2": "hills",
  "3": "flowers",
  "4": "lake",
  "5": "trees",
  "6": "sun",
  "7": "grass",
};

const SunSVG = ({ className = "" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 64 64" width="160" height="160" aria-hidden>
    <defs>
      <radialGradient id="gSun" cx="50%" cy="40%">
        <stop offset="0%" stopColor="#FFD166" />
        <stop offset="100%" stopColor="#FFB703" />
      </radialGradient>
    </defs>
    <circle cx="32" cy="24" r="10" fill="url(#gSun)" />
    <g stroke="#FFC857" strokeWidth="2" strokeLinecap="round">
      <line x1="32" y1="2" x2="32" y2="12" />
      <line x1="32" y1="36" x2="32" y2="46" />
      <line x1="2" y1="24" x2="12" y2="24" />
      <line x1="52" y1="24" x2="62" y2="24" />
      <line x1="10" y1="6" x2="18" y2="14" />
      <line x1="46" y1="34" x2="54" y2="42" />
      <line x1="46" y1="14" x2="54" y2="6" />
      <line x1="10" y1="42" x2="18" y2="34" />
    </g>
  </svg>
);

const CloudsSVG = ({ className = "" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 200 60" width="340" height="120" aria-hidden>
    <g fill="#a1e5e9ff" opacity="0.95">
      <ellipse cx="0" cy="30" rx="40" ry="18" />
      <ellipse cx="90" cy="24" rx="28" ry="14" />
      <ellipse cx="130" cy="32" rx="36" ry="16" />
      <ellipse cx="10" cy="28" rx="20" ry="12" />
    </g>
  </svg>
);

const HillsSVG = ({ className = "" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 400 120" width="420" height="140" aria-hidden>
    <defs>
      <linearGradient id="gHill" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#8DD3C7" />
        <stop offset="100%" stopColor="#5FB79A" />
      </linearGradient>
    </defs>
    <path d="M0 100 C 60 40, 140 40, 200 100 C 260 160, 340 160, 400 100 L400 140 L0 140 Z" fill="url(#gHill)" />
    <path d="M50 100 C 110 60, 180 60, 240 100 C 300 140, 360 140, 400 100 L400 140 L0 140 Z" fill="#A7E3C9" opacity="0.7" />
  </svg>
);

const TreesSVG = ({ className = "" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 120 120" width="220" height="220" aria-hidden>
    <g>
      <rect x="54" y="72" width="12" height="28" rx="2" fill="#8B5E3C" />
      <ellipse cx="60" cy="60" rx="28" ry="28" fill="#2E8B57" />
      <ellipse cx="44" cy="48" rx="18" ry="18" fill="#2E8B57" />
      <ellipse cx="76" cy="48" rx="18" ry="18" fill="#2E8B57" />
    </g>
  </svg>
);

const LakeSVG = ({ className = "" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 200 60" width="320" height="110" aria-hidden>
    <ellipse cx="100" cy="34" rx="80" ry="16" fill="#7AD0F5" />
    <ellipse cx="85" cy="30" rx="34" ry="6" fill="#AEE8FF" opacity="0.5" />
  </svg>
);

const GrassSVG = ({ className = "" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 400 80" width="420" height="100" aria-hidden>
    <g fill="#2F9E44">
      <path d="M10 60 C 20 30, 30 30, 40 60" />
      <path d="M60 60 C 70 30, 80 30, 90 60" />
      <path d="M110 60 C 120 30, 130 30, 140 60" />
      <path d="M170 60 C 180 30, 190 30, 200 60" />
      <rect x="0" y="18" width="400" height="50" fill="#3BB043" />
    </g>
  </svg>
);

const FlowersSVG = ({ className = "" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 200 200" aria-hidden>
    <g>
      {[
        { x: -10, y: 60, scale: 0.5 },
        { x: 60, y: 95, scale: 0.6 },
        { x: 150, y: 50, scale: 0.55 },
        { x: 100, y: 20, scale: 0.5 },
      ].map((flower, idx) => (
        <g key={idx} transform={`translate(${flower.x},${flower.y}) scale(${flower.scale})`}>
          {[0, 72, 144, 216, 288].map((angle) => (
            <ellipse
              key={angle}
              cx={20 * Math.cos((angle * Math.PI) / 180)}
              cy={20 * Math.sin((angle * Math.PI) / 180)}
              rx="12"
              ry="20"
              fill="#FF69B4"
              transform={`rotate(${angle})`}
            />
          ))}
          <circle r="10" fill="#FFD700" />
        </g>
      ))}
    </g>
  </svg>
);


const getBgClass = (mood: number) => {
  if (mood <= 3) return "from-gray-500 to-gray-700";
  if (mood <= 6) return "from-sky-200 to-sky-400";
  if (mood <= 8) return "from-sky-400 to-yellow-200";
  return "from-yellow-300 to-pink-200";
};

const MoodMountain = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [progress, setProgress] = useState(0);
  const [mood, setMood] = useState(5);
  const [completedActivities, setCompletedActivities] = useState<string[]>([]);
  const [showSummitPopup, setShowSummitPopup] = useState(false);
  const [confettiOn, setConfettiOn] = useState(false);
  const [currentWeather, setCurrentWeather] = useState<Weather>(weathers[0]);

  useEffect(() => {
    let idx = 0;
    if (mood >= 7) idx = 0;
    else if (mood >= 4) idx = 1;
    else idx = 2;
    setCurrentWeather(weathers[idx]);
  }, [mood]);

  const completeActivity = (activity: Activity) => {
    if (completedActivities.includes(activity.id)) return;

    setCompletedActivities((prev) => [...prev, activity.id]);
    const newProgress = Math.min(progress + activity.points, 100);
    setProgress(newProgress);

    toast({
      title: "Nice!",
      description: `You completed: ${activity.name}`,
    });

    if (newProgress >= 100) {
      setShowSummitPopup(true);
      setConfettiOn(true);
    }
  };

  const updateMood = (newMood: number) => {
    setMood(newMood);
    toast({
      title: "Mood updated",
      description: "Your scenery background just changed!",
    });
  };

  const elementForActivity = (id: string) => activityToElement[id];
  const elementsOrder = ["sun", "clouds", "hills", "trees", "lake", "grass", "flowers"];

  return (
    <div className={`min-h-screen bg-gradient-to-b ${getBgClass(mood)} transition-colors duration-700`}>
      {confettiOn && <Confetti recycle={false} numberOfPieces={250} />}

      {showSummitPopup && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
          <motion.div
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl text-center max-w-sm"
          >
            <h3 className="text-2xl font-bold mb-2"> Summit Reached!</h3>
            <p className="text-sm text-muted-foreground mb-4">
              You built a beautiful scene — nice work taking care of yourself!
            </p>
            <div className="flex justify-center gap-3">
              <Button
                onClick={() => {
                  setProgress(0);
                  setCompletedActivities([]);
                  setShowSummitPopup(false);
                  setConfettiOn(false);
                  toast({
                    title: "New mountain awaits!",
                    description: "Ready for another journey?",
                  });
                }}
              >
                Start New Mountain
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowSummitPopup(false);
                  setConfettiOn(false);
                }}
              >
                Close
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" onClick={() => navigate("/games")}>
            <ArrowLeft className="h-4 w-4" /> Back to Games
          </Button>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-blue-600">
              Mood Mountain — Build Your Scenery
            </h1>
            <p className="text-sm text-muted-foreground text-white">Mood sets the sky — activities grow the landscape.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">Your Mountain Scenery</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative w-full h-72 rounded-lg overflow-hidden bg-transparent">
                  {elementsOrder.map((el) => {
                    const isAdded = completedActivities.some((aid) => elementForActivity(aid) === el);
                    if (!isAdded) return null;

                    const config: Record<string, any> = {
                      sun: { style: { right: "6%", top: "6%" }, sizeClass: "w-40 h-40" },
                      clouds: { style: { left: "6%", top: "8%" }, sizeClass: "w-3/4 h-auto" },
                      hills: { style: { left: 0, bottom: "18%" }, sizeClass: "w-full h-auto" },
                      trees: { style: { left: "10%", bottom: "28%" }, sizeClass: "w-32 h-32" },
                      lake: { style: { left: "48%", bottom: "12%" }, sizeClass: "w-44 h-20" },
                      grass: { style: { left: 0, bottom: 0 }, sizeClass: "w-full h-auto" },
                      flowers: { style: { left: "20%", bottom: "6%" }, sizeClass: "w-32 h-24" },
                    };

                    const cfg = config[el] || { style: {}, sizeClass: "w-24 h-24" };

                    let ElementComponent: JSX.Element | null = null;
                    if (el === "sun") ElementComponent = <SunSVG className={cfg.sizeClass} />;
                    if (el === "clouds") ElementComponent = <CloudsSVG className={cfg.sizeClass} />;
                    if (el === "hills") ElementComponent = <HillsSVG className={cfg.sizeClass} />;
                    if (el === "trees") ElementComponent = <TreesSVG className={cfg.sizeClass} />;
                    if (el === "lake") ElementComponent = <LakeSVG className={cfg.sizeClass} />;
                    if (el === "grass") ElementComponent = <GrassSVG className={cfg.sizeClass} />;
                    if (el === "flowers") ElementComponent = <FlowersSVG className={cfg.sizeClass} />;

                    return (
                      <motion.div
                        key={el}
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.6 }}
                        style={{ position: "absolute", pointerEvents: "none", ...cfg.style }}
                      >
                        {ElementComponent}
                      </motion.div>
                    );
                  })}
                </div>

                <div className="mt-4">
                  <Progress value={progress} className="mb-2" />
                  <p className="text-sm text-muted-foreground">{progress}/100 steps climbed</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Daily Check-in & Activities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">How are you feeling today? (1-10)</label>
                  <div className="grid grid-cols-5 gap-2">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                      <Button
                        key={num}
                        variant={mood === num ? "default" : "outline"}
                        size="sm"
                        onClick={() => updateMood(num)}
                        className="h-8"
                      >
                        {num}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Mood changes the sky and weather.</p>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Positive Activities</h4>
                  <div className="space-y-2">
                    {activities.map((activity) => {
                      const done = completedActivities.includes(activity.id);
                      return (
                        <Button
                          key={activity.id}
                          variant={done ? "secondary" : "outline"}
                          disabled={done}
                          className="w-full justify-between"
                          onClick={() => completeActivity(activity)}
                        >
                          <span>{activity.name}</span>
                          <span className="text-xs font-semibold">+{activity.points}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MoodMountain;
