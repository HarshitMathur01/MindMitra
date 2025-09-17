import { useState } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import Header from "@/components/layout/Header";
import { ArrowLeft, RotateCcw, CheckCircle2, Heart, Brain, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useGameDataSaver } from "@/lib/gameDataSaver";

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
  const { saveEmotionMatch } = useGameDataSaver();

  const emotionImages: EmotionImage[] = [
    {
      id: "sad",
      src: "/lovable-uploads/a30f36a7-4edf-4c87-ac6b-54df8cfec946.png",
      alt: "Girl with sad expression holding teddy bear",
      suggestedEmotion: "Sad",
    },
    {
      id: "happy",
      src: "/lovable-uploads/92c8c1ff-f06f-4df2-bf4e-d36653cb59b4.png",
      alt: "Girl with happy expression and arms outstretched",
      suggestedEmotion: "Happy",
    },
    {
      id: "angry",
      src: "/lovable-uploads/bd70df3f-9735-4124-a664-044af239645e.png",
      alt: "Girl with angry expression and clenched fists",
      suggestedEmotion: "Angry",
    },
    {
      id: "thoughtful",
      src: "/lovable-uploads/e209fa9d-6d2d-4c90-aef0-4c2e5f773464.png",
      alt: "Girl with thoughtful expression, hand on chin",
      suggestedEmotion: "Thoughtful",
    },
    {
      id: "surprised",
      src: "/lovable-uploads/b6044853-3838-442f-a80f-349137c60e09.png",
      alt: "Girl with surprised expression",
      suggestedEmotion: "Surprised",
    },
  ];

  const emotionOptions = [
    "Happy", "Sad", "Angry", "Surprised", "Thoughtful", "Excited", 
    "Worried", "Calm", "Frustrated", "Content", "Anxious", "Joyful"
  ];

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedEmotion, setSelectedEmotion] = useState("");
  const [customText, setCustomText] = useState("");
  const [matches, setMatches] = useState<EmotionMatch[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [score, setScore] = useState(0);

  const currentImage = emotionImages[currentImageIndex];

  const handleEmotionSelect = (emotion: string) => {
    setSelectedEmotion(emotion);
  };

  const handleNext = async () => {
    if (!selectedEmotion) return;

    const newMatch: EmotionMatch = {
      imageId: currentImage.id,
      emotion: selectedEmotion,
      customText: customText.trim(),
    };

    const newMatches = [...matches, newMatch];
    setMatches(newMatches);

    // Calculate score based on emotion accuracy and custom text
    let points = 10; // Base points
    if (selectedEmotion.toLowerCase() === currentImage.suggestedEmotion.toLowerCase()) {
      points += 15; // Bonus for correct match
    }
    if (customText.trim().length > 10) {
      points += 5; // Bonus for thoughtful description
    }

    const newScore = score + points;
    setScore(newScore);

    if (currentImageIndex === emotionImages.length - 1) {
      setIsCompleted(true);
      try {
        // Calculate correct classifications
        const correctClassifications = newMatches.filter(match => 
          match.emotion.toLowerCase() === 
          emotionImages.find(img => img.id === match.imageId)?.suggestedEmotion.toLowerCase()
        ).length;

        // Create classifications array for detailed analysis
        const classifications = newMatches.map(match => {
          const correctEmotion = emotionImages.find(img => img.id === match.imageId)?.suggestedEmotion;
          const isCorrect = match.emotion.toLowerCase() === correctEmotion?.toLowerCase();
          
          return {
            imageId: match.imageId,
            user_choice: match.emotion,
            correct_emotion: correctEmotion,
            correct: isCorrect,
            custom_text: match.customText
          };
        });

        // Fixed function call with all required parameters
        await saveEmotionMatch(
          newScore,                    // score
          correctClassifications,      // correctClassifications  
          emotionImages.length,        // totalImages
          0,                          // duration (you might want to track actual time)
          classifications,            // classifications array
          undefined                   // sessionId (optional)
        );
        
        console.log('✅ Emotion match result saved!');
      } catch (error) {
        console.error('Failed to save game result:', error);
      }
    } else {
      setCurrentImageIndex(prev => prev + 1);
      setSelectedEmotion("");
      setCustomText("");
    }
  };

  const handleReset = () => {
    setCurrentImageIndex(0);
    setSelectedEmotion("");
    setCustomText("");
    setMatches([]);
    setIsCompleted(false);
    setScore(0);
  };

  const getScoreRating = () => {
    const maxPossible = emotionImages.length * 30;
    const percentage = (score / maxPossible) * 100;
    
    if (percentage >= 90) return { rating: "Emotional Intelligence Master!", color: "text-green-600", icon: Sparkles };
    if (percentage >= 75) return { rating: "Great Emotional Awareness!", color: "text-blue-600", icon: Heart };
    if (percentage >= 60) return { rating: "Good Emotional Understanding!", color: "text-purple-600", icon: Brain };
    return { rating: "Keep exploring emotions!", color: "text-gray-600", icon: Heart };
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

  const imageVariants = {
    enter: { x: 300, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -300, opacity: 0 }
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
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50">
      <Header />
      
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
            💝 Emotion Detective
          </motion.h1>
          
          <Button
            variant="outline"
            onClick={handleReset}
            className="flex items-center gap-2 bg-white/70 backdrop-blur-sm hover:bg-white/90 transition-all duration-300 hover:scale-105"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>

        {!isCompleted ? (
          <motion.div 
            className="max-w-4xl mx-auto"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Progress Bar */}
            <motion.div variants={itemVariants} className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Progress: {currentImageIndex + 1} of {emotionImages.length}
                </span>
                <span className="text-sm font-medium text-purple-600">
                  Score: {score} points
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <motion.div 
                  className="bg-gradient-to-r from-rose-400 to-purple-500 h-3 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentImageIndex + 1) / emotionImages.length) * 100}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Image Section */}
              <motion.div variants={itemVariants}>
                <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-xl p-6">
                  <h3 className="text-xl font-semibold mb-4 text-center text-gray-800">
                    What emotion do you see?
                  </h3>
                  
                  <div className="relative overflow-hidden rounded-lg mb-4">
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={currentImageIndex}
                        variants={imageVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.5 }}
                        src={currentImage.src}
                        alt={currentImage.alt}
                        className="w-full h-64 object-cover rounded-lg"
                      />
                    </AnimatePresence>
                  </div>
                  
                  <p className="text-center text-gray-600 text-sm">
                    {currentImage.alt}
                  </p>
                </Card>
              </motion.div>

              {/* Selection Section */}
              <motion.div variants={itemVariants}>
                <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-xl p-6">
                  <h3 className="text-xl font-semibold mb-4 text-gray-800">
                    Choose the emotion
                  </h3>
                  
                  <div className="grid grid-cols-3 gap-2 mb-6">
                    {emotionOptions.map((emotion, index) => (
                      <motion.button
                        key={emotion}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05, duration: 0.3 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleEmotionSelect(emotion)}
                        className={`p-3 rounded-lg text-sm font-medium transition-all duration-300 ${
                          selectedEmotion === emotion
                            ? 'bg-gradient-to-r from-rose-400 to-purple-500 text-white shadow-lg'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        {emotion}
                      </motion.button>
                    ))}
                  </div>
                  
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Describe what you see (optional):
                    </label>
                    <Textarea
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      placeholder="What details in the image show this emotion? What might this person be thinking or feeling?"
                      className="bg-white/50 border-gray-200 focus:border-purple-400 transition-colors"
                      rows={3}
                    />
                  </div>
                  
                  <Button
                    onClick={handleNext}
                    disabled={!selectedEmotion}
                    className="w-full bg-gradient-to-r from-rose-500 to-purple-600 hover:from-rose-600 hover:to-purple-700 text-white py-3 transition-all duration-300 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {currentImageIndex === emotionImages.length - 1 ? 'Complete' : 'Next Image'}
                  </Button>
                </Card>
              </motion.div>
            </div>
          </motion.div>
        ) : (
          /* Completion Screen */
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
                className="w-20 h-20 bg-gradient-to-br from-rose-400 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <Heart className="h-10 w-10 text-white" />
              </motion.div>
              
              <h2 className="text-3xl font-bold text-gradient mb-4">
                Emotional Journey Complete! 🌟
              </h2>
              
              <div className="mb-6">
                <p className="text-xl text-gray-700 mb-2">
                  {getScoreRating().rating}
                </p>
                <p className="text-3xl font-bold text-purple-600 mb-4">
                  Final Score: {score} points
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-rose-50 p-4 rounded-lg">
                    <p className="font-semibold text-rose-700">Images Analyzed</p>
                    <p className="text-2xl text-rose-600">{matches.length}</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="font-semibold text-purple-700">Accuracy</p>
                    <p className="text-2xl text-purple-600">
                      {Math.round((matches.filter(m => m.emotion.toLowerCase() === 
                        emotionImages.find(img => img.id === m.imageId)?.suggestedEmotion.toLowerCase()).length / matches.length) * 100)}%
                    </p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="font-semibold text-blue-700">Detailed Responses</p>
                    <p className="text-2xl text-blue-600">
                      {matches.filter(m => m.customText.length > 10).length}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4 justify-center">
                <Button
                  onClick={handleReset}
                  className="bg-gradient-to-r from-rose-500 to-purple-600 hover:from-rose-600 hover:to-purple-700 text-white px-8 py-3"
                >
                  Try Again
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
        )}
      </motion.div>
    </div>
  );
};

export default EmotionMatch;
