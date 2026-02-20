import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SessionManager } from "@/lib/sessionManager";

const ChatContext = createContext(null);

// ✅ EXPORTED - Helper function to detect sentiment from text for facial expressions
export const detectSentiment = (text: string): string => {
  if (!text) return "default";

  const lowerText = text.toLowerCase();

  // Score each emotion category with weighted word matching
  const categories: { [key: string]: { words: string[]; threshold: number } } = {
    smile: {
      words: ['happy', 'great', 'wonderful', 'excellent', 'good', 'love', 'amazing', 'awesome', 'fantastic', 'joy', 'excited', 'proud', 'grateful', 'thank', 'smile', 'better', 'improved', 'success', 'congratulations', 'well done', 'brilliant'],
      threshold: 2,
    },
    gentle: {
      words: ['it\'s okay', 'take your time', 'no rush', 'gently', 'softly', 'slowly', 'breathe', 'calm', 'relax', 'peace', 'safe', 'comfortable', 'at your own pace'],
      threshold: 1,
    },
    compassionate: {
      words: ['i understand', 'i hear you', 'that must be', 'i\'m sorry you', 'it makes sense', 'you\'re not alone', 'i\'m here for', 'that sounds really', 'i can see', 'must have been', 'your feelings are valid'],
      threshold: 1,
    },
    concerned: {
      words: ['worried', 'concerning', 'alarming', 'careful', 'watch out', 'be aware', 'risk', 'dangerous', 'warning', 'serious', 'important to note', 'pay attention'],
      threshold: 1,
    },
    thoughtful: {
      words: ['think about', 'consider', 'perhaps', 'maybe', 'what if', 'reflect', 'ponder', 'let\'s explore', 'interesting', 'perspective', 'another way', 'on the other hand'],
      threshold: 1,
    },
    hopeful: {
      words: ['hope', 'believe', 'possible', 'potential', 'looking forward', 'optimistic', 'bright', 'opportunity', 'growth', 'progress', 'promising', 'you can', 'you will'],
      threshold: 1,
    },
    listening: {
      words: ['tell me more', 'go on', 'i see', 'continue', 'and then', 'what happened', 'how did that', 'can you share'],
      threshold: 1,
    },
    sad: {
      words: ['sad', 'unfortunately', 'terrible', 'awful', 'loss', 'grief', 'mourn', 'depressed', 'lonely', 'heartbreak', 'miss', 'regret', 'sorry for your'],
      threshold: 1,
    },
    surprised: {
      words: ['wow', 'really', 'unbelievable', 'surprised', 'shocked', 'incredible', 'unexpected', 'astonishing', 'no way'],
      threshold: 2,
    },
    angry: {
      words: ['angry', 'furious', 'outraged', 'unacceptable', 'infuriating', 'rage'],
      threshold: 2,
    },
  };

  // Score each category
  const scores: { [key: string]: number } = {};
  for (const [emotion, config] of Object.entries(categories)) {
    scores[emotion] = config.words.filter(word => lowerText.includes(word)).length;
  }

  // Find the highest scoring emotion that meets its threshold
  let bestEmotion = "default";
  let bestScore = 0;
  for (const [emotion, config] of Object.entries(categories)) {
    if (scores[emotion] >= config.threshold && scores[emotion] > bestScore) {
      bestScore = scores[emotion];
      bestEmotion = emotion;
    }
  }

  // Fallback: if text has questions, use listening expression
  if (bestEmotion === "default" && text.includes('?')) {
    bestEmotion = "listening";
  }

  return bestEmotion;
};

