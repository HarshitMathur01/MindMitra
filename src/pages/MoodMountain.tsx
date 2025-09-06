import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Mountain, Sun, Cloud, CloudRain, Flower } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Activity {
  id: string;
  name: string;
  points: number;
  category: 'exercise' | 'social' | 'creative' | 'self-care';
}

interface Weather {
  type: 'sunny' | 'cloudy' | 'rainy';
  icon: typeof Sun | typeof Cloud | typeof CloudRain;
  description: string;
}

const MoodMountain = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [progress, setProgress] = useState(0);
  const [mood, setMood] = useState(5);
  const [completedActivities, setCompletedActivities] = useState<string[]>([]);
  const [gardens, setGardens] = useState(0);
  const [currentWeather, setCurrentWeather] = useState<Weather>({
    type: 'sunny',
    icon: Sun,
    description: 'Clear skies ahead!'
  });

  const activities: Activity[] = [
    { id: '1', name: 'Take a 10-minute walk', points: 10, category: 'exercise' },
    { id: '2', name: 'Call a friend or family member', points: 15, category: 'social' },
    { id: '3', name: 'Practice deep breathing', points: 8, category: 'self-care' },
    { id: '4', name: 'Write in a journal', points: 12, category: 'creative' },
    { id: '5', name: 'Listen to uplifting music', points: 8, category: 'self-care' },
    { id: '6', name: 'Do 5 minutes of stretching', points: 10, category: 'exercise' },
    { id: '7', name: 'Send an encouraging text', points: 12, category: 'social' },
    { id: '8', name: 'Draw or sketch something', points: 15, category: 'creative' },
  ];

  const weathers: Weather[] = [
    { type: 'sunny', icon: Sun, description: 'Beautiful clear day for climbing!' },
    { type: 'cloudy', icon: Cloud, description: 'Partly cloudy but still good progress' },
    { type: 'rainy', icon: CloudRain, description: 'Stormy weather, but you can push through' }
  ];

  useEffect(() => {
    // Update weather based on mood
    let weatherIndex = 0;
    if (mood >= 7) weatherIndex = 0; // sunny
    else if (mood >= 4) weatherIndex = 1; // cloudy
    else weatherIndex = 2; // rainy
    
    setCurrentWeather(weathers[weatherIndex]);
  }, [mood]);

  const completeActivity = (activity: Activity) => {
    if (completedActivities.includes(activity.id)) return;
    
    setCompletedActivities(prev => [...prev, activity.id]);
    setProgress(prev => Math.min(prev + activity.points, 100));
    
    // Plant a garden every 30 points
    if ((progress + activity.points) % 30 === 0) {
      setGardens(prev => prev + 1);
      toast({
        title: "Garden Planted! 🌸",
        description: "You've planted a beautiful garden along your path!",
      });
    }
    
    toast({
      title: "Great work!",
      description: `You climbed ${activity.points} steps up the mountain!`,
    });
  };

  const updateMood = (newMood: number) => {
    setMood(newMood);
    toast({
      title: "Mood updated",
      description: "The weather on your mountain is changing!",
    });
  };

  const WeatherIcon = currentWeather.icon;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 to-green-100 dark:from-slate-900 dark:to-slate-800">
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
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              Mood Mountain 🏔️
            </h1>
            <p className="text-lg text-muted-foreground">
              Climb to new heights through positive activities and self-care
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Mountain Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mountain className="h-5 w-5" />
                  Your Mountain Journey
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center">
                  <div className="text-6xl mb-4">
                    {progress < 25 ? '⛰️' : progress < 50 ? '🏔️' : progress < 75 ? '🗻' : '🏔️✨'}
                  </div>
                  <Progress value={progress} className="mb-2" />
                  <p className="text-sm text-muted-foreground">{progress}/100 steps climbed</p>
                </div>

                <div className="text-center p-4 bg-accent/10 rounded-lg">
                  <WeatherIcon className="h-8 w-8 mx-auto mb-2 text-accent" />
                  <p className="text-sm font-medium">{currentWeather.description}</p>
                </div>

                {gardens > 0 && (
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-2xl mb-2">
                      {Array.from({ length: gardens }, (_, i) => '🌸').join('')}
                    </div>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {gardens} garden{gardens > 1 ? 's' : ''} planted along your path!
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Mood & Activities */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Check-in</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="text-sm font-medium mb-3 block">
                    How are you feeling today? (1-10)
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
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
                  <p className="text-xs text-muted-foreground mt-2">
                    Your mood affects the weather on your mountain!
                  </p>
                </div>

                <div>
                  <h3 className="font-medium mb-3">Positive Activities</h3>
                  <div className="space-y-2">
                    {activities.map((activity) => {
                      const isCompleted = completedActivities.includes(activity.id);
                      return (
                        <Button
                          key={activity.id}
                          variant={isCompleted ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => completeActivity(activity)}
                          disabled={isCompleted}
                          className="w-full justify-between text-left h-auto p-3"
                        >
                          <span className="text-sm">{activity.name}</span>
                          <span className="text-xs opacity-70">
                            {isCompleted ? '✓' : `+${activity.points}`}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {progress >= 100 && (
            <Card className="mt-8 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20">
              <CardContent className="text-center py-8">
                <div className="text-6xl mb-4">🏆🏔️</div>
                <h2 className="text-2xl font-bold mb-2">Summit Reached!</h2>
                <p className="text-muted-foreground mb-4">
                  Congratulations! You've reached the peak through positive activities and self-care.
                </p>
                <Button 
                  onClick={() => {
                    setProgress(0);
                    setCompletedActivities([]);
                    setGardens(0);
                    toast({
                      title: "New mountain awaits!",
                      description: "Ready for your next climbing adventure?",
                    });
                  }}
                >
                  Start New Mountain
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default MoodMountain;