import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Deno global declaration for edge functions
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 [EDGE] Enhanced chat function starting...')
    console.log('📥 [EDGE] Request method:', req.method)
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Get auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('❌ [EDGE] No authorization header')
      throw new Error('No authorization header')
    }

    // Get user
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error('❌ [EDGE] Auth error:', authError)
      throw new Error('Authentication failed')
    }

    console.log('✅ [EDGE] User authenticated:', user.id)

    // Get request data
    const requestData = await req.json()
    console.log('📦 [EDGE] Request data structure:', {
      hasMessage: !!requestData.message,
      hasSessionId: !!requestData.sessionId,
      hasVoiceAnalysis: !!requestData.voiceAnalysis,
      voiceAnalysisKeys: requestData.voiceAnalysis ? Object.keys(requestData.voiceAnalysis) : []
    })

    const { message, sessionId, voiceAnalysis } = requestData

    // Log voice analysis details if provided
    if (voiceAnalysis) {
      console.log('🎤 [EDGE] Voice analysis received:')
      console.log('- Emotional tone:', voiceAnalysis.emotional_tone || 'unknown')
      console.log('- Stress level:', voiceAnalysis.stress_level || 'unknown')
      console.log('- Confidence score:', voiceAnalysis.confidence_score || 'unknown')
      console.log('- Cultural context:', JSON.stringify(voiceAnalysis.cultural_context || {}))
      console.log('- Psychological markers:', JSON.stringify(voiceAnalysis.psychological_markers || {}))
    } else {
      console.log('📝 [EDGE] No voice analysis provided - text-only message')
    }

    // Validate inputs
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      console.error('❌ [EDGE] Invalid message:', { message, type: typeof message })
      throw new Error('Invalid or empty message provided');
    }

    if (message.length > 5000) {
      throw new Error('Message too long. Please keep messages under 5000 characters.');
    }

    const trimmedMessage = message.trim();
    console.log('📝 Message:', trimmedMessage);
    
    // Log voice analysis if provided
    if (voiceAnalysis) {
      console.log('🎤 Voice analysis received:', voiceAnalysis.emotional_tone || 'unknown');
    }

    // Handle session ID validation
    let currentSessionId: string = sessionId || crypto.randomUUID();
    
    if (sessionId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(sessionId)) {
        currentSessionId = crypto.randomUUID();
      } else {
        // Validate session belongs to user
        try {
          const { data: sessionData } = await supabase
            .from('chat_messages')
            .select('session_id')
            .eq('session_id', sessionId)
            .eq('user_id', user.id)
            .limit(1);

          if (!sessionData || sessionData.length === 0) {
            currentSessionId = crypto.randomUUID();
          }
        } catch (validationError) {
          console.warn('Session validation failed:', validationError);
          currentSessionId = crypto.randomUUID();
        }
      }
    }
    
    console.log('📂 Using session ID:', currentSessionId)

    // PARALLEL DATA LOADING for faster performance
    console.log('� Loading user context in parallel...')
    
    const [messagesResult, summaryResult, activitiesResult, userMessageSaved] = await Promise.all([
      // Load recent messages
      supabase
        .from('chat_messages')
        .select('content, role, created_at')
        .eq('session_id', currentSessionId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
      
      // Load conversation summary
      supabase
        .from('conversation_summaries')
        .select('key_themes, progress_indicators, important_insights, created_at')
        .eq('session_id', currentSessionId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1),
      
      // Load user activities
      supabase
        .from('user_activities')
        .select('id, activity_type, score, accuracy_percentage, completed_at')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(5),
      
      // Save user message immediately
      supabase
        .from('chat_messages')
        .insert({
          session_id: currentSessionId,
          user_id: user.id,
          content: trimmedMessage,
          role: 'user',
          sender: 'user'
        })
    ]);

    // Process results
    const recentMessages = messagesResult.data || [];
    if (recentMessages.length > 0) recentMessages.reverse(); // Chronological order
    
    const conversationSummary = summaryResult.data?.[0] || {};
    const userActivities = activitiesResult.data || [];
    
    console.log('✅ [EDGE] Context loaded successfully:')
    console.log('- Recent messages:', recentMessages.length)
    console.log('- User activities:', userActivities.length)
    console.log('- Has conversation summary:', !!conversationSummary.key_themes)
    console.log('- Voice analysis present:', !!voiceAnalysis)

    // CRITICAL: Call the 2-agent workflow with voice-enhanced context
    console.log('🤖 [EDGE] Calling 2-agent psychology workflow with voice analysis...')
    console.log('📊 [EDGE] Workflow input data:')
    console.log('- Message length:', trimmedMessage.length)
    console.log('- Recent messages:', recentMessages.length)
    console.log('- Voice data keys:', voiceAnalysis ? Object.keys(voiceAnalysis) : 'none')
    
    const workflowResponse = await callWorkflow({
      user_message: trimmedMessage,
      recent_messages: recentMessages,
      conversation_summary: conversationSummary,
      user_activities: userActivities,
      user_patterns: {},
      voice_analysis: voiceAnalysis || null, // Include voice analysis
      user_id: user.id,
      session_id: currentSessionId
    });

    console.log('✅ [EDGE] Workflow response received from Python backend')
    console.log('📊 [EDGE] Response metadata:', {
      hasMessage: !!workflowResponse?.message,
      messageLength: workflowResponse?.message?.length || 0,
      modality: workflowResponse?.modality || 'unknown',
      processingTime: workflowResponse?.processing_time || 0
    })

    // ENSURE we have a valid response from the workflow
    if (!workflowResponse || !workflowResponse.message) {
      console.error('❌ [EDGE] Workflow response validation failed:', workflowResponse)
      throw new Error('Workflow failed to generate response');
    }

    const aiResponse = workflowResponse.message;
    const modality = workflowResponse.modality || 'Supportive';
    const processingTime = workflowResponse.processing_time || 0;
    
    console.log(`🤖 [EDGE] LLM response validated (${aiResponse.length} chars, ${processingTime}s processing)`);

    // Save AI response to database
    try {
      console.log('💾 [EDGE] Saving AI response to database...');
      
      const { error: saveError } = await supabase
        .from('chat_messages')
        .insert({
          session_id: currentSessionId,
          user_id: user.id,
          content: aiResponse,
          role: 'assistant',
          sender: 'ai'
        });

      if (saveError) {
        console.error('❌ Failed to save AI response:', saveError);
      } else {
        console.log('✅ AI response saved successfully');
      }
    } catch (saveError) {
      console.error('⚠️ Exception while saving AI response:', saveError);
    }

    return new Response(
      JSON.stringify({
        message: aiResponse,
        sessionId: currentSessionId,
        sessionTitle: trimmedMessage.length > 50 ? trimmedMessage.substring(0, 50) + '...' : trimmedMessage,
        modality: modality,
        processingTime: processingTime,
        debug: {
          activitiesFound: userActivities.length,
          recentMessagesCount: recentMessages.length,
          hasSummary: Object.keys(conversationSummary).length > 0,
          workflowInsights: workflowResponse.session_insights || {},
          userId: user.id,
          sessionId: currentSessionId,
          timestamp: new Date().toISOString()
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Function error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        sessionId: crypto.randomUUID(),
        debug: {
          error: true,
          errorMessage: error.message,
          timestamp: new Date().toISOString()
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

// CRITICAL: Proper workflow calling with comprehensive logging
async function callWorkflow(data: any) {
  console.log('🔗 [WORKFLOW] Connecting to Python workflow backend...');
  
  // Use the ngrok URL from environment variable
  const WORKFLOW_URL = Deno.env.get('WORKFLOW_URL') || 'http://localhost:8000/chat';
  const TIMEOUT_MS = 60000; // 60 seconds timeout
  
  console.log('🌐 [WORKFLOW] Configuration:')
  console.log('- Workflow URL:', WORKFLOW_URL)
  console.log('- Timeout:', TIMEOUT_MS / 1000, 'seconds')
  console.log('- Has voice analysis:', !!data.voice_analysis)
  
  try {
    console.log(`📡 [WORKFLOW] Sending request to Python backend...`)
    console.log('📊 [WORKFLOW] Request payload structure:', {
      hasUserMessage: !!data.user_message,
      messageLength: data.user_message?.length || 0,
      recentMessagesCount: data.recent_messages?.length || 0,
      hasVoiceAnalysis: !!data.voice_analysis,
      voiceAnalysisKeys: data.voice_analysis ? Object.keys(data.voice_analysis) : [],
      userId: data.user_id,
      sessionId: data.session_id
    })
    
    const startTime = Date.now()
    
    const response = await fetch(WORKFLOW_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Supabase-Edge-Function-Voice-Enhanced'
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    const responseTime = Date.now() - startTime
    console.log(`📥 [WORKFLOW] Response received in ${responseTime}ms`)
    console.log(`📊 [WORKFLOW] HTTP Status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [WORKFLOW] Backend API error:', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText.substring(0, 500) // Limit error text
      })
      throw new Error(`Workflow API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    console.log('✅ [WORKFLOW] Response parsed successfully')
    console.log('📊 [WORKFLOW] Response validation:', {
      hasResult: !!result,
      hasMessage: !!result?.message,
      messageType: typeof result?.message,
      messageLength: result?.message?.length || 0,
      hasModality: !!result?.modality,
      processingTime: result?.processing_time || 0,
      voiceAware: result?.voice_aware || false
    })
    
    if (!result || typeof result.message !== 'string' || result.message.trim().length === 0) {
      console.error('❌ [WORKFLOW] Invalid response format:', {
        result: result ? 'exists' : 'null',
        messageType: typeof result?.message,
        messageLength: result?.message?.length || 0
      })
      throw new Error('Workflow returned invalid response format');
    }
    
    console.log('✅ [WORKFLOW] Response validation passed')
    console.log(`📊 [WORKFLOW] Final stats: ${result.message.length} chars, ${result.processing_time || 0}s processing`)
    if (result.voice_aware) {
      console.log('🎤 [WORKFLOW] Response is voice-aware - psychology agents considered voice analysis')
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ [WORKFLOW] Connection failed:', {
      error: error.message,
      url: WORKFLOW_URL,
      timeoutMs: TIMEOUT_MS
    })
    throw new Error(`Workflow connection failed: ${error.message}`);
  }
}