// ✅ EXPORTED - Generate lip-sync data from text (without audio)
export const generateTextBasedLipsync = (text: string): { mouthCues: Array<{ start: number; end: number; value: string }> } => {
  console.log('👄 [Lipsync] Generating text-based lip-sync for:', text.substring(0, 50));

  // Phoneme mapping — vowels vs consonants have different characteristics
  const vowelMap: { [key: string]: string } = {
    'a': 'D', 'e': 'C', 'i': 'C', 'o': 'E', 'u': 'F',
  };
  const consonantMap: { [key: string]: string } = {
    'p': 'A', 'b': 'A', 'm': 'A',
    'f': 'G', 'v': 'G',
    't': 'B', 'd': 'B', 'k': 'B', 'g': 'B', 'c': 'B',
    's': 'B', 'z': 'B',
    'r': 'C', 'l': 'H', 'n': 'B',
    'w': 'F', 'y': 'C', 'j': 'C',
    'h': 'X', 'x': 'B', 'q': 'F',
  };
  // Digraphs — two-char combinations
  const digraphMap: { [key: string]: string } = {
    'th': 'H', 'sh': 'B', 'ch': 'B', 'wh': 'F',
    'ng': 'B', 'ph': 'G', 'ck': 'B',
    'ee': 'C', 'oo': 'E', 'ou': 'E', 'ai': 'D', 'ea': 'C',
    'oa': 'E', 'ie': 'C', 'ei': 'C', 'au': 'E',
  };

  // Timing — vowels are longer, stops are short, pauses vary by punctuation
  const vowelDuration = 0.12;       // 120ms — held longer for natural speech
  const consonantDuration = 0.065;  // 65ms — quick, snappy
  const digraphDuration = 0.14;     // 140ms — blended sounds
  const wordPause = 0.08;           // 80ms between words
  const commaPause = 0.22;          // 220ms after commas
  const periodPause = 0.35;         // 350ms after sentences
  const exclamPause = 0.30;         // 300ms after exclamations

  const mouthCues: Array<{ start: number; end: number; value: string }> = [];
  let currentTime = 0.0;

  // Split by words but preserve punctuation
  const tokens = text.split(/(\s+)/);

  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
    const token = tokens[tokenIndex];

    // Skip whitespace tokens
    if (/^\s+$/.test(token)) continue;

    const word = token.replace(/[^a-zA-Z]/g, '').toLowerCase();
    const trailingPunct = token.match(/[.,!?;:]+$/)?.[0] || '';

    if (!word) {
      // Pure punctuation — just add pause
      if (trailingPunct.includes('.') || trailingPunct.includes('?')) {
        currentTime += periodPause;
      } else if (trailingPunct.includes(',') || trailingPunct.includes(';')) {
        currentTime += commaPause;
      }
      continue;
    }

    // Stress pattern: first syllable of longer words gets slightly longer durations
    const isStressed = word.length > 4;
    const stressFactor = isStressed ? 1.15 : 1.0;

    let charIndex = 0;
    while (charIndex < word.length) {
      // Check for digraphs first
      if (charIndex < word.length - 1) {
        const digraph = word[charIndex] + word[charIndex + 1];
        if (digraphMap[digraph]) {
          const dur = digraphDuration * (charIndex < 2 ? stressFactor : 1.0);
          mouthCues.push({
            start: currentTime,
            end: currentTime + dur,
            value: digraphMap[digraph]
          });
          currentTime += dur;
          charIndex += 2;
          continue;
        }
      }

      const char = word[charIndex];

      if (vowelMap[char]) {
        // Vowels held longer, especially in stressed position
        const dur = vowelDuration * (charIndex < 2 ? stressFactor : 1.0);
        mouthCues.push({
          start: currentTime,
          end: currentTime + dur,
          value: vowelMap[char]
        });
        currentTime += dur;
      } else if (consonantMap[char]) {
        mouthCues.push({
          start: currentTime,
          end: currentTime + consonantDuration,
          value: consonantMap[char]
        });
        currentTime += consonantDuration;
      } else {
        // Unknown char — brief rest
        currentTime += consonantDuration * 0.4;
      }

      charIndex++;
    }

    // Add punctuation-appropriate pauses with closed mouth
    if (trailingPunct.includes('.') || trailingPunct.includes('?')) {
      mouthCues.push({ start: currentTime, end: currentTime + periodPause, value: 'X' });
      currentTime += periodPause;
    } else if (trailingPunct.includes('!')) {
      mouthCues.push({ start: currentTime, end: currentTime + exclamPause, value: 'X' });
      currentTime += exclamPause;
    } else if (trailingPunct.includes(',') || trailingPunct.includes(';') || trailingPunct.includes(':')) {
      mouthCues.push({ start: currentTime, end: currentTime + commaPause, value: 'X' });
      currentTime += commaPause;
    } else {
      // Normal word gap
      mouthCues.push({ start: currentTime, end: currentTime + wordPause, value: 'X' });
      currentTime += wordPause;
    }
  }

  console.log(`👄 [Lipsync] Generated ${mouthCues.length} mouth cues, total duration: ${currentTime.toFixed(2)}s`);
  return { mouthCues };
};

