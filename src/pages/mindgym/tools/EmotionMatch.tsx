import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2 } from "lucide-react";
import TherapeuticGameShell from "@/components/mindgym/TherapeuticGameShell";
import { useGameDataSaver } from "@/lib/gameDataSaver";

interface EmotionImage {
  id: string;
  src: string;
  alt: string;
  suggestedEmotion: string;
}

interface EmotionMatchEntry {
  imageId: string;
  emotion: string;
  customText: string;
}

const EmotionMatch = () => {
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
    "Worried", "Calm", "Frustrated", "Content", "Anxious", "Joyful",
  ];

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedEmotion, setSelectedEmotion] = useState("");
  const [customText, setCustomText] = useState("");
  const [matches, setMatches] = useState<EmotionMatchEntry[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [score, setScore] = useState(0);

  const currentImage = emotionImages[currentImageIndex];

  const handleEmotionSelect = (emotion: string) => {
    setSelectedEmotion(emotion);
  };

  const handleNext = async () => {
    if (!selectedEmotion) return;

    const newMatch: EmotionMatchEntry = {
      imageId: currentImage.id,
      emotion: selectedEmotion,
      customText: customText.trim(),
    };

    const newMatches = [...matches, newMatch];
    setMatches(newMatches);

    let points = 10;
    if (selectedEmotion.toLowerCase() === currentImage.suggestedEmotion.toLowerCase()) {
      points += 15;
    }
    if (customText.trim().length > 10) {
      points += 5;
    }

    const newScore = score + points;
    setScore(newScore);

    if (currentImageIndex === emotionImages.length - 1) {
      setIsCompleted(true);
      try {
        const correctClassifications = newMatches.filter((match) =>
          match.emotion.toLowerCase() ===
          emotionImages.find((img) => img.id === match.imageId)?.suggestedEmotion.toLowerCase()
        ).length;

        const classifications = newMatches.map((match) => {
          const correctEmotion = emotionImages.find((img) => img.id === match.imageId)?.suggestedEmotion;
          const isCorrect = match.emotion.toLowerCase() === correctEmotion?.toLowerCase();

          return {
            imageId: match.imageId,
            user_choice: match.emotion,
            correct_emotion: correctEmotion,
            correct: isCorrect,
            custom_text: match.customText,
          };
        });

        await saveEmotionMatch(
          newScore,
          correctClassifications,
          emotionImages.length,
          0,
          classifications,
          undefined
        );
      } catch (error) {
        console.error("Failed to save game result:", error);
        toast.error("Couldn't sync this session — your score still counts on this device.");
      }
    } else {
      setCurrentImageIndex((prev) => prev + 1);
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

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.3 },
    },
  };

  const imageVariants = {
    enter: { x: 300, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -300, opacity: 0 },
  };

  return (
    <TherapeuticGameShell
      title="Emotion Detective"
      gameId="emotion-match"
      xp={score}
      completed={isCompleted}
      onReset={handleReset}
      themePhase={isCompleted ? "success" : selectedEmotion ? "focus" : "idle"}
    >
      <div className="max-w-4xl mx-auto w-full">
        <motion.div variants={itemVariants} className="mb-8 bg-white/5 p-4 rounded-3xl border border-white/10 backdrop-blur-md">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-white/70 tracking-wide uppercase">
              Image {currentImageIndex + 1} of {emotionImages.length}
            </span>
            <span className="text-sm font-medium text-teal-400">
              {score} XP
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={currentImageIndex + 1}
            aria-valuemin={1}
            aria-valuemax={emotionImages.length}
            aria-label={`Image ${currentImageIndex + 1} of ${emotionImages.length}`}
            className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden"
          >
            <motion.div
              className="bg-teal-400 h-1.5 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${((currentImageIndex + 1) / emotionImages.length) * 100}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          <motion.div variants={itemVariants}>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl p-6 rounded-3xl">
              <h3 className="text-lg font-light tracking-wide mb-6 text-center text-white/80">
                What emotion do you see?
              </h3>

              <div className="relative overflow-hidden rounded-2xl mb-4 shadow-[0_0_30px_rgba(0,0,0,0.2)]">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={currentImageIndex}
                    variants={imageVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3 }}
                    src={currentImage.src}
                    alt={currentImage.alt}
                    className="w-full h-64 object-cover rounded-2xl"
                  />
                </AnimatePresence>
              </div>

              <p className="text-center text-white/50 text-sm italic">
                Observe the facial expression and body language
              </p>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="flex flex-col h-full bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-3xl">
            <div className="grid grid-cols-3 gap-3 mb-8">
              {emotionOptions.map((emotion, index) => (
                <motion.button
                  key={emotion}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleEmotionSelect(emotion)}
                  aria-pressed={selectedEmotion === emotion}
                  className={`py-3 px-2 rounded-2xl text-xs font-medium transition-all duration-300 ${
                    selectedEmotion === emotion
                      ? "bg-teal-500/20 border-teal-500/50 border text-teal-100 shadow-[0_0_15px_rgba(20,184,166,0.2)]"
                      : "bg-white/5 border border-white/5 hover:bg-white/10 text-white/70"
                  }`}
                >
                  {emotion}
                </motion.button>
              ))}
            </div>

            <div className="mb-8 flex-grow">
              <label className="block text-xs font-medium text-white/50 mb-3 tracking-wide uppercase">
                Notes (Optional)
              </label>
              <Textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="What details in the image show this emotion?"
                maxLength={280}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-teal-500/50 transition-colors rounded-2xl resize-none"
                rows={4}
              />
              <p className="mt-2 text-right text-[11px] text-white/40">
                {customText.length} / 280
              </p>
            </div>

            <Button
              onClick={handleNext}
              disabled={!selectedEmotion}
              className={`w-full py-6 rounded-2xl transition-all duration-300 ${
                selectedEmotion
                  ? "bg-teal-500 hover:bg-teal-600 text-white shadow-[0_0_20px_rgba(20,184,166,0.3)]"
                  : "bg-white/5 text-white/30 cursor-not-allowed border border-white/10"
              }`}
            >
              <CheckCircle2 className="h-5 w-5 mr-3" />
              {currentImageIndex === emotionImages.length - 1 ? "Complete Session" : "Continue"}
            </Button>
          </motion.div>
        </div>
      </div>
    </TherapeuticGameShell>
  );
};

export default EmotionMatch;
