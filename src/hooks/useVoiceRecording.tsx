import { useState, useRef, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAzureSpeech, type VoiceMetrics } from '@/hooks/useAzureSpeech';

// ─── Voice analysis sent to backend (raw, unbiased metrics) ───
// These are objective measurements — the LLM interprets them in context.
export interface VoiceAnalysis {
  // Source metadata
  source: 'azure_speech_sdk' | 'groq_whisper_fallback';
  language: string;

  // Raw audio metrics (only present when Azure SDK is used)
  speech_rate_wpm: number | null;
  speech_rate_category: string | null;       // 'very_slow' | 'slow' | 'normal' | 'fast' | 'very_fast'
  avg_pause_duration_ms: number | null;
  max_pause_duration_ms: number | null;
  long_pause_count: number | null;           // pauses > 1.5s
  pause_count: number | null;               // pauses > 300ms
  pause_pattern: string | null;             // 'minimal' | 'normal' | 'frequent' | 'excessive'
  speech_to_silence_ratio: number | null;   // 0-1
  total_duration_sec: number | null;
  total_speech_duration_sec: number | null;
  avg_confidence: number | null;            // 0-1 (recognition quality)
  min_confidence: number | null;
  confidence_variance: number | null;
  speech_clarity: string | null;            // 'unclear' | 'moderate' | 'clear' | 'very_clear'
  word_count: number;

  // Transcript context (language cues — objective detection, not interpretation)
  hindi_english_mixing: boolean;
  detected_hindi_words: string[];
}

interface VoiceResult {
  transcript: string;
  voiceAnalysis: VoiceAnalysis | null;
  audioData: string | null;  // Base64-encoded WAV for backend prosodic analysis
  success: boolean;
}

// ─── Build VoiceAnalysis from Azure VoiceMetrics (raw, unbiased) ───
// ─── WAV encoder: converts PCM Float32Array to WAV bytes ───
function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);       // PCM
  view.setUint16(20, 1, true);        // PCM format
  view.setUint16(22, 1, true);        // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);        // block align
  view.setUint16(34, 16, true);       // bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return buffer;
}

/** Convert a recorded audio Blob to base64-encoded WAV (16kHz mono) */
async function blobToWavBase64(blob: Blob): Promise<string | null> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    // Decode audio to PCM at 16kHz (optimal for prosodic analysis)
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const pcm = audioBuffer.getChannelData(0); // mono
    const wavBuffer = encodeWav(pcm, 16000);
    await audioContext.close();
    // Convert to base64
    const bytes = new Uint8Array(wavBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (err) {
    console.warn('⚠️ [VOICE] WAV encoding failed:', err);
    return null;
  }
}

function buildVoiceAnalysis(
  metrics: VoiceMetrics | null,
  transcript: string,
  source: 'azure_speech_sdk' | 'groq_whisper_fallback'
): VoiceAnalysis {
  const text = transcript.toLowerCase();
  const hindiWords = ['yaar', 'bhai', 'didi', 'beta', 'bas', 'kya', 'hai', 'achha', 'theek', 'nahi', 'haan', 'matlab'];
  const detectedHindi = hindiWords.filter(w => text.includes(w));

  if (!metrics) {
    // Fallback transcript — no Azure word-level metrics available
    return {
      source,
      language: 'en-IN',
      speech_rate_wpm: null,
      speech_rate_category: null,
      avg_pause_duration_ms: null,
      max_pause_duration_ms: null,
      long_pause_count: null,
      pause_count: null,
      pause_pattern: null,
      speech_to_silence_ratio: null,
      total_duration_sec: null,
      total_speech_duration_sec: null,
      avg_confidence: null,
      min_confidence: null,
      confidence_variance: null,
      speech_clarity: null,
      word_count: transcript.split(/\s+/).filter(Boolean).length,
      hindi_english_mixing: detectedHindi.length > 0,
      detected_hindi_words: detectedHindi,
    };
  }

  return {
    source,
    language: 'en-IN',
    speech_rate_wpm: metrics.speechRate,
    speech_rate_category: metrics.speechRateCategory,
    avg_pause_duration_ms: metrics.avgPauseDuration,
    max_pause_duration_ms: metrics.maxPauseDuration,
    long_pause_count: metrics.longPauseCount,
    pause_count: metrics.pauseCount,
    pause_pattern: metrics.pausePattern,
    speech_to_silence_ratio: metrics.speechToSilenceRatio,
    total_duration_sec: metrics.totalDuration,
    total_speech_duration_sec: metrics.totalSpeechDuration,
    avg_confidence: metrics.avgConfidence,
    min_confidence: metrics.minConfidence,
    confidence_variance: metrics.confidenceVariance,
    speech_clarity: metrics.speechClarity,
    word_count: metrics.wordCount,
    hindi_english_mixing: detectedHindi.length > 0,
    detected_hindi_words: detectedHindi,
  };
}