// ✅ EXPORTED - Transform backend response to avatar-compatible format
export const transformToAvatarMessage = (backendResponse: any) => {
  const text = backendResponse.message || backendResponse.text || backendResponse.content || "I'm here to help.";
  
  console.log('🔄 [Transform] Backend response structure:', {
    hasMessage: 'message' in backendResponse,
    hasText: 'text' in backendResponse,
    hasContent: 'content' in backendResponse,
    hasAnimation: 'animation' in backendResponse,
    hasFacialExpression: 'facialExpression' in backendResponse,
    hasAudio: 'audio' in backendResponse,
    hasLipsync: 'lipsync' in backendResponse
  });
  
  const detectedSentiment = detectSentiment(text);
  console.log(`🔄 [Transform] Detected sentiment from text: "${detectedSentiment}"`);
  
  const avatarMsg = {
    text: text,
    audio: backendResponse.audio || null, // Will be null until TTS is implemented
    lipsync: backendResponse.lipsync || generateTextBasedLipsync(text), // ✅ Generate from text
    animation: backendResponse.animation || (text.length > 0 ? "Talking_0" : "Idle"), // Talking when has text
    facialExpression: backendResponse.facialExpression || detectedSentiment // Auto-detect or use provided
  };
  
  console.log('🔄 [Transform] Final avatar message:', {
    textLength: avatarMsg.text.length,
    hasAudio: !!avatarMsg.audio,
    hasLipsync: !!avatarMsg.lipsync,
    animation: avatarMsg.animation,
    facialExpression: avatarMsg.facialExpression
  });
  
  return avatarMsg;
};

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cameraZoomed, setCameraZoomed] = useState(true);
  const [isAvatarVisible, setIsAvatarVisible] = useState(false);

  // ✅ NEW - Manually add message to avatar queue (for ChatGPTInterface to use)
  const addAvatarMessage = (messageContent: string | any) => {
    console.log('🎭 [Avatar Queue] ═══════════════════════════════');
    console.log('🎭 [Avatar Queue] Adding message to avatar');
    
    // Handle both string (legacy) and object (full backend response) inputs
    const inputData = typeof messageContent === 'string' 
      ? { content: messageContent } 
      : messageContent;
    
    const textPreview = typeof messageContent === 'string' 
      ? messageContent.substring(0, 100)
      : (messageContent.message || messageContent.content || '').substring(0, 100);
    
    console.log('🎭 [Avatar Queue] Message preview:', textPreview);
    console.log('🎭 [Avatar Queue] Input type:', typeof messageContent);
    console.log('🎭 [Avatar Queue] Has audio:', !!inputData.audio);
    console.log('🎭 [Avatar Queue] Has lipsync:', !!inputData.lipsync);
    
    const avatarMessage = transformToAvatarMessage(inputData);
    
    setMessages((prevMessages) => {
      // Option C: Keep only latest message, discard old backlog
      const newQueue = [avatarMessage]; // Always replace with latest
      console.log('🎭 [Avatar Queue] Replaced queue with latest message');
      console.log('🎭 [Avatar Queue] Discarded', prevMessages.length, 'old messages');
      console.log('🎭 [Avatar Queue] New queue size:', newQueue.length);
      return newQueue;
    });
    console.log('🎭 [Avatar Queue] ═══════════════════════════════');
  };

  // ✅ NEW - Clear avatar message queue
  const clearAvatarMessages = () => {
    console.log('🎭 [Avatar Queue] Clearing all messages');
    setMessages([]);
    setMessage(null);
  };

  const chat = async (message: string) => {
    setLoading(true);
    try {
      // Ensure user is authenticated (sign in anonymously if needed)
      let { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log('No session found, signing in anonymously...');
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        session = data.session;
      }
      
      const userId = session?.user?.id || 'anonymous';
      
      // Use SessionManager for consistent session IDs across app
      // This fixes the critical session fragmentation bug
      const sessionId = SessionManager.getSessionId();

      console.log('Calling Edge Function with:', { userId, sessionId, message: message.substring(0, 50) });

      // Call Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('enhanced-chat-context', {
        body: { 
          message, 
          user_id: userId,
          session_id: sessionId
        }
      });

      if (error) {
        console.error('Edge Function error:', error);
        throw error;
      }

      console.log('Chat response:', data);
      const resp = data.messages || [{ text: data.response || 'No response', audio: null }];
      
      // Transform messages for avatar if visible
      const transformedMessages = resp.map(msg => transformToAvatarMessage(msg));
      setMessages((messages) => [...messages, ...transformedMessages]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = transformToAvatarMessage({ 
        message: `Sorry, I encountered an error: ${error.message}. Please try again.`,
        facialExpression: "sad"
      });
      setMessages((messages) => [...messages, errorMessage]);
    }
    setLoading(false);
  };

  // chatWithAudio for future audio functionality
  const chatWithAudio = async (audioBlob: Blob) => {
    setLoading(true);
    try {
      console.log('🎤 [Audio Chat] Processing audio input...');
      // TODO: Implement audio processing
      throw new Error('Audio chat not yet implemented');
    } catch (error) {
      console.error('Chat with audio error:', error);
      const errorMessage = transformToAvatarMessage({
        message: `Sorry, I encountered an error processing your audio: ${error.message}`,
        facialExpression: "sad"
      });
      setMessages((messages) => [...messages, errorMessage]);
    }
    setLoading(false);
  };

  // ✅ Called when avatar finishes playing a message
  const onMessagePlayed = () => {
    console.log('🎭 [Avatar Queue] Message playback complete');
    setMessages((messages) => {
      const newQueue = messages.slice(1);
      console.log('🎭 [Avatar Queue] Removing message from queue');
      console.log('🎭 [Avatar Queue] Remaining messages:', newQueue.length);
      
      if (newQueue.length > 0) {
        console.log('🎭 [Avatar Queue] Next message will play automatically');
      } else {
        console.log('🎭 [Avatar Queue] Queue empty - avatar will return to idle');
      }
      
      return newQueue;
    });
  };

  // ✅ Toggle avatar visibility
  const toggleAvatar = () => {
    const newState = !isAvatarVisible;
    setIsAvatarVisible(newState);
    console.log('🎭 [Avatar] Visibility toggled:', newState);
    
    // Clear messages when hiding avatar
    if (!newState) {
      clearAvatarMessages();
    }
  };

  const closeAvatar = () => {
    console.log('🎭 [Avatar] Closed');
    setIsAvatarVisible(false);
    clearAvatarMessages();
  };

  // Update current message when queue changes
  useEffect(() => {
    if (messages.length > 0) {
      setMessage(messages[0]);
      console.log('🎭 [Avatar] Current message updated:', messages[0].text?.substring(0, 50));
    } else {
      setMessage(null);
      console.log('🎭 [Avatar] No messages in queue');
    }
  }, [messages]);

  return (
    <ChatContext.Provider
      value={{
        chat,
        chatWithAudio,
        message,
        onMessagePlayed,
        loading,
        cameraZoomed,
        setCameraZoomed,
        isAvatarVisible,
        toggleAvatar,
        closeAvatar,
        addAvatarMessage,        // ✅ NEW - Expose to ChatGPTInterface
        clearAvatarMessages,     // ✅ NEW - Expose for cleanup
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};
