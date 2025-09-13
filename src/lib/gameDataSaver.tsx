import { supabase } from '@/integrations/supabase/client';

interface GameResult {
  activityType: string;
  activityData: any;
  score?: number;
  gameDuration?: number;
  difficultyLevel?: string;
  userResponseData?: any;
  evaluationData?: any;
  accuracyPercentage?: number;
}

// Activity templates for context
const ACTIVITY_TEMPLATES = {
  emotion_match: {
    description: "Classify emotions in facial expression images to improve emotional intelligence",
    images: [
      { id: "happy_1", emotion: "happiness", intensity: "moderate", context: "natural_smile" },
      { id: "sad_1", emotion: "sadness", intensity: "mild", context: "contemplative" },
      { id: "angry_1", emotion: "anger", intensity: "moderate", context: "frustrated" },
      { id: "fear_1", emotion: "fear", intensity: "high", context: "startled" },
      { id: "neutral_1", emotion: "neutral", intensity: "calm", context: "relaxed" }
    ],
    therapeutic_focus: ["emotional_intelligence", "self_awareness"]
  },
  memory_challenge: {
    description: "Simon-says style memory game to improve cognitive function and focus",
    configuration: {
      sequence_length: { start: 3, max: 12 },
      time_per_item: 1.5,
      difficulty_progression: "linear"
    },
    therapeutic_focus: ["cognitive_enhancement", "focus", "attention"]
  },
  mood_mountain: {
    description: "Navigate through emotional landscapes to understand mood patterns",
    levels: 10,
    therapeutic_focus: ["mood_tracking", "emotional_regulation", "mindfulness"]
  },
  thought_detective: {
    description: "Identify and analyze thought patterns using CBT principles",
    scenarios: 8,
    cognitive_distortions: ["catastrophizing", "black_white_thinking", "mind_reading"],
    therapeutic_focus: ["CBT", "thought_analysis", "cognitive_restructuring"]
  },
  emoji_match: {
    description: "Match emojis to improve emotional recognition and processing speed",
    therapeutic_focus: ["emotional_processing", "reaction_time", "pattern_recognition"]
  }
};

export async function saveGameResult(gameResult: GameResult, sessionId?: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('No authenticated user, skipping game data save');
      return;
    }

    // Get activity template for context
    const template = ACTIVITY_TEMPLATES[gameResult.activityType as keyof typeof ACTIVITY_TEMPLATES];

    // Handle session ID - ensure it's a valid UUID or null
    let validSessionId: string | null = null;
    
    if (sessionId) {
      // Check if it's a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(sessionId)) {
        validSessionId = sessionId;
      } else {
        console.warn('Invalid session ID format, setting to null:', sessionId);
      }
    }
    
    // If no valid session ID, try to get from localStorage
    if (!validSessionId) {
      const storedSessionId = localStorage.getItem('currentChatSession');
      if (storedSessionId) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(storedSessionId)) {
          validSessionId = storedSessionId;
        } else {
          console.warn('Invalid stored session ID format, creating new one:', storedSessionId);
          // Generate a new UUID and store it
          validSessionId = crypto.randomUUID();
          localStorage.setItem('currentChatSession', validSessionId);
          console.log('Generated new session UUID:', validSessionId);
        }
      }
    }

    console.log('💾 Saving game result for user:', user.id);
    console.log('🔗 Using session ID:', validSessionId);
    console.log('🎮 Activity type:', gameResult.activityType);

    // Use type assertion to work around missing table types
    const { error } = await (supabase as any)
      .from('user_activities')
      .insert({
        user_id: user.id,
        session_id: validSessionId, // Now properly handles UUID or null
        activity_type: gameResult.activityType,
        activity_data: {
          ...gameResult.activityData,
          template_context: template,
          completion_timestamp: new Date().toISOString()
        },
        score: gameResult.score,
        game_duration: gameResult.gameDuration,
        difficulty_level: gameResult.difficultyLevel || 'normal',
        // New enhanced fields
        activity_metadata: template || {},
        user_response_data: gameResult.userResponseData || {},
        evaluation_data: gameResult.evaluationData || {},
        accuracy_percentage: gameResult.accuracyPercentage,
        insights_generated: generateInsights(gameResult, template)
      });

    if (error) {
      console.error('Error saving game result:', error);
    } else {
      console.log('✅ Game result saved successfully:', gameResult.activityType);
    }
  } catch (error) {
    console.error('Failed to save game result:', error);
  }
}

