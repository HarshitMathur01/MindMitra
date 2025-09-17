import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Get auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Get user
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error('Auth error:', authError)
      throw new Error('Unauthorized')
    }

    // Get request data
    const { message, sessionId } = await req.json()

    console.log(`🚀 Processing chat for user: ${user.id}`)
    console.log(`📝 Message: "${message}"`)
    console.log(`🔗 Session: ${sessionId}`)

    // Get or create session
    let currentSession = await getOrCreateSession(supabase, sessionId, user.id, message)
    console.log(`📂 Using session: ${currentSession.id}`)

    // Get user activities with comprehensive debugging
    console.log(`🎮 Fetching user activities for user: ${user.id}`)
    
    // First, let's check if the table exists and what's in it
    const { data: tableCheck, error: tableError } = await supabase
      .from('user_activities')
      .select('count(*)')
      .eq('user_id', user.id)

    console.log(`📊 Table check result:`, { tableCheck, tableError })

    // Now get the actual activities with more detailed debugging
    const { data: userActivities, error: activitiesError } = await supabase
      .from('user_activities')
      .select(`
        id,
        activity_type,
        score,
        game_duration,
        difficulty_level,
        accuracy_percentage,
        activity_data,
        user_response_data,
        evaluation_data,
        insights_generated,
        completed_at
      `)
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false })
      .limit(10)

    // Detailed logging of the results
    console.log(`🔍 Activities query result:`)
    console.log(`  - Error:`, activitiesError)
    console.log(`  - Data length:`, userActivities?.length || 0)
    console.log(`  - Raw data:`, JSON.stringify(userActivities, null, 2))

    if (activitiesError) {
      console.error('❌ Error fetching activities:', {
        message: activitiesError.message,
        details: activitiesError.details,
        hint: activitiesError.hint,
        code: activitiesError.code
      })
    } else {
      console.log(`✅ Found ${userActivities?.length || 0} activities`)
      if (userActivities && userActivities.length > 0) {
        console.log('📊 Recent activities summary:')
        userActivities.forEach((activity, index) => {
          console.log(`  ${index + 1}. ${activity.activity_type} - Score: ${activity.score} - Accuracy: ${activity.accuracy_percentage}% - Date: ${activity.completed_at}`)
        })
      } else {
        console.log('📭 No activities found for this user')
        
        // Let's check if there are ANY activities in the table
        const { data: allActivities } = await supabase
          .from('user_activities')
          .select('user_id, activity_type, completed_at')
          .limit(5)
        
        console.log(`🔍 Sample activities in table (any user):`, allActivities)
      }
    }

    // Save user message
    const { error: msgError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: currentSession.id,
        user_id: user.id,
        content: message,
        role: 'user'
      })

    if (msgError) {
      console.error('❌ Message save error:', msgError)
    }

    // Generate AI response with activity context
    const aiResponse = generateSmartResponse(message, userActivities || [])
    console.log(`🤖 Generated response: "${aiResponse.substring(0, 100)}..."`)

    // Save AI response
    const { error: aiMsgError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: currentSession.id,
        user_id: user.id,
        content: aiResponse,
        role: 'assistant',
        metadata: {
          modality: 'CBT',
          processingTime: 1.0,
          activitiesFound: userActivities?.length || 0,
          hasGameContext: (userActivities?.length || 0) > 0
        }
      })

    if (aiMsgError) {
      console.error('❌ AI message save error:', aiMsgError)
    }

    // Update session timestamp
    await supabase
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', currentSession.id)

    console.log(`✅ Chat processing completed successfully`)

    return new Response(
      JSON.stringify({
        message: aiResponse,
        sessionId: currentSession.id,
        sessionTitle: currentSession.title,
        modality: 'CBT',
        processingTime: 1.0,
        debug: {
          activitiesFound: userActivities?.length || 0,
          userId: user.id,
          sessionId: currentSession.id,
          hasGameMemory: (userActivities?.length || 0) > 0
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Chat error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        message: "I'm here to help! I'm having some technical difficulties, but I'm ready to listen. What's on your mind?"
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

async function getOrCreateSession(supabase: any, sessionId: string | undefined, userId: string, message: string) {
  if (sessionId) {
    const { data: existingSession } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single()
    
    if (existingSession) {
      console.log(`📂 Using existing session: ${existingSession.id}`)
      return existingSession
    }
  }

  // Create new session
  const sessionTitle = message.split(' ').slice(0, 4).join(' ') || 'New Chat'
  const { data: newSession, error: sessionError } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: userId,
      title: sessionTitle,
      is_active: true
    })
    .select()
    .single()
  
  if (sessionError) {
    console.error('❌ Session creation error:', sessionError)
    throw new Error('Failed to create session')
  }
  
  console.log(`📂 Created new session: ${newSession.id}`)
  return newSession
}

function generateSmartResponse(message: string, activities: any[]): string {
  const msg = message.toLowerCase()
  
  console.log(`🧠 Generating response for: "${msg}"`)
  console.log(`📊 Available activities: ${activities.length}`)
  
  // Log all available activities for debugging
  if (activities.length > 0) {
    console.log(`🎮 All user activities:`)
    activities.forEach((activity, index) => {
      console.log(`  ${index + 1}. Type: ${activity.activity_type}, Score: ${activity.score}, Date: ${activity.completed_at}`)
    })
  }
  
  // Check for ANY mention of results, performance, or QNA
  if (msg.includes('game') || msg.includes('how did i do') || msg.includes('performance') || 
      msg.includes('activity') || msg.includes('result') || msg.includes('qna') || 
      msg.includes('quiz') || msg.includes('test') || msg.includes('recent')) {
    
    console.log(`🎯 User asking about performance/results`)
    
    if (activities.length > 0) {
      console.log(`✅ Found activities to reference`)
      
      // Get the most recent activity
      const recent = activities[0]
      const activityName = recent.activity_type.replace('_', ' ').replace(/([A-Z])/g, ' $1').trim()
      const score = recent.score || 'N/A'
      const accuracy = recent.accuracy_percentage || null
      const completedAt = new Date(recent.completed_at).toLocaleDateString()
      
      console.log(`🎮 Referencing activity: ${activityName}, score: ${score}, accuracy: ${accuracy}`)
      
      let response = `I can see you recently completed a ${activityName} activity on ${completedAt}! `
      
      if (score !== 'N/A' && score !== null) {
        response += `Your score was ${score}. `
      }
      
      if (accuracy !== null && accuracy !== undefined) {
        response += `You achieved ${Math.round(accuracy)}% accuracy. `
      }
      
      // Add insights from activity data if available
      if (recent.activity_data && typeof recent.activity_data === 'object') {
        const activityData = recent.activity_data
        if (activityData.correctAnswers && activityData.totalQuestions) {
          response += `You got ${activityData.correctAnswers} out of ${activityData.totalQuestions} questions correct. `
        }
      }
      
      if (score > 70 || (accuracy && accuracy > 75)) {
        response += `That's excellent work! You're showing great progress. `
      } else {
        response += `You're making good progress! Every attempt helps you improve. `
      }
      
      response += `How are you feeling about your performance? What would you like to work on next?`
      
      console.log(`🤖 Generated activity-aware response: ${response.substring(0, 100)}...`)
      return response
      
    } else {
      console.log(`❌ No activities found, giving default response`)
      return "I don't see any recent activity results in your profile yet. Would you like to try one of our therapeutic games or QNA sessions? We have memory challenges, emotion recognition, thought detective exercises, and wellness check-ins that can help with your mental wellness journey."
    }
  }
  
  // Check if user has recent activities and incorporate them naturally
  if (activities.length > 0 && !msg.includes('game') && !msg.includes('result')) {
    const recentTypes = activities.slice(0, 3).map(a => a.activity_type)
    console.log(`🔄 Adding context for recent activities: ${recentTypes.join(', ')}`)
    
    if (recentTypes.includes('emotion_match') || recentTypes.includes('EmotionMatch')) {
      return `I notice you've been working on emotion recognition recently - that's fantastic for building emotional intelligence! ${getBasicResponse(msg)}`
    } else if (recentTypes.includes('memory_challenge') || recentTypes.includes('MemoryChallenge')) {
      return `I see you've been exercising your memory and cognitive skills - excellent work on your mental fitness! ${getBasicResponse(msg)}`
    } else if (recentTypes.includes('thought_detective') || recentTypes.includes('ThoughtDetective')) {
      return `I noticed you've been exploring thought patterns with our CBT exercises - great work on building self-awareness! ${getBasicResponse(msg)}`
    } else if (recentTypes.includes('wellness_checkin') || recentTypes.includes('WellnessCheckIn')) {
      return `I see you've been doing wellness check-ins - that's wonderful for tracking your mental health progress! ${getBasicResponse(msg)}`
    }
  }
  
  console.log(`🔄 Using basic response for: "${msg}"`)
  return getBasicResponse(msg)
}

function getBasicResponse(msg: string): string {
  if (msg.includes('hello') || msg.includes('hi')) {
    return "Hello! I'm MindMate, your therapeutic AI companion. I'm here to support you on your mental health journey. How are you feeling today?"
  }
  
  if (msg.includes('anxious') || msg.includes('anxiety')) {
    return "I understand you're feeling anxious. Let's take this step by step. Try taking a deep breath with me - in for 4 counts, hold for 4, out for 4. What's specifically making you feel anxious right now?"
  }
  
  if (msg.includes('sad') || msg.includes('depressed')) {
    return "I hear that you're going through a difficult time. Your feelings are completely valid, and you're not alone. What's been weighing on your mind? I'm here to listen and support you."
  }
  
  return "Thank you for sharing that with me. I'm here to listen and support you. Could you tell me more about what you're experiencing? I want to understand how I can best help you right now."
}