/**
 * useAzureSpeech — Azure Speech SDK hook for real-time STT with voice metrics.
 *
 * Extracts objective voice biomarkers from audio for mental health insights:
 * - Speech rate (WPM): Fast → anxiety/mania, Slow → depression/fatigue
 * - Pause patterns: Long/frequent pauses → hesitation, cognitive load, depression
 * - Speech-to-silence ratio: Low → withdrawn, High → pressured speech
 * - Recognition confidence: Low → mumbling/unclear speech (distress indicator)
 * - Word count: Brief responses → withdrawal/resistance
 *
 * Uses Azure Speech SDK (runs entirely in browser via WebSocket).
 * Falls back to Web Speech API if Azure key unavailable.
 *
 * Noise-handling strategy:
 *   1. When `startRecognition(sharedStream)` is called with a pre-acquired
 *      MediaStream (noise-suppressed via getUserMedia constraints), the hook
 *      pipes raw PCM through a ScriptProcessorNode → PushAudioInputStream so
 *      Azure receives the browser-denoised audio instead of raw mic.
 *   2. Without a stream it falls back to `fromDefaultMicrophoneInput()`.
 *   3. Silence timeouts are tuned upward so noisy environments don't cause
 *      premature segment termination.
 *   4. Dictation mode is enabled for conversational speech.
 */

import { useState, useRef, useCallback } from 'react';
import { loadAzureSpeechSDK } from '@/lib/azureSpeechLoader';

// ─── Raw voice metrics (unbiased, objective measurements) ───
export interface VoiceMetrics {
  // Temporal metrics
  speechRate: number;              // words per minute
  totalDuration: number;           // total recording duration (seconds)
  totalSpeechDuration: number;     // actual speech time (seconds)
  speechToSilenceRatio: number;    // 0-1, fraction that is speech
  
  // Pause analysis
  avgPauseDuration: number;        // average gap between words (ms)
  maxPauseDuration: number;        // longest single pause (ms)
  longPauseCount: number;          // pauses > 1500ms
  pauseCount: number;              // total pauses > 300ms
  
  // Confidence & clarity
  avgConfidence: number;           // 0-1, Azure recognition confidence
  minConfidence: number;           // lowest word confidence
  confidenceVariance: number;      // variance in confidence scores
  
  // Content metrics
  wordCount: number;               // total recognized words
  
  // Categorized summaries (derived from raw, but still objective)
  speechRateCategory: 'very_slow' | 'slow' | 'normal' | 'fast' | 'very_fast';
  pausePattern: 'minimal' | 'normal' | 'frequent' | 'excessive';
  speechClarity: 'unclear' | 'moderate' | 'clear' | 'very_clear';
}

// Word-level data from Azure SDK
interface WordData {
  word: string;
  startTime: number;  // ms
  endTime: number;    // ms
  confidence: number; // 0-1
}

interface UseAzureSpeechReturn {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  isSupported: boolean;
  voiceMetrics: VoiceMetrics | null;
  error: string | null;
  noMatchCount: number;
  /** Pass a noise-suppressed MediaStream to use PushStream mode (preferred).
   *  If omitted, falls back to fromDefaultMicrophoneInput(). */
  startRecognition: (sharedStream?: MediaStream) => Promise<void>;
  stopRecognition: () => Promise<string>;
}

