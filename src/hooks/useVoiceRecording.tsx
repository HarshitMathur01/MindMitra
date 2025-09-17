import { useState, useRef, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Extend Window interface for Speech Recognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface VoiceInsights {
  emotional_tone: 'calm' | 'anxious' | 'sad' | 'excited' | 'frustrated' | 'neutral'
  stress_level: 'low' | 'medium' | 'high'
  confidence_score: number
  psychological_markers: {
    academic_pressure: boolean
    family_pressure: boolean
    social_anxiety: boolean
    help_seeking: boolean
  }
  cultural_context: {
    hindi_english_mixing: boolean
    formality_level: 'formal' | 'casual' | 'intimate'
    cultural_references: string[]
  }
}

interface VoiceResult {
  transcript: string
  insights: VoiceInsights | null
  success: boolean
}

export const useVoiceRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastVoiceInsights, setLastVoiceInsights] = useState<VoiceInsights | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef('');
  const { toast } = useToast();

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  // Simple and fast local voice analysis
  const analyzeVoiceTranscript = useCallback((transcript: string): VoiceInsights => {
    console.log('🧠 [VOICE] Analyzing transcript:', transcript);
    
    const text = transcript.toLowerCase();
    const words = text.split(' ');
    
    // Emotional tone analysis with Indian context
    let emotional_tone: VoiceInsights['emotional_tone'] = 'neutral';
    
    // Stress/anxiety indicators
    if (text.match(/\b(stress|stressed|anxious|worried|panic|tension|pressure|overwhelm)/)) {
      emotional_tone = 'anxious';
    }
    // Sadness indicators  
    else if (text.match(/\b(sad|depressed|down|lonely|upset|hurt|disappointed)/)) {
      emotional_tone = 'sad';
    }
    // Frustration indicators
    else if (text.match(/\b(frustrated|angry|annoyed|irritated|fed up|cant take)/)) {
      emotional_tone = 'frustrated';
    }
    // Positive indicators
    else if (text.match(/\b(happy|excited|good|great|amazing|wonderful|fantastic|awesome)/)) {
      emotional_tone = 'excited';
    }
    // Calm indicators
    else if (text.match(/\b(calm|peaceful|relaxed|fine|okay|alright|better)/)) {
      emotional_tone = 'calm';
    }

    // Stress level analysis
    let stress_level: VoiceInsights['stress_level'] = 'medium';
    
    const highStressWords = /\b(overwhelming|too much|cant handle|breaking down|exhausted|burnout|suicide|cant cope)/;
    const lowStressWords = /\b(fine|okay|good|peaceful|relaxed|manageable|under control)/;
    
    if (highStressWords.test(text)) {
      stress_level = 'high';
    } else if (lowStressWords.test(text)) {
      stress_level = 'low';
    }

    // Psychological markers for Indian youth
    const psychological_markers = {
      academic_pressure: /\b(exam|study|test|grade|marks|school|college|university|assignment|homework|entrance|competitive|jee|neet|board)/i.test(transcript),
      family_pressure: /\b(family|parents|mom|dad|mother|father|relatives|marriage|expectations|pressure|disappoint)/i.test(transcript),
      social_anxiety: /\b(friends|social|people|crowd|party|gathering|shy|awkward|fit in|belong|judgement)/i.test(transcript),
      help_seeking: /\b(help|support|talk|listen|advice|guidance|therapy|counseling|confused|dont know)/i.test(transcript)
    };

    // Cultural context analysis for Indian youth
    const hindiWords = ['yaar', 'bhai', 'didi', 'beta', 'bas', 'kya', 'hai', 'achha', 'theek', 'nahi', 'haan', 'matlab', 'bro', 'dude'];
    const cultural_context = {
      hindi_english_mixing: hindiWords.some(word => text.includes(word)),
      formality_level: text.includes('sir') || text.includes('madam') ? 'formal' as const : 
                      hindiWords.some(word => text.includes(word)) ? 'casual' as const : 'intimate' as const,
      cultural_references: hindiWords.filter(word => text.includes(word))
    };

    // Confidence score based on content analysis
    const confidence_score = Math.min(0.95, Math.max(0.4, 
      (words.length * 0.03) + // Length factor
      (Object.values(psychological_markers).filter(Boolean).length * 0.15) + // Psychological markers
      (cultural_context.hindi_english_mixing ? 0.1 : 0) + // Cultural context
      (emotional_tone !== 'neutral' ? 0.2 : 0) // Clear emotional tone
    ));

    const insights: VoiceInsights = {
      emotional_tone,
      stress_level,
      confidence_score: Number(confidence_score.toFixed(2)),
      psychological_markers,
      cultural_context
    };

    console.log('✅ [VOICE] Analysis completed:', insights);
    return insights;
  }, []);

  // Start recording with better user experience
  const startRecording = useCallback(async () => {
    console.log('🎤 [VOICE] Starting voice recording...');
    console.log('🎤 [VOICE] Current browser:', navigator.userAgent);
    console.log('🎤 [VOICE] Speech Recognition support:', 
      !!(window.SpeechRecognition || window.webkitSpeechRecognition));
    
    try {
      setCurrentTranscript('');
      setRecordingDuration(0);
      finalTranscriptRef.current = '';

      // Check if Speech Recognition is supported
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        console.warn('❌ [VOICE] Speech recognition not supported in this browser');
        toast({
          title: "❌ Speech Not Supported",
          description: "Speech recognition is not supported in this browser. Please use Chrome or Edge.",
          duration: 5000,
        });
        return { transcript: '', insights: null, success: false };
      }

      // Request microphone permission explicitly
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Stop immediately, just checking permission
      } catch (permissionError) {
        console.warn('Microphone permission denied:', permissionError);
        toast({
          title: "❌ Microphone Access Denied",
          description: "Please allow microphone access and try again.",
          duration: 5000,
        });
        return { transcript: '', insights: null, success: false };
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      // Configure recognition for better UX
      recognition.continuous = true; // Keep listening
      recognition.interimResults = true; // Show live transcript
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      // Start duration counter
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      // Auto-stop after 60 seconds (longer for better UX)
      timeoutRef.current = setTimeout(() => {
        console.log('⏰ [VOICE] Auto-stopping recording after 60 seconds');
        stopRecording();
      }, 60000);

      recognition.onstart = () => {
        console.log('🎤 [VOICE] Speech recognition started');
        setIsRecording(true);
        toast({
          title: "🎤 Recording Started",
          description: "Speak naturally. Click the mic button again when you're done or wait for auto-stop.",
          duration: 4000,
        });
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
            finalTranscriptRef.current += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        // Update live transcript for user feedback
        setCurrentTranscript(finalTranscriptRef.current + interimTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error('❌ [VOICE] Speech recognition error:', event.error);
        clearTimers();
        setIsRecording(false);
        setIsProcessing(false);
        
        let errorMessage = 'Voice recognition failed. ';
        switch (event.error) {
          case 'no-speech':
            errorMessage = 'No speech detected. Please try speaking louder and more clearly.';
            break;
          case 'audio-capture':
            errorMessage = 'Microphone not accessible. Please check your microphone settings.';
            break;
          case 'not-allowed':
            errorMessage = 'Microphone permission denied. Please allow microphone access.';
            break;
          case 'network':
            errorMessage = 'Network error occurred. Please check your internet connection.';
            break;
          default:
            errorMessage += 'Please try again.';
        }
        
        toast({
          title: "❌ Recording Error",
          description: errorMessage,
          variant: "destructive",
          duration: 5000,
        });
      };

      recognition.onend = () => {
        console.log('🔚 [VOICE] Speech recognition ended');
        clearTimers();
        setIsRecording(false);
      };

      // Start the recognition
      recognition.start();

    } catch (error: any) {
      console.error('❌ [VOICE] Failed to start recording:', error);
      clearTimers();
      setIsRecording(false);
      toast({
        title: "❌ Recording Failed",
        description: error.message,
        variant: "destructive",
        duration: 5000,
      });
    }
  }, [toast, clearTimers]);

  // Stop recording and process
  const stopRecording = useCallback(async (
    sessionId?: string, 
    messageId?: string, 
    enableVoiceAnalysis: boolean = true
  ): Promise<VoiceResult | null> => {
    console.log('🛑 [VOICE] Stopping voice recording...');
    
    return new Promise((resolve) => {
      if (!recognitionRef.current || !isRecording) {
        console.warn('⚠️ [VOICE] No active recording to stop');
        resolve(null);
        return;
      }

      clearTimers();
      setIsProcessing(true);

      // Stop the recognition
      recognitionRef.current.stop();
      
      // Process after a short delay to ensure all results are captured
      setTimeout(async () => {
        const finalTranscript = finalTranscriptRef.current.trim();
        console.log('📝 [VOICE] Final transcript:', finalTranscript);

        if (finalTranscript) {
          let voiceResult: VoiceResult = { 
            transcript: finalTranscript, 
            insights: null, 
            success: true 
          };

          if (enableVoiceAnalysis) {
            try {
              console.log('🧠 [VOICE] Starting voice analysis...');
              const insights = analyzeVoiceTranscript(finalTranscript);
              voiceResult.insights = insights;
              setLastVoiceInsights(insights);

              // Send to edge function for enhanced analysis (optional)
              if (sessionId) {
                try {
                  console.log('📡 [VOICE] Sending to edge function for enhanced analysis...');
                  const { data, error } = await supabase.functions.invoke('speech-to-text', {
                    body: {
                      transcript: finalTranscript,
                      sessionId,
                      messageId,
                      localAnalysis: insights
                    }
                  });

                  if (error) {
                    console.warn('⚠️ [VOICE] Edge function analysis failed, using local analysis');
                  } else {
                    console.log('✅ [VOICE] Edge function enhanced analysis completed');
                  }
                } catch (edgeError) {
                  console.warn('⚠️ [VOICE] Edge function unavailable, using local analysis');
                }
              }

            } catch (analysisError) {
              console.error('❌ [VOICE] Analysis failed:', analysisError);
            }
          }

          setIsProcessing(false);
          setCurrentTranscript('');
          setRecordingDuration(0);
          
          toast({
            title: "✅ Recording Complete",
            description: `Transcribed: "${finalTranscript.slice(0, 50)}${finalTranscript.length > 50 ? '...' : ''}"`,
            duration: 4000,
          });

          resolve(voiceResult);
        } else {
          console.warn('⚠️ [VOICE] No transcript available');
          setIsProcessing(false);
          setCurrentTranscript('');
          setRecordingDuration(0);
          
          toast({
            title: "⚠️ No Speech Detected",
            description: "Please try speaking more clearly. Make sure your microphone is working.",
            variant: "destructive",
            duration: 4000,
          });
          
          resolve({ transcript: '', insights: null, success: false });
        }
      }, 1000); // 1 second delay to ensure all results are processed
    });
  }, [isRecording, analyzeVoiceTranscript, toast, clearTimers]);

  // Toggle recording for easy use
  const toggleRecording = useCallback(async (sessionId?: string, messageId?: string) => {
    console.log('🎤 [HOOK] toggleRecording called, isRecording:', isRecording, 'sessionId:', sessionId);
    
    if (isRecording) {
      console.log('🛑 [HOOK] Stopping recording...');
      return await stopRecording(sessionId, messageId, true);
    } else {
      console.log('🎤 [HOOK] Starting recording...');
      await startRecording();
      return null;
    }
  }, [isRecording, startRecording, stopRecording]);

  // Cancel recording
  const cancelRecording = useCallback(() => {
    console.log('❌ [VOICE] Cancelling voice recording...');
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    clearTimers();
    setIsRecording(false);
    setIsProcessing(false);
    setCurrentTranscript('');
    setRecordingDuration(0);
    finalTranscriptRef.current = '';
    
    toast({
      title: "❌ Recording Cancelled",
      description: "Voice recording was cancelled.",
      duration: 3000,
    });
  }, [clearTimers, toast]);

  return {
    isRecording,
    isProcessing,
    lastVoiceInsights,
    currentTranscript,
    recordingDuration,
    startRecording,
    stopRecording,
    toggleRecording,
    cancelRecording
  };
};