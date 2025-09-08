import { useState, useRef, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';

// Extend Window interface for Speech Recognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export const useVoiceRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();

  const startRecording = useCallback(async () => {
    try {
      // Check if browser supports Speech Recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        toast({
          title: "Not supported",
          description: "Speech recognition is not supported in this browser. Please use Chrome or Edge.",
          variant: "destructive",
        });
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognitionRef.current = recognition;
      setIsRecording(true);

      recognition.start();

      toast({
        title: "Recording started",
        description: "Speak now...",
      });

    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Recording error",
        description: "Could not start speech recognition. Please check permissions.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!recognitionRef.current || !isRecording) {
        resolve(null);
        return;
      }

      setIsProcessing(true);

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        
        if (transcript.trim()) {
          toast({
            title: "Transcription complete",
            description: `"${transcript.substring(0, 50)}${transcript.length > 50 ? '...' : ''}"`
          });
          resolve(transcript);
        } else {
          toast({
            title: "No speech detected",
            description: "Please try speaking more clearly.",
            variant: "destructive",
          });
          resolve(null);
        }
        
        setIsRecording(false);
        setIsProcessing(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        toast({
          title: "Transcription failed",
          description: "Please try again.",
          variant: "destructive",
        });
        setIsRecording(false);
        setIsProcessing(false);
        resolve(null);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
        setIsProcessing(false);
      };

      recognitionRef.current.stop();
    });
  }, [isRecording, toast]);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      return await stopRecording();
    } else {
      await startRecording();
      return null;
    }
  }, [isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
    toggleRecording,
  };
};