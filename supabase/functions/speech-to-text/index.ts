import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

// Enhanced voice analysis using Gemini (reusing your existing model)
async function analyzeVoiceTranscript(transcript: string): Promise<VoiceInsights> {
  const geminiApiKey = Deno.env.get('GOOGLE_API_KEY');
  if (!geminiApiKey) {
    console.warn('Google API key not available, using basic analysis');
    return getBasicAnalysis(transcript);
  }

  try {
    const prompt = `Analyze this Indian youth's voice message for psychological and cultural insights:

"${transcript}"

Provide analysis in this EXACT JSON format:
{
  "emotional_tone": "[calm/anxious/sad/excited/frustrated/neutral]",
  "stress_level": "[low/medium/high]", 
  "confidence_score": [0.0-1.0],
  "psychological_markers": {
    "academic_pressure": [true/false],
    "family_pressure": [true/false], 
    "social_anxiety": [true/false],
    "help_seeking": [true/false]
  },
  "cultural_context": {
    "hindi_english_mixing": [true/false],
    "formality_level": "[formal/casual/intimate]",
    "cultural_references": ["array", "of", "detected", "references"]
  }
}

Focus on:
- Indian cultural context (academic pressure, family dynamics)
- Mental health indicators (anxiety, depression, stress markers)
- Language patterns (Hindi-English code switching)
- Emotional state from word choice and content`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const analysisText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (analysisText) {
      // Try to parse JSON from Gemini response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedAnalysis = JSON.parse(jsonMatch[0]);
        return {
          emotional_tone: parsedAnalysis.emotional_tone || 'neutral',
          stress_level: parsedAnalysis.stress_level || 'medium',
          confidence_score: parsedAnalysis.confidence_score || 0.8,
          psychological_markers: parsedAnalysis.psychological_markers || {
            academic_pressure: false,
            family_pressure: false,
            social_anxiety: false,
            help_seeking: false
          },
          cultural_context: parsedAnalysis.cultural_context || {
            hindi_english_mixing: false,
            formality_level: 'formal',
            cultural_references: []
          }
        };
      }
    }
    
    // Fallback if parsing fails
    console.warn('Failed to parse Gemini response, using basic analysis');
    return getBasicAnalysis(transcript);

  } catch (error) {
    console.error('Gemini analysis failed:', error);
    return getBasicAnalysis(transcript);
  }
}

// Basic fallback analysis
function getBasicAnalysis(transcript: string): VoiceInsights {
  const text = transcript.toLowerCase();
  
  // Basic emotional tone detection
  let emotional_tone: VoiceInsights['emotional_tone'] = 'neutral';
  let stress_level: VoiceInsights['stress_level'] = 'medium';
  
  if (text.includes('anxious') || text.includes('worried') || text.includes('stressed')) {
    emotional_tone = 'anxious';
    stress_level = 'high';
  } else if (text.includes('sad') || text.includes('depressed') || text.includes('down')) {
    emotional_tone = 'sad';
  } else if (text.includes('excited') || text.includes('happy') || text.includes('great')) {
    emotional_tone = 'excited';
    stress_level = 'low';
  } else if (text.includes('frustrated') || text.includes('angry')) {
    emotional_tone = 'frustrated';
    stress_level = 'high';
  }

  // Basic marker detection
  const academic_pressure = text.includes('exam') || text.includes('study') || text.includes('college') || text.includes('marks');
  const family_pressure = text.includes('family') || text.includes('parents') || text.includes('marriage');
  const social_anxiety = text.includes('friends') || text.includes('social') || text.includes('embarrassed');
  const help_seeking = text.includes('help') || text.includes('advice') || text.includes('support');
  
  // Basic cultural detection
  const hindiWords = ['yaar', 'bhai', 'bas', 'kya', 'hai', 'achha', 'theek'];
  const hindi_english_mixing = hindiWords.some(word => text.includes(word));
  
  const cultural_references: string[] = [];
  if (text.includes('diwali') || text.includes('festival')) cultural_references.push('festivals');
  if (text.includes('iit') || text.includes('jee')) cultural_references.push('competitive_exams');

  return {
    emotional_tone,
    stress_level,
    confidence_score: 0.6,
    psychological_markers: {
      academic_pressure,
      family_pressure,
      social_anxiety,
      help_seeking
    },
    cultural_context: {
      hindi_english_mixing,
      formality_level: hindi_english_mixing ? 'casual' : 'formal',
      cultural_references
    }
  };
}

// Process base64 in chunks to prevent memory issues (for audio processing)
function processBase64Chunks(base64String: string, chunkSize = 32768) {
  const chunks: Uint8Array[] = [];
  let position = 0;
  
  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);
    
    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }
    
    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    console.log('🎤 Enhanced speech-to-text function starting...');

    // Initialize Supabase client for database operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get auth header and verify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    const requestData = await req.json();
    console.log('📝 Request data received:', Object.keys(requestData));

    // Handle transcript analysis mode (our main use case)
    if (requestData.transcript && requestData.mode === 'analysis_only') {
      console.log('🧠 Processing transcript analysis...');
      
      const { transcript, sessionId, messageId } = requestData;
      
      // Perform voice analysis
      const voiceInsights = await analyzeVoiceTranscript(transcript);
      console.log('✅ Voice analysis completed:', voiceInsights.emotional_tone);

      // Save to database if messageId provided
      if (messageId) {
        try {
          const { error: saveError } = await supabase
            .from('voice_analytics')
            .insert([{
              message_id: messageId,
              user_id: user.id,
              session_id: sessionId,
              emotional_tone: voiceInsights.emotional_tone,
              stress_level: voiceInsights.stress_level,
              confidence_score: voiceInsights.confidence_score,
              psychological_markers: voiceInsights.psychological_markers,
              cultural_context: voiceInsights.cultural_context
            }]);

          if (saveError) {
            console.error('❌ Failed to save voice analytics:', saveError);
          } else {
            console.log('✅ Voice analytics saved to database');
          }
        } catch (dbError) {
          console.error('❌ Database save error:', dbError);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          voice_insights: voiceInsights,
          processing_time: Date.now() - startTime
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle audio processing mode (future functionality)
    if (requestData.audio) {
      console.log('🎵 Processing audio file...');
      return await processAudioFile(requestData.audio);
    }

    throw new Error('No transcript or audio data provided');

  } catch (error) {
    console.error('❌ Speech-to-text function error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        processing_time: Date.now() - startTime
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Audio processing function (for future audio file uploads)
async function processAudioFile(audioBase64: string) {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured for audio processing');
  }

  try {
    console.log('🔄 Processing audio with OpenAI Whisper...');
    
    // Process audio in chunks
    const binaryAudio = processBase64Chunks(audioBase64);
    
    // Prepare form data
    const formData = new FormData();
    const blob = new Blob([binaryAudio], { type: 'audio/webm' });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    // Send to OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Whisper transcription successful');

    // Analyze the transcript
    const voiceInsights = await analyzeVoiceTranscript(result.text);

    return new Response(
      JSON.stringify({
        success: true,
        transcript: result.text,
        voice_insights: voiceInsights
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Audio processing failed:', error);
    throw error;
  }
}