function generateInsights(gameResult: GameResult, template: any): any {
  const insights: any = {
    performance_level: "average",
    key_patterns: [],
    improvement_areas: [],
    strengths: []
  };

  // Performance assessment
  if (gameResult.accuracyPercentage !== undefined) {
    if (gameResult.accuracyPercentage >= 90) {
      insights.performance_level = "excellent";
      insights.strengths.push("high_accuracy");
    } else if (gameResult.accuracyPercentage >= 70) {
      insights.performance_level = "good";
    } else if (gameResult.accuracyPercentage >= 50) {
      insights.performance_level = "developing";
      insights.improvement_areas.push("accuracy_focus_needed");
    } else {
      insights.performance_level = "needs_practice";
      insights.improvement_areas.push("fundamental_skills");
    }
  }

  // Activity-specific insights
  switch (gameResult.activityType) {
    case 'emotion_match':
      if (gameResult.userResponseData?.classifications) {
        const incorrectEmotions = gameResult.userResponseData.classifications
          .filter((c: any) => !c.correct)
          .map((c: any) => c.user_choice);
        
        if (incorrectEmotions.includes('sadness') || incorrectEmotions.includes('fear')) {
          insights.key_patterns.push("difficulty_with_negative_emotions");
        }
        if (incorrectEmotions.includes('neutral')) {
          insights.key_patterns.push("neutral_emotion_confusion");
        }
      }
      break;
      
    case 'memory_challenge':
      if (gameResult.gameDuration && gameResult.score) {
        const efficiency = gameResult.score / (gameResult.gameDuration / 60);
        if (efficiency > 100) {
          insights.strengths.push("quick_processing");
        } else if (efficiency < 50) {
          insights.improvement_areas.push("processing_speed");
        }
      }
      break;
      
    case 'thought_detective':
      if (gameResult.userResponseData?.identified_distortions) {
        insights.key_patterns.push("cognitive_awareness_developing");
      }
      break;
  }

  return insights;
}

