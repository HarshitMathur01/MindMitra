import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Header from "@/components/layout/Header";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface EmotionImage {
  id: string;
  src: string;
  alt: string;
  suggestedEmotion: string;
}

interface EmotionMatch {
  imageId: string;
  emotion: string;
  customText: string;
}

const EmotionMatch = () => {
  const navigate = useNavigate();
  
  const emotionImages: EmotionImage[] = [
    {
      id: "sad",
      src: "/lovable-uploads/a30f36a7-4edf-4c87-ac6b-54df8cfec946.png",
      alt: "Girl with sad expression holding teddy bear",
      suggestedEmotion: "Sad"
    },
    {
      id: "happy",
      src: "/lovable-uploads/92c8c1ff-f06f-4df2-bf4e-d36653cb59b4.png",
      alt: "Girl with happy expression and arms outstretched",
      suggestedEmotion: "Happy"
    },
    {
      id: "angry",
      src: "/lovable-uploads/bd70df3f-9735-4124-a664-044af239645e.png",
      alt: "Girl with angry expression and clenched fists",
      suggestedEmotion: "Angry"
    },
    {
      id: "thoughtful",
      src: "/lovable-uploads/e209fa9d-6d2d-4c90-aef0-4c2e5f773464.png",
      alt: "Girl with thoughtful expression, hand on chin",
      suggestedEmotion: "Thoughtful"
    },
    {
      id: "melancholy",
      src: "/lovable-uploads/b6044853-3838-442f-a80f-349137c60e09.png",
      alt: "Girl with melancholy expression looking down",
      suggestedEmotion: "Melancholy"
    }
  ];

  const emotionWords = [
    "Happy", "Sad", "Angry", "Excited", "Worried", "Calm", 
    "Frustrated", "Peaceful", "Anxious", "Joyful", "Thoughtful", 
    "Confused", "Proud", "Scared", "Curious", "Melancholy"
  ];

  const [matches, setMatches] = useState<EmotionMatch[]>([]);
  const [draggedEmotion, setDraggedEmotion] = useState<string | null>(null);
  const [customEmotions, setCustomEmotions] = useState<{[key: string]: string}>({});

  const handleDragStart = (emotion: string) => {
    setDraggedEmotion(emotion);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, imageId: string) => {
    e.preventDefault();
    if (draggedEmotion) {
      const existingMatch = matches.find(m => m.imageId === imageId);
      if (existingMatch) {
        setMatches(matches.map(m => 
          m.imageId === imageId 
            ? { ...m, emotion: draggedEmotion }
            : m
        ));
      } else {
        setMatches([...matches, { 
          imageId, 
          emotion: draggedEmotion, 
          customText: customEmotions[imageId] || "" 
        }]);
      }
      setDraggedEmotion(null);
    }
  };

  const handleCustomTextChange = (imageId: string, text: string) => {
    setCustomEmotions({ ...customEmotions, [imageId]: text });
    const existingMatch = matches.find(m => m.imageId === imageId);
    if (existingMatch) {
      setMatches(matches.map(m => 
        m.imageId === imageId 
          ? { ...m, customText: text }
          : m
      ));
    } else {
      setMatches([...matches, { 
        imageId, 
        emotion: "", 
        customText: text 
      }]);
    }
  };

  const resetGame = () => {
    setMatches([]);
    setCustomEmotions({});
    setDraggedEmotion(null);
  };

  const getMatchForImage = (imageId: string) => {
    return matches.find(m => m.imageId === imageId);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/games')}
            className="gap-2 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Games
          </Button>
          
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Emotion Match Game
            </h1>
            <Button onClick={resetGame} variant="outline" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
          
          <p className="text-lg text-muted-foreground max-w-2xl mb-6">
            Look at each girl's expression and drag an emotion word to match what you think she's feeling. 
            You can also write your own description of the emotion in the text box below each image.
          </p>
        </div>

        {/* Emotion Words Bank */}
        <Card className="p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Emotion Words</h2>
          <div className="flex flex-wrap gap-2">
            {emotionWords.map((emotion) => (
              <div
                key={emotion}
                draggable
                onDragStart={() => handleDragStart(emotion)}
                className="px-3 py-2 bg-accent/10 text-accent rounded-lg cursor-grab active:cursor-grabbing hover:bg-accent/20 transition-colors select-none"
              >
                {emotion}
              </div>
            ))}
          </div>
        </Card>

        {/* Images Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {emotionImages.map((image) => {
            const match = getMatchForImage(image.id);
            return (
              <Card 
                key={image.id} 
                className="p-4 hover-lift"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, image.id)}
              >
                <div className="aspect-square mb-4 rounded-lg overflow-hidden bg-muted">
                  <img 
                    src={image.src} 
                    alt={image.alt}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                {/* Dropped Emotion */}
                {match?.emotion && (
                  <div className="mb-3 p-2 bg-primary/10 text-primary rounded-lg text-center font-medium">
                    {match.emotion}
                  </div>
                )}
                
                {/* Custom Text Input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Or describe the emotion in your own words:
                  </label>
                  <Textarea
                    placeholder="How do you think she's feeling?"
                    value={customEmotions[image.id] || ""}
                    onChange={(e) => handleCustomTextChange(image.id, e.target.value)}
                    className="min-h-[80px] resize-none"
                  />
                </div>
                
                {/* Drop Zone */}
                <div className="mt-3 p-4 border-2 border-dashed border-muted-foreground/20 rounded-lg text-center text-muted-foreground text-sm">
                  {match?.emotion ? "Drop new emotion to replace" : "Drop an emotion word here"}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Summary */}
        {matches.length > 0 && (
          <Card className="mt-8 p-6">
            <h2 className="text-xl font-semibold mb-4">Your Emotion Matches</h2>
            <div className="space-y-2">
              {matches.map((match) => {
                const image = emotionImages.find(img => img.id === match.imageId);
                return (
                  <div key={match.imageId} className="flex items-center gap-4">
                    <span className="font-medium">{image?.alt}:</span>
                    {match.emotion && (
                      <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                        {match.emotion}
                      </span>
                    )}
                    {match.customText && (
                      <span className="italic text-muted-foreground">
                        "{match.customText}"
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </main>
    </div>
  );
};

export default EmotionMatch;