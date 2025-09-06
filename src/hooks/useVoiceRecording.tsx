import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export const useVoiceRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      toast({
        title: "Recording started",
        description: "Speak now...",
      });

    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Recording error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || !isRecording) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = async () => {
        setIsRecording(false);
        setIsProcessing(true);

        try {
          // Create audio blob from chunks
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
          
          // Convert to base64
          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const base64Audio = (reader.result as string).split(',')[1];
              
              // Send to transcription service
              const { data, error } = await supabase.functions.invoke('speech-to-text', {
                body: { audio: base64Audio }
              });

              if (error) throw error;

              const transcribedText = data?.text || '';
              
              if (transcribedText.trim()) {
                toast({
                  title: "Transcription complete",
                  description: `"${transcribedText.substring(0, 50)}${transcribedText.length > 50 ? '...' : ''}"`,
                });
                resolve(transcribedText);
              } else {
                toast({
                  title: "No speech detected",
                  description: "Please try speaking more clearly.",
                  variant: "destructive",
                });
                resolve(null);
              }
            } catch (error) {
              console.error('Error transcribing audio:', error);
              toast({
                title: "Transcription failed",
                description: "Please try again.",
                variant: "destructive",
              });
              resolve(null);
            } finally {
              setIsProcessing(false);
            }
          };

          reader.readAsDataURL(audioBlob);

        } catch (error) {
          console.error('Error processing recording:', error);
          toast({
            title: "Processing failed",
            description: "Please try again.",
            variant: "destructive",
          });
          setIsProcessing(false);
          resolve(null);
        }

        // Clean up media streams
        const stream = mediaRecorderRef.current?.stream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorderRef.current.stop();
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