export function useGameDataSaver() {
  const getCurrentSessionId = () => {
    return localStorage.getItem('currentChatSession') || undefined;
  };

  return {
    saveMemoryChallenge: async (
      score: number, 
      mistakes: number, 
      duration: number, 
      sequenceLength: number,
      sessionId?: string
    ) => {
      const accuracy = ((sequenceLength - mistakes) / sequenceLength * 100);
      
      return saveGameResult({
        activityType: 'memory_challenge',
        activityData: { 
          final_score: score,
          total_mistakes: mistakes,
          final_sequence_length: sequenceLength,
          average_reaction_time: duration / sequenceLength
        },
        score,
        gameDuration: duration,
        userResponseData: {
          sequence_progression: sequenceLength,
          error_rate: mistakes / sequenceLength,
          key_patterns: mistakes > 3 ? ["high_error_rate"] : ["good_retention"]
        },
        evaluationData: {
          cognitive_load: sequenceLength > 8 ? "high" : "moderate",
          performance_trend: mistakes < 2 ? "excellent" : "developing"
        },
        accuracyPercentage: accuracy
      }, sessionId || getCurrentSessionId());
    },
    
    saveEmojiMatch: async (
      score: number, 
      correctMatches: number, 
      totalAttempts: number, 
      duration: number,
      sessionId?: string
    ) => {
      const accuracy = (correctMatches / totalAttempts * 100);
      
      return saveGameResult({
        activityType: 'emoji_match',
        activityData: {
          matches_found: correctMatches,
          total_attempts: totalAttempts,
          speed_bonus: duration < 60 ? 'fast' : 'normal',
          average_time_per_match: duration / totalAttempts
        },
        score,
        gameDuration: duration,
        userResponseData: {
          match_patterns: correctMatches > totalAttempts * 0.8 ? ["strong_recognition"] : ["needs_practice"],
          reaction_times: duration / totalAttempts
        },
        evaluationData: {
          emotional_processing_speed: duration < 120 ? "fast" : "moderate",
          pattern_recognition: accuracy > 80 ? "strong" : "developing"
        },
        accuracyPercentage: accuracy
      }, sessionId || getCurrentSessionId());
    },

    saveEmotionMatch: async (
      score: number, 
      correctClassifications: number, 
      totalImages: number, 
      duration: number, 
      classifications: any[],
      sessionId?: string
    ) => {
      const accuracy = (correctClassifications / totalImages * 100);
      
      return saveGameResult({
        activityType: 'emotion_match',
        activityData: {
          score,
          correct_classifications: correctClassifications,
          total_images: totalImages,
          classification_details: classifications
        },
        score,
        gameDuration: duration,
        userResponseData: {
          classifications: classifications,
          time_per_image: duration / totalImages,
          confusion_patterns: classifications
            .filter(c => !c.correct)
            .map(c => ({ expected: c.correct_emotion, chosen: c.user_choice }))
        },
        evaluationData: {
          emotional_intelligence_level: accuracy > 80 ? "high" : accuracy > 60 ? "moderate" : "developing",
          processing_efficiency: duration / totalImages < 10 ? "efficient" : "deliberate"
        },
        accuracyPercentage: accuracy
      }, sessionId || getCurrentSessionId());
    },

    saveMoodMountain: async (
      level: number, 
      emotionsIdentified: string[], 
      duration: number, 
      exercisesCompleted: string[],
      sessionId?: string
    ) => {
      const completion = (level / 10 * 100);
      
      return saveGameResult({
        activityType: 'mood_mountain',
        activityData: {
          level_reached: level,
          emotions_identified: emotionsIdentified,
          exercises_completed: exercisesCompleted,
          emotional_range: emotionsIdentified.length
        },
        score: level * 100,
        gameDuration: duration,
        userResponseData: {
          emotional_vocabulary: emotionsIdentified,
          engagement_level: exercisesCompleted.length,
          journey_insights: level > 5 ? ["good_emotional_awareness"] : ["building_awareness"]
        },
        evaluationData: {
          emotional_regulation_progress: level > 7 ? "strong" : "developing",
          mindfulness_engagement: exercisesCompleted.length > 2 ? "active" : "moderate"
        },
        accuracyPercentage: completion
      }, sessionId || getCurrentSessionId());
    },

    saveThoughtDetective: async (
      casesCompleted: number, 
      accuracy: number, 
      duration: number, 
      identifiedDistortions: string[],
      sessionId?: string
    ) => {
      return saveGameResult({
        activityType: 'thought_detective',
        activityData: {
          cases_completed: casesCompleted,
          accuracy_percentage: accuracy,
          distortions_identified: identifiedDistortions,
          cognitive_awareness_score: identifiedDistortions.length
        },
        score: casesCompleted * 100,
        gameDuration: duration,
        userResponseData: {
          identified_distortions: identifiedDistortions,
          case_solving_approach: duration / casesCompleted < 30 ? "intuitive" : "analytical",
          key_patterns: accuracy > 75 ? ["strong_cognitive_awareness"] : ["developing_insight"]
        },
        evaluationData: {
          cbt_readiness: accuracy > 70 ? "ready" : "building_foundation",
          thought_pattern_recognition: identifiedDistortions.length > 3 ? "advanced" : "beginner"
        },
        accuracyPercentage: accuracy
      }, sessionId || getCurrentSessionId());
    },

    saveQATest: async (
      testType: string,
      answers: any[],
      score: number,
      totalQuestions: number,
      duration: number,
      sessionId?: string
    ) => {
      const accuracy = (score / totalQuestions * 100);
      
      return saveGameResult({
        activityType: `qa_test_${testType}`,
        activityData: {
          test_type: testType,
          responses: answers,
          total_questions: totalQuestions,
          assessment_insights: generateQAInsights(testType, score, totalQuestions)
        },
        score,
        gameDuration: duration,
        userResponseData: {
          response_patterns: answers,
          completion_rate: 100,
          engagement_level: duration < 300 ? "focused" : "thorough"
        },
        evaluationData: {
          assessment_level: getAssessmentLevel(testType, score, totalQuestions),
          therapeutic_indicators: getTherapeuticIndicators(testType, answers)
        },
        accuracyPercentage: accuracy
      }, sessionId || getCurrentSessionId());
    },

    saveWellnessCheckIn: async (
      responses: any,
      overallScore: number,
      categories: string[],
      sessionId?: string
    ) => {
      return saveGameResult({
        activityType: 'wellness_checkin',
        activityData: {
          wellness_responses: responses,
          categories_assessed: categories,
          overall_wellness_score: overallScore,
          timestamp: new Date().toISOString()
        },
        score: overallScore,
        userResponseData: {
          detailed_responses: responses,
          wellness_areas: categories,
          self_assessment_patterns: analyzeWellnessPatterns(responses)
        },
        evaluationData: {
          wellness_level: overallScore > 70 ? "good" : overallScore > 40 ? "moderate" : "needs_attention",
          focus_areas: identifyFocusAreas(responses, categories)
        },
        accuracyPercentage: (overallScore / 100) * 100
      }, sessionId || getCurrentSessionId());
    }
  };
}

