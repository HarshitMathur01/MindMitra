import { createContext, useContext, useEffect, useState } from "react";

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

// ✅ EXPORTED - Transform backend response to avatar-compatible format
export const transformToAvatarMessage = (backendResponse: any) => {
  const text = backendResponse.message || backendResponse.text || backendResponse.content || "I'm here to help.";
  
  console.log('🔄 [Transform] Backend response structure:', {
    hasMessage: 'message' in backendResponse,
    hasAnimation: 'animation' in backendResponse,
    hasFacialExpression: 'facial_expression' in backendResponse,
  });
  
  const detectedSentiment = detectSentiment(text);
  console.log(`🔄 [Transform] Detected sentiment from text: "${detectedSentiment}"`);
  
  const avatarMsg = {
    text: text,
    animation: backendResponse.animation || (text.length > 0 ? "Talking_0" : "Idle"),
    facialExpression: backendResponse.facial_expression || detectedSentiment
  };
  
  console.log('🔄 [Transform] Final avatar message:', {
    textLength: avatarMsg.text.length,
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

  const chat = async (_message: string, _opts?: { personality?: string; companion_name?: string; language?: string }) => {
    // No-op: chat is handled directly by ChatGPTInterface → FastAPI /chat.
  };

  // chatWithAudio — unimplemented placeholder
  const chatWithAudio = async (_audioBlob: Blob) => {
    // TODO: forward audio to /chat/stream speech-to-text endpoint
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
