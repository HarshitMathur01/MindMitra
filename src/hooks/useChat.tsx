import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SessionManager } from "@/lib/sessionManager";

const ChatContext = createContext(null);

// ✅ EXPORTED - Helper function to detect sentiment from text for facial expressions
export const detectSentiment = (text: string): string => {
  if (!text) return "default";
  
  const lowerText = text.toLowerCase();
  
  // Positive indicators
  const positiveWords = ['happy', 'great', 'wonderful', 'excellent', 'good', 'love', 'amazing', 'awesome', 'fantastic', 'joy', 'excited', 'proud', 'grateful', 'thank', 'smile', 'better', 'improved', 'success'];
  const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
  
  // Negative indicators
  const negativeWords = ['sad', 'bad', 'terrible', 'awful', 'hate', 'angry', 'frustrated', 'depressed', 'anxious', 'worried', 'scared', 'fear', 'sorry', 'difficult', 'hard', 'struggle', 'pain', 'hurt'];
  const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
  
  // Surprised indicators
  const surpriseWords = ['wow', 'really', 'amazing', 'unbelievable', 'surprised', 'shocked', 'incredible', '!'];
  const surpriseCount = surpriseWords.filter(word => lowerText.includes(word)).length;
  
  if (surpriseCount >= 2) return "surprised";
  if (positiveCount > negativeCount && positiveCount >= 2) return "smile";
  if (negativeCount > positiveCount && negativeCount >= 2) return "sad";
  
  return "default";
};

// ✅ EXPORTED - Generate lip-sync data from text (without audio)
export const generateTextBasedLipsync = (text: string): { mouthCues: Array<{ start: number; end: number; value: string }> } => {
  console.log('👄 [Lipsync] Generating text-based lip-sync for:', text.substring(0, 50));
  
  // Phoneme mapping based on character sounds
  const phonemeMap: { [key: string]: string } = {
    'a': 'D', 'e': 'E', 'i': 'C', 'o': 'E', 'u': 'F',
    'p': 'A', 'b': 'A', 'm': 'A',
    'f': 'G', 'v': 'G',
    't': 'B', 'd': 'B', 'k': 'B', 'g': 'B',
    's': 'X', 'z': 'X', 'r': 'X', 'l': 'X', 'n': 'X', 'h': 'X',
    'w': 'F', 'y': 'C'
  };
  
  const mouthCues: Array<{ start: number; end: number; value: string }> = [];
  let currentTime = 0.0;
  const phonemeDuration = 0.15; // 150ms per phoneme
  const wordPauseDuration = 0.1; // 100ms between words
  
  const words = text.split(' ');
  
  for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
    const word = words[wordIndex].toLowerCase();
    
    for (let charIndex = 0; charIndex < word.length; charIndex++) {
      const char = word[charIndex];
      
      // Check for digraphs (two-character phonemes)
      if (charIndex < word.length - 1) {
        const digraph = char + word[charIndex + 1];
        if (digraph === 'th') {
          mouthCues.push({
            start: currentTime,
            end: currentTime + phonemeDuration,
            value: 'H'
          });
          currentTime += phonemeDuration;
          charIndex++; // Skip next character
          continue;
        }
      }
      
      // Map character to phoneme
      if (phonemeMap[char]) {
        mouthCues.push({
          start: currentTime,
          end: currentTime + phonemeDuration,
          value: phonemeMap[char]
        });
        currentTime += phonemeDuration;
      } else if (char.match(/[a-z]/)) {
        // Unknown letter - use default closed mouth
        mouthCues.push({
          start: currentTime,
          end: currentTime + phonemeDuration * 0.5,
          value: 'X'
        });
        currentTime += phonemeDuration * 0.5;
      }
    }
    
    // Add pause between words
    if (wordIndex < words.length - 1) {
      mouthCues.push({
        start: currentTime,
        end: currentTime + wordPauseDuration,
        value: 'X'
      });
      currentTime += wordPauseDuration;
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