export const useVoiceRecording = (sttLocale: string = 'en-IN') => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastVoiceAnalysis, setLastVoiceAnalysis] = useState<VoiceAnalysis | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const azure = useAzureSpeech(sttLocale);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const usingAzureRef = useRef(false);

  // MediaRecorder for audio capture (prosodic analysis)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);

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

  // Start MediaRecorder for audio capture (runs alongside STT).
  // When `stream` is provided (shared with Azure's PushStream), the same
  // noise-suppressed source is recorded — ensuring prosody audio matches
  // what Azure transcribed.  If no stream is given, a fresh getUserMedia
  // call is made with noise-suppression constraints as a safety net.
  const startMediaRecorder = useCallback(async (stream?: MediaStream) => {
    try {
      let micStream = stream;
      if (!micStream) {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            noiseSuppression: true,
            echoCancellation: true,
            autoGainControl: true,
          },
        });
        // Only store stream ownership if WE created it (must stop it ourselves)
        micStreamRef.current = micStream;
      }
      // When stream provided externally, caller owns lifecycle — just hold ref for cancel path
      if (stream && !micStreamRef.current) {
        micStreamRef.current = stream;
      }
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(micStream, { mimeType: 'audio/webm;codecs=opus' });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      console.log('🎤 [VOICE] MediaRecorder started (for prosodic analysis)');
    } catch (err) {
      console.warn('⚠️ [VOICE] MediaRecorder failed to start:', err);
      // Non-fatal — prosodic analysis will just be unavailable
    }
  }, []);

  // Stop MediaRecorder and return base64 WAV
  const stopMediaRecorder = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        // Clean up mic stream
        micStreamRef.current?.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
        resolve(null);
        return;
      }

      recorder.onstop = async () => {
        // Clean up mic stream
        micStreamRef.current?.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
        mediaRecorderRef.current = null;

        if (audioChunksRef.current.length === 0) {
          resolve(null);
          return;
        }

        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];
        console.log(`🎤 [VOICE] Audio captured: ${(blob.size / 1024).toFixed(0)}KB`);

        const wavBase64 = await blobToWavBase64(blob);
        if (wavBase64) {
          console.log(`🎤 [VOICE] WAV encoded: ${(wavBase64.length / 1024).toFixed(0)}KB base64`);
        }
        resolve(wavBase64);
      };

      recorder.stop();
    });
  }, []);

  // ═══════════════════════════════════════════════════════════
  // Groq Whisper fallback — called when Azure returns empty
  // transcript despite audio being captured.  Sends the WAV
  // base64 to the backend /transcribe endpoint which uses
  // whisper-large-v3-turbo for noise-robust transcription.
  // ═══════════════════════════════════════════════════════════
  const transcribeWithWhisper = useCallback(async (audioData: string): Promise<string> => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    if (!backendUrl) {
      console.warn('⚠️ [WHISPER] VITE_BACKEND_URL not configured — Whisper fallback unavailable');
      return '';
    }
    try {
      console.log('🔄 [WHISPER] Azure returned empty — trying Groq Whisper fallback...');
      const res = await fetch(`${backendUrl}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_data: audioData }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => 'unknown');
        console.error(`❌ [WHISPER] HTTP ${res.status}: ${errText}`);
        return '';
      }
      const data = await res.json();
      const t = (data.transcript ?? '').trim();
      if (t) {
        console.log(`✅ [WHISPER] Fallback succeeded | model=${data.model} | "${t.slice(0, 60)}..."`);
      } else {
        console.warn('⚠️ [WHISPER] Fallback also returned empty transcript');
      }
      return t;
    } catch (err) {
      console.error('❌ [WHISPER] Fallback request failed:', err);
      return '';
    }
  }, []);

  // ═══════════════════════════════════════════════════════════
  // Start recording — Azure SDK primary, Whisper fallback
  // ═══════════════════════════════════════════════════════════
  const startRecording = useCallback(async () => {
    console.log('🎤 [VOICE] Starting voice recording...');
    console.log('🎤 [VOICE] Azure available:', azure.isSupported);
    
    try {
      setCurrentTranscript('');
      setRecordingDuration(0);

      // Start duration counter
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      // ── Try Azure Speech SDK first ──
      if (azure.isSupported) {
        console.log('🎤 [VOICE] Using Azure Speech SDK (primary) with PushStream noise-suppressed mode');
        usingAzureRef.current = true;

        // Acquire ONE noise-suppressed stream shared between Azure's PushStream
        // and MediaRecorder.  This eliminates the double-mic-grab that causes
        // OS-level audio routing conflicts, and ensures Praat receives the same
        // denoised audio that Azure transcribed.
        let sharedStream: MediaStream | undefined;
        try {
          sharedStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              noiseSuppression: true,
              echoCancellation: true,
              autoGainControl: true,
            },
          });
          micStreamRef.current = sharedStream;
          console.log('🎤 [VOICE] Noise-suppressed stream acquired (noiseSuppression + echoCancellation)');
        } catch (streamErr) {
          console.warn('⚠️ [VOICE] getUserMedia with constraints failed, Azure will use default mic:', streamErr);
        }

        // Start MediaRecorder on the shared stream
        await startMediaRecorder(sharedStream);
        // Start Azure recognition — passes stream for PushStream mode if available
        await azure.startRecognition(sharedStream);
        setIsRecording(true);

        // Auto-stop after 60 seconds
        timeoutRef.current = setTimeout(() => {
          console.log('⏰ [VOICE] Auto-stopping after 60 seconds');
          stopRecording();
        }, 60000);

        toast({
          title: "🎤 Recording Started",
          description: "Speak naturally. Click the mic button when you're done.",
          duration: 4000,
        });
        return;
      }

      // ── No Azure key configured ──
      console.warn('⚠️ [VOICE] Azure Speech key not configured — voice recording unavailable');
      usingAzureRef.current = false;
      clearTimers();
      toast({
        title: "❌ Voice Recording Unavailable",
        description: "Azure Speech key is not configured. Please set VITE_AZURE_TTS_KEY.",
        variant: "destructive",
        duration: 6000,
      });

    } catch (error: any) {
      console.error('❌ [VOICE] Failed to start:', error);
      clearTimers();
      setIsRecording(false);
      toast({
        title: "❌ Recording Failed",
        description: error.message,
        variant: "destructive",
        duration: 5000,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [azure.isSupported, toast, clearTimers]);

  // ═══════════════════════════════════════════════════════════
  // Stop recording and produce VoiceAnalysis
  // Order: stop Azure first → stop MediaRecorder → Whisper fallback if needed
  // ═══════════════════════════════════════════════════════════
  const stopRecording = useCallback(async (
    sessionId?: string,
    messageId?: string,
  ): Promise<VoiceResult | null> => {
    console.log('🛑 [VOICE] Stopping recording... (azure:', usingAzureRef.current, ')');

    clearTimers();
    setIsProcessing(true);

    try {
      let finalTranscript = '';
      let metrics: VoiceMetrics | null = null;
      let audioData: string | null = null;
      let source: 'azure_speech_sdk' | 'groq_whisper_fallback' = 'azure_speech_sdk';

      // ── Stop Azure FIRST (must happen before stopping mic tracks) ──
      // In PushStream mode the ScriptProcessorNode feeds Azure via the shared
      // MediaStream.  Stopping the MicStream first would cut the feed mid-utterance.
      // We call stopRecognition() before stopMediaRecorder() so the PushStream
      // receives a clean close() and Azure fires sessionStopped with full metrics.
      if (usingAzureRef.current) {
        console.log('🛑 [VOICE] Stopping Azure recognition...');
        finalTranscript = await azure.stopRecognition();

        // Brief pause for sessionStopped to settle metrics
        await new Promise(r => setTimeout(r, 300));
        metrics = azure.voiceMetrics;

        console.log(
          `📊 [VOICE] Azure result | transcript="${finalTranscript.slice(0, 60)}" ` +
          `words=${metrics?.wordCount ?? 0} ` +
          `noMatchCount=${azure.noMatchCount}`,
        );
      }

      // ── Stop MediaRecorder and harvest audio ──
      audioData = await stopMediaRecorder();
      console.log('🎤 [VOICE] Audio data captured:', audioData ? `${Math.round(audioData.length / 1024)}KB base64` : 'none');

      // ── Whisper fallback if Azure returned empty transcript ──
      if (usingAzureRef.current && !finalTranscript.trim() && audioData) {
        console.log('⚠️ [VOICE] Azure transcript empty — invoking Groq Whisper fallback');
        finalTranscript = await transcribeWithWhisper(audioData);
        if (finalTranscript.trim()) {
          source = 'groq_whisper_fallback';
          metrics = null;
        }
      }

      setIsRecording(false);

      if (finalTranscript.trim()) {
        // Build unbiased voice analysis from raw metrics
        const voiceAnalysis = buildVoiceAnalysis(metrics, finalTranscript, source);
        setLastVoiceAnalysis(voiceAnalysis);
        console.log('📊 [VOICE] Voice analysis (raw, unbiased):', voiceAnalysis);

        // Save analytics to voice_analysis_events table
        if (sessionId) {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              // Validate message_id: only pass if it's a real UUID, not a temp ID like "voice-123"
              const validMessageId = messageId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId)
                ? messageId
                : null;

              const { error } = await supabase.from('voice_analysis_events' as any).insert({
                user_id: user.id,
                session_id: sessionId,
                message_id: validMessageId,
                transcript: finalTranscript,
                source: voiceAnalysis.source,
                language: voiceAnalysis.language,
                speech_rate_wpm: voiceAnalysis.speech_rate_wpm,
                speech_rate_category: voiceAnalysis.speech_rate_category,
                avg_pause_duration_ms: voiceAnalysis.avg_pause_duration_ms,
                max_pause_duration_ms: voiceAnalysis.max_pause_duration_ms,
                long_pause_count: voiceAnalysis.long_pause_count,
                pause_count: voiceAnalysis.pause_count,
                pause_pattern: voiceAnalysis.pause_pattern,
                speech_to_silence_ratio: voiceAnalysis.speech_to_silence_ratio,
                total_duration_sec: voiceAnalysis.total_duration_sec,
                total_speech_duration_sec: voiceAnalysis.total_speech_duration_sec,
                avg_confidence: voiceAnalysis.avg_confidence,
                min_confidence: voiceAnalysis.min_confidence,
                confidence_variance: voiceAnalysis.confidence_variance,
                speech_clarity: voiceAnalysis.speech_clarity,
                word_count: voiceAnalysis.word_count,
                hindi_english_mixing: voiceAnalysis.hindi_english_mixing,
                detected_hindi_words: voiceAnalysis.detected_hindi_words,
                prosody: null,
                processing_duration_ms: metrics ? Math.round(metrics.totalDuration * 1000) : null,
              } as any);

              if (error) {
                console.warn('⚠️ [VOICE] DB save failed:', error.message);
              } else {
                console.log('✅ [VOICE] Analytics saved to voice_analysis_events table');
              }
            }
          } catch (dbErr) {
            console.warn('⚠️ [VOICE] Analytics DB write failed:', dbErr);
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

        return { transcript: finalTranscript, voiceAnalysis, audioData, success: true };
      } else {
        setIsProcessing(false);
        setCurrentTranscript('');
        setRecordingDuration(0);
        
        toast({
          title: "⚠️ No Speech Detected",
          description: "Please try speaking more clearly. Make sure your microphone is working.",
          variant: "destructive",
          duration: 4000,
        });
        
        return { transcript: '', voiceAnalysis: null, audioData: null, success: false };
      }
    } catch (err: any) {
      console.error('❌ [VOICE] Stop error:', err);
      setIsProcessing(false);
      setIsRecording(false);
      setCurrentTranscript('');
      setRecordingDuration(0);
      return { transcript: '', voiceAnalysis: null, audioData: null, success: false };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [azure, toast, clearTimers, stopMediaRecorder, transcribeWithWhisper]);

  // Sync Azure live transcript to currentTranscript
  // (Web Speech updates are done in onresult callback)
  const azureFullTranscript = azure.transcript + (azure.interimTranscript ? ' ' + azure.interimTranscript : '');
  const effectiveTranscript = usingAzureRef.current ? azureFullTranscript : currentTranscript;

  // Toggle recording
  const toggleRecording = useCallback(async (sessionId?: string, messageId?: string) => {
    console.log('🎤 [HOOK] toggleRecording, isRecording:', isRecording);
    
    if (isRecording) {
      return await stopRecording(sessionId, messageId);
    } else {
      await startRecording();
      return null;
    }
  }, [isRecording, startRecording, stopRecording]);

  // Cancel recording
  const cancelRecording = useCallback(() => {
    console.log('❌ [VOICE] Cancelling...');

    if (usingAzureRef.current) {
      azure.stopRecognition();
    }

    // Stop MediaRecorder and release mic
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    audioChunksRef.current = [];

    clearTimers();
    setIsRecording(false);
    setIsProcessing(false);
    setCurrentTranscript('');
    setRecordingDuration(0);

    toast({
      title: "❌ Recording Cancelled",
      description: "Voice recording was cancelled.",
      duration: 3000,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearTimers, toast]);

  return {
    isRecording,
    isProcessing,
    lastVoiceAnalysis,
    currentTranscript: effectiveTranscript,
    recordingDuration,
    startRecording,
    stopRecording,
    toggleRecording,
    cancelRecording,
  };
};