// Helper functions for QA and Wellness analysis
function generateQAInsights(testType: string, score: number, total: number): any {
  const percentage = (score / total) * 100;
  
  const insights: any = {
    severity_level: "normal",
    recommendations: [],
    focus_areas: []
  };

  switch (testType.toLowerCase()) {
    case 'anxiety':
      if (percentage > 70) {
        insights.severity_level = "high";
        insights.recommendations = ["breathing_exercises", "grounding_techniques"];
        insights.focus_areas = ["anxiety_management", "stress_reduction"];
      } else if (percentage > 40) {
        insights.severity_level = "moderate";
        insights.recommendations = ["mindfulness_practice", "coping_strategies"];
      }
      break;
      
    case 'depression':
      if (percentage > 60) {
        insights.severity_level = "concerning";
        insights.recommendations = ["mood_tracking", "activity_scheduling"];
        insights.focus_areas = ["mood_improvement", "behavioral_activation"];
      }
      break;
  }

  return insights;
}

function getAssessmentLevel(testType: string, score: number, total: number): string {
  const percentage = (score / total) * 100;
  
  if (percentage < 30) return "low";
  if (percentage < 60) return "moderate";
  return "high";
}

function getTherapeuticIndicators(testType: string, answers: any[]): string[] {
  const indicators: string[] = [];
  
  // Simple analysis based on answer patterns
  const highScoreAnswers = answers.filter(a => (a.value || a.score || 0) > 3);
  
  if (highScoreAnswers.length > answers.length * 0.6) {
    indicators.push("therapeutic_intervention_beneficial");
  }
  
  if (testType.includes('anxiety')) {
    indicators.push("anxiety_focused_approach");
  }
  
  return indicators;
}

function analyzeWellnessPatterns(responses: any): string[] {
  const patterns: string[] = [];
  
  // Simple pattern recognition
  const values = Object.values(responses).filter(v => typeof v === 'number') as number[];
  const average = values.reduce((a, b) => a + b, 0) / values.length;
  
  if (average > 7) patterns.push("positive_wellness_trend");
  if (average < 4) patterns.push("wellness_attention_needed");
  
  return patterns;
}

function identifyFocusAreas(responses: any, categories: string[]): string[] {
  const focusAreas: string[] = [];
  
  // Identify low-scoring categories
  categories.forEach(category => {
    if (responses[category] && responses[category] < 5) {
      focusAreas.push(category);
    }
  });
  
  return focusAreas;
}