// ─── Metric computation from raw word data ───
function computeVoiceMetrics(words: WordData[], totalDurationMs: number): VoiceMetrics {
  if (words.length === 0) {
    return {
      speechRate: 0,
      totalDuration: totalDurationMs / 1000,
      totalSpeechDuration: 0,
      speechToSilenceRatio: 0,
      avgPauseDuration: 0,
      maxPauseDuration: 0,
      longPauseCount: 0,
      pauseCount: 0,
      avgConfidence: 0,
      minConfidence: 0,
      confidenceVariance: 0,
      wordCount: 0,
      speechRateCategory: 'very_slow',
      pausePattern: 'minimal',
      speechClarity: 'unclear',
    };
  }

  const totalDurationSec = totalDurationMs / 1000;
  
  // Speech duration = sum of all word durations
  const speechDurationMs = words.reduce((sum, w) => sum + (w.endTime - w.startTime), 0);
  const speechDurationSec = speechDurationMs / 1000;
  
  // Speech rate (WPM) - based on actual speech time, not total time
  const speechRate = speechDurationSec > 0 
    ? Math.round((words.length / speechDurationSec) * 60)
    : 0;

  // Pause analysis - gaps between consecutive words
  const pauses: number[] = [];
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].startTime - words[i - 1].endTime;
    if (gap > 300) { // Only count gaps > 300ms as pauses
      pauses.push(gap);
    }
  }
  
  const avgPauseDuration = pauses.length > 0 
    ? Math.round(pauses.reduce((a, b) => a + b, 0) / pauses.length)
    : 0;
  const maxPauseDuration = pauses.length > 0 ? Math.max(...pauses) : 0;
  const longPauseCount = pauses.filter(p => p > 1500).length;
  
  // Confidence analysis
  const confidences = words.map(w => w.confidence);
  const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
  const minConfidence = Math.min(...confidences);
  const mean = avgConfidence;
  const confidenceVariance = confidences.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / confidences.length;

  // Speech-to-silence ratio
  const speechToSilenceRatio = totalDurationMs > 0 
    ? Math.min(1, speechDurationMs / totalDurationMs) 
    : 0;

  // ─── Categorize (objective buckets, not interpretations) ───
  let speechRateCategory: VoiceMetrics['speechRateCategory'];
  if (speechRate < 80) speechRateCategory = 'very_slow';
  else if (speechRate < 120) speechRateCategory = 'slow';
  else if (speechRate < 170) speechRateCategory = 'normal';
  else if (speechRate < 220) speechRateCategory = 'fast';
  else speechRateCategory = 'very_fast';

  let pausePattern: VoiceMetrics['pausePattern'];
  if (pauses.length === 0) pausePattern = 'minimal';
  else if (longPauseCount === 0 && avgPauseDuration < 800) pausePattern = 'normal';
  else if (longPauseCount <= 2) pausePattern = 'frequent';
  else pausePattern = 'excessive';

  let speechClarity: VoiceMetrics['speechClarity'];
  if (avgConfidence < 0.5) speechClarity = 'unclear';
  else if (avgConfidence < 0.7) speechClarity = 'moderate';
  else if (avgConfidence < 0.85) speechClarity = 'clear';
  else speechClarity = 'very_clear';

  return {
    speechRate,
    totalDuration: Number(totalDurationSec.toFixed(1)),
    totalSpeechDuration: Number(speechDurationSec.toFixed(1)),
    speechToSilenceRatio: Number(speechToSilenceRatio.toFixed(2)),
    avgPauseDuration,
    maxPauseDuration,
    longPauseCount,
    pauseCount: pauses.length,
    avgConfidence: Number(avgConfidence.toFixed(3)),
    minConfidence: Number(minConfidence.toFixed(3)),
    confidenceVariance: Number(confidenceVariance.toFixed(4)),
    wordCount: words.length,
    speechRateCategory,
    pausePattern,
    speechClarity,
  };
}


export const useAzureSpeech = (): UseAzureSpeechReturn => {
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceMetrics, setVoiceMetrics] = useState<VoiceMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noMatchCount, setNoMatchCount] = useState(0);

  const recognizerRef = useRef<any>(null);
  const wordsRef = useRef<WordData[]>([]);
  const startTimeRef = useRef<number>(0);
  const finalTranscriptRef = useRef('');
  const resolveStopRef = useRef<((transcript: string) => void) | null>(null);
  const noMatchCountRef = useRef(0);

  // ── Audio pipeline refs (PushStream mode) ────────────────────────────────
  const pushStreamRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  // Check if Azure Speech is available
  const azureKey = import.meta.env.VITE_AZURE_TTS_KEY;
  const azureRegion = import.meta.env.VITE_AZURE_TTS_REGION || 'eastasia';
  const isSupported = !!azureKey;

  // ── Internal: tear down audio pipeline ───────────────────────────────────
  const _teardownAudioPipeline = useCallback(() => {
    try {
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
    } catch (_) { /* ignore */ }
    try {
      if (pushStreamRef.current) {
        pushStreamRef.current.close();
        pushStreamRef.current = null;
      }
    } catch (_) { /* ignore */ }
    try {
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    } catch (_) { /* ignore */ }
  }, []);

  const startRecognition = useCallback(async (sharedStream?: MediaStream) => {
    if (!azureKey) {
      setError('Azure Speech key not configured (VITE_AZURE_TTS_KEY)');
      return;
    }

    try {
      setError(null);
      setTranscript('');
      setInterimTranscript('');
      setVoiceMetrics(null);
      setNoMatchCount(0);
      wordsRef.current = [];
      finalTranscriptRef.current = '';
      noMatchCountRef.current = 0;
      startTimeRef.current = Date.now();

      const SpeechSDK = await loadAzureSpeechSDK();

      // ── Configure Azure Speech ────────────────────────────────────────────
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(azureKey, azureRegion);
      speechConfig.speechRecognitionLanguage = 'en-IN'; // Indian English
      speechConfig.requestWordLevelTimestamps();
      speechConfig.outputFormat = SpeechSDK.OutputFormat.Detailed;

      // Enable profanity — don't mask words for accurate mental health analysis
      speechConfig.setProfanity(SpeechSDK.ProfanityOption.Raw);

      // ── Noise-robust silence timeouts ─────────────────────────────────────
      // Default initialSilenceTimeout is 5000ms — too short for noisy audio that
      // delays speech onset. Raising to 8000ms prevents early "No Speech" errors.
      speechConfig.setProperty(
        'SpeechServiceConnection_InitialSilenceTimeoutMs', '8000',
      );
      // Default endSilenceTimeout is ~500ms for continuous recognition — raises
      // the risk of cutting off speech mid-sentence in noisy environments.
      speechConfig.setProperty(
        'SpeechServiceConnection_EndSilenceTimeoutMs', '2000',
      );

      // ── Dictation mode: treats natural speech pauses as continuation ──────
      speechConfig.enableDictation();

      // ── Build AudioConfig ─────────────────────────────────────────────────
      let audioConfig: SpeechSDK.AudioConfig;

      if (sharedStream) {
        // ── PushStream mode: browser-denoised audio → Azure ──────────────
        // The stream has noiseSuppression/echoCancellation constraints applied
        // by the caller (useVoiceRecording). We convert Float32 WebAudio PCM
        // to Int16 PCM chunks and push them into Azure's PushAudioInputStream.
        console.log('🎤 [AzureSpeech] Using PushStream mode (noise-suppressed)');

        const format = SpeechSDK.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
        const pushStream = SpeechSDK.AudioInputStream.createPushStream(format);
        pushStreamRef.current = pushStream;

        // AudioContext at 16kHz so the browser auto-resamples the mic stream
        const audioCtx = new AudioContext({ sampleRate: 16000 });
        audioCtxRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(sharedStream);
        // bufferSize=4096, 1 input channel, 1 output channel
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (ev) => {
          if (!pushStreamRef.current) return;
          const float32 = ev.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(float32.length);
          for (let i = 0; i < float32.length; i++) {
            int16[i] = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32767)));
          }
          pushStreamRef.current.write(int16.buffer as ArrayBuffer);
        };

        // Must connect processor → destination or onaudioprocess won't fire
        source.connect(processor);
        processor.connect(audioCtx.destination);

        audioConfig = SpeechSDK.AudioConfig.fromStreamInput(pushStream);
        console.log('🎤 [AzureSpeech] PushStream + ScriptProcessorNode wired at 16kHz');
      } else {
        // ── Fallback: default mic input ───────────────────────────────────
        // Request mic permission with noise constraints first (improves
        // the OS-level audio pipeline even though we discard this stream)
        console.log('🎤 [AzureSpeech] Using fromDefaultMicrophoneInput() (fallback)');
        try {
          const permStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              noiseSuppression: true,
              echoCancellation: true,
              autoGainControl: true,
            },
          });
          permStream.getTracks().forEach(t => t.stop());
        } catch {
          // Permission request failed — proceed anyway, Azure will handle it
        }
        audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      }

      const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
      recognizerRef.current = recognizer;

      // ── Interim results ───────────────────────────────────────────────────
      recognizer.recognizing = (_s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizingSpeech) {
          setInterimTranscript(e.result.text);
        }
      };

      // ── Final results + word-level data ──────────────────────────────────
      recognizer.recognized = (_s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          const text = e.result.text;
          finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + text;
          setTranscript(finalTranscriptRef.current);
          setInterimTranscript('');

          // Extract word-level timestamps + confidence from Azure JSON
          try {
            const json = e.result.properties.getProperty(
              SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult,
            );
            if (json) {
              const parsed = JSON.parse(json);
              const nBest = parsed.NBest?.[0];
              if (nBest?.Words) {
                for (const w of nBest.Words) {
                  wordsRef.current.push({
                    word: w.Word,
                    startTime: w.Offset / 10000,           // 100ns ticks → ms
                    endTime: (w.Offset + w.Duration) / 10000,
                    confidence: nBest.Confidence ?? w.Confidence ?? 0.8,
                  });
                }
              }
              console.log(
                `✅ [AzureSpeech] Recognized ${text.split(' ').length} words | ` +
                `confidence=${nBest?.Confidence?.toFixed(2) ?? 'n/a'}`,
              );
            }
          } catch (parseErr) {
            console.warn('⚠️ [AzureSpeech] Could not parse word-level data:', parseErr);
            console.log(`✅ [AzureSpeech] Recognized: ${text}`);
          }

        } else if (e.result.reason === SpeechSDK.ResultReason.NoMatch) {
          noMatchCountRef.current += 1;
          setNoMatchCount(noMatchCountRef.current);

          // Log NoMatchDetails if available
          try {
            const details = SpeechSDK.NoMatchDetails.fromResult(e.result);
            console.warn(
              `⚠️ [AzureSpeech] NoMatch #${noMatchCountRef.current} | ` +
              `reason=${SpeechSDK.NoMatchReason[details.reason]}`,
            );
          } catch {
            console.warn(`⚠️ [AzureSpeech] NoMatch #${noMatchCountRef.current} (details unavailable)`);
          }
        }
      };

      // ── Session events ────────────────────────────────────────────────────
      recognizer.sessionStarted = (_s, e) => {
        console.log(`🎤 [AzureSpeech] Session started | id=${e.sessionId} | ts=${new Date().toISOString()}`);
        setIsListening(true);
      };

      recognizer.sessionStopped = (_s, e) => {
        console.log(`🔚 [AzureSpeech] Session stopped | id=${e.sessionId} | words=${wordsRef.current.length}`);
        setIsListening(false);
        _teardownAudioPipeline();

        // Compute metrics
        const totalDurationMs = Date.now() - startTimeRef.current;
        const metrics = computeVoiceMetrics(wordsRef.current, totalDurationMs);
        setVoiceMetrics(metrics);
        console.log(
          `📊 [AzureSpeech] Metrics | WPM=${metrics.speechRate} ` +
          `clarity=${metrics.speechClarity} pauses=${metrics.pauseCount} ` +
          `noMatchCount=${noMatchCountRef.current}`,
        );

        if (resolveStopRef.current) {
          resolveStopRef.current(finalTranscriptRef.current);
          resolveStopRef.current = null;
        }
      };

      recognizer.canceled = (_s, e) => {
        const reasonName = SpeechSDK.CancellationReason[e.reason] ?? String(e.reason);
        if (e.reason === SpeechSDK.CancellationReason.Error) {
          // Log full error context for debugging noise-related failures
          console.error(
            `❌ [AzureSpeech] Canceled (Error) | ` +
            `reason=${reasonName} | ` +
            `errorCode=${e.errorCode} | ` +       // e.g. 1007 = connection failure
            `details=${e.errorDetails}`,
          );
          setError(`Azure error [${e.errorCode}]: ${e.errorDetails}`);
        } else {
          console.log(`ℹ️ [AzureSpeech] Canceled | reason=${reasonName}`);
        }
        setIsListening(false);
        _teardownAudioPipeline();

        if (resolveStopRef.current) {
          resolveStopRef.current(finalTranscriptRef.current);
          resolveStopRef.current = null;
        }
      };

      // ── Start continuous recognition ──────────────────────────────────────
      recognizer.startContinuousRecognitionAsync(
        () => console.log('🎤 [AzureSpeech] Continuous recognition started'),
        (err) => {
          console.error('❌ [AzureSpeech] Failed to start:', err);
          setError(`Failed to start recognition: ${err}`);
          setIsListening(false);
          _teardownAudioPipeline();
        },
      );

    } catch (err: any) {
      console.error('❌ [AzureSpeech] Setup error:', err);
      setError(err.message || 'Failed to setup Azure Speech');
      setIsListening(false);
      _teardownAudioPipeline();
    }
  }, [azureKey, azureRegion, _teardownAudioPipeline]);

  const stopRecognition = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const recognizer = recognizerRef.current;
      if (!recognizer) {
        _teardownAudioPipeline();
        resolve(finalTranscriptRef.current);
        return;
      }

      resolveStopRef.current = resolve;

      recognizer.stopContinuousRecognitionAsync(
        () => {
          console.log('🛑 [AzureSpeech] Recognition stopped');
          recognizer.close();
          recognizerRef.current = null;
          // Audio pipeline teardown also happens in sessionStopped event,
          // but call it here too in case sessionStopped doesn't fire.
          _teardownAudioPipeline();
        },
        (err) => {
          console.error('❌ [AzureSpeech] Stop error:', err);
          recognizer.close();
          recognizerRef.current = null;
          _teardownAudioPipeline();
          resolve(finalTranscriptRef.current);
        },
      );
    });
  }, [_teardownAudioPipeline]);

  return {
    transcript,
    interimTranscript,
    isListening,
    isSupported,
    voiceMetrics,
    error,
    noMatchCount,
    startRecognition,
    stopRecognition,
  };
};
