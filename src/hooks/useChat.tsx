import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const ChatContext = createContext(null);

// Dev-only logger. We were previously logging full message previews on
// every assistant turn to the production console — that's a low-grade
// PII leak on a shared device and clutters Sentry/console signal. Use
// this helper to keep the diagnostics during local development without
// shipping them to users.
const devLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log(...args);
};

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
  
  devLog('🔄 [Transform] Backend response structure:', {
    hasMessage: 'message' in backendResponse,
    hasAnimation: 'animation' in backendResponse,
    hasFacialExpression: 'facial_expression' in backendResponse,
  });
  
  const detectedSentiment = detectSentiment(text);
  devLog(`🔄 [Transform] Detected sentiment from text: "${detectedSentiment}"`);
  
  const avatarMsg = {
    text: text,
    animation: backendResponse.animation || (text.length > 0 ? "Talking_0" : "Idle"),
    facialExpression: backendResponse.facial_expression || detectedSentiment
  };
  
  devLog('🔄 [Transform] Final avatar message:', {
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
  // ✅ Presence Mode — full-screen voice + face surface (Phase 1 skeleton).
  // Distinct from `isAvatarVisible` (legacy half-pane avatar). When
  // Presence Mode is active, the avatar is rendered ONLY inside the
  // PresenceMode overlay (the half-pane is suppressed) to ensure we
  // never mount two TalkingHeadAvatar iframes.
  const [isPresenceMode, setIsPresenceMode] = useState(false);
  // Remember whether avatar was visible before entering presence mode,
  // so we can restore that state on exit (don't surprise the user).
  const [avatarVisibleBeforePresence, setAvatarVisibleBeforePresence] = useState(false);

  // We mirror `isAvatarVisible` and `avatarVisibleBeforePresence` in refs
  // so callbacks below can read the latest values without listing them in
  // their dep arrays. Without this, every flip of `isAvatarVisible` would
  // cause `enterPresenceMode`/`toggleAvatar` to get a new identity, which
  // in turn forces every consumer of the chat context to re-render —
  // including the TalkingHead iframe wrapper, on every avatar token.
  const isAvatarVisibleRef = useRef(isAvatarVisible);
  const avatarVisibleBeforePresenceRef = useRef(avatarVisibleBeforePresence);
  useEffect(() => {
    isAvatarVisibleRef.current = isAvatarVisible;
  }, [isAvatarVisible]);
  useEffect(() => {
    avatarVisibleBeforePresenceRef.current = avatarVisibleBeforePresence;
  }, [avatarVisibleBeforePresence]);

  // ── Avatar queue API ───────────────────────────────────────────────────
  // All callbacks below are stable across renders so memoised consumers
  // (e.g. TalkingHeadAvatar wrapped in React.memo in the future) don't
  // re-render whenever the queue mutates.

  /** Replaces the avatar queue with the latest message (discards backlog). */
  const addAvatarMessage = useCallback((messageContent: string | any) => {
    devLog('🎭 [Avatar Queue] ═══════════════════════════════');
    devLog('🎭 [Avatar Queue] Adding message to avatar');

    const inputData = typeof messageContent === 'string'
      ? { content: messageContent }
      : messageContent;

    const textPreview = typeof messageContent === 'string'
      ? messageContent.substring(0, 100)
      : (messageContent.message || messageContent.content || '').substring(0, 100);

    devLog('🎭 [Avatar Queue] Message preview:', textPreview);
    devLog('🎭 [Avatar Queue] Input type:', typeof messageContent);

    const avatarMessage = transformToAvatarMessage(inputData);

    setMessages((prevMessages) => {
      const newQueue = [avatarMessage];
      devLog('🎭 [Avatar Queue] Replaced queue with latest message');
      devLog('🎭 [Avatar Queue] Discarded', prevMessages.length, 'old messages');
      devLog('🎭 [Avatar Queue] New queue size:', newQueue.length);
      return newQueue;
    });
    devLog('🎭 [Avatar Queue] ═══════════════════════════════');
  }, []);

  /** Appends a sentence to the avatar queue without replacing it.
   * Used for sentence-by-sentence streaming so the avatar speaks
   * back-to-back without gaps. */
  const appendAvatarMessage = useCallback((messageContent: string | any) => {
    const inputData = typeof messageContent === 'string'
      ? { content: messageContent }
      : messageContent;
    const text = typeof messageContent === 'string'
      ? messageContent
      : (messageContent.message || messageContent.content || '');
    if (!text.trim()) return;

    const avatarMessage = transformToAvatarMessage(inputData);
    setMessages((prev) => {
      const updated = [...prev, avatarMessage];
      devLog('🎭 [Avatar Queue] Appended sentence — queue size:', updated.length);
      return updated;
    });
  }, []);

  const clearAvatarMessages = useCallback(() => {
    devLog('🎭 [Avatar Queue] Clearing all messages');
    setMessages([]);
    setMessage(null);
  }, []);

  const chat = useCallback(async (_message: string, _opts?: { personality?: string; companion_name?: string; language?: string }) => {
    // No-op: chat is handled directly by ChatGPTInterface → FastAPI /chat.
  }, []);

  /** Called by the avatar after a message finishes playing — pops the head
   * of the queue so the next sentence can begin. */
  const onMessagePlayed = useCallback(() => {
    devLog('🎭 [Avatar Queue] Message playback complete');
    setMessages((messages) => {
      const newQueue = messages.slice(1);
      devLog('🎭 [Avatar Queue] Removing message from queue');
      devLog('🎭 [Avatar Queue] Remaining messages:', newQueue.length);

      if (newQueue.length > 0) {
        devLog('🎭 [Avatar Queue] Next message will play automatically');
      } else {
        devLog('🎭 [Avatar Queue] Queue empty - avatar will return to idle');
      }

      return newQueue;
    });
  }, []);

  const toggleAvatar = useCallback(() => {
    setIsAvatarVisible((prev) => {
      const next = !prev;
      devLog('🎭 [Avatar] Visibility toggled:', next);
      if (!next) {
        // Clearing inside the setter is a deliberate side-effect — calling
        // clearAvatarMessages from outside would race with React batching.
        setMessages([]);
        setMessage(null);
      }
      return next;
    });
  }, []);

  const closeAvatar = useCallback(() => {
    devLog('🎭 [Avatar] Closed');
    setIsAvatarVisible(false);
    setMessages([]);
    setMessage(null);
  }, []);

  /** Enter Presence Mode (full-screen voice + face). Records the prior
   * `isAvatarVisible` state via ref so exit can restore it. */
  const enterPresenceMode = useCallback(() => {
    devLog('🎭 [Presence] Entering full-screen Presence Mode');
    setAvatarVisibleBeforePresence(isAvatarVisibleRef.current);
    setIsAvatarVisible(true);
    setIsPresenceMode(true);
  }, []);

  /** Exit Presence Mode and restore the prior avatar visibility state. */
  const exitPresenceMode = useCallback(() => {
    devLog('🎭 [Presence] Exiting Presence Mode');
    setIsPresenceMode(false);
    setMessages([]);
    setMessage(null);
    if (!avatarVisibleBeforePresenceRef.current) {
      setIsAvatarVisible(false);
    }
  }, []);

  // Update current message when queue changes
  useEffect(() => {
    if (messages.length > 0) {
      setMessage(messages[0]);
      devLog('🎭 [Avatar] Current message updated:', messages[0].text?.substring(0, 50));
    } else {
      setMessage(null);
      devLog('🎭 [Avatar] No messages in queue');
    }
  }, [messages]);

  // The provider value is memoised so consumers that rely only on
  // (say) `isPresenceMode` don't re-render when only `message` changes.
  // Stability of the callbacks above is what makes this useful — without
  // useCallback, the value object would still get a fresh function ref
  // on every render and defeat the memoisation.
  const value = useMemo(
    () => ({
      chat,
      message,
      onMessagePlayed,
      loading,
      cameraZoomed,
      setCameraZoomed,
      isAvatarVisible,
      toggleAvatar,
      closeAvatar,
      addAvatarMessage,
      appendAvatarMessage,
      clearAvatarMessages,
      isPresenceMode,
      enterPresenceMode,
      exitPresenceMode,
    }),
    [
      chat,
      message,
      onMessagePlayed,
      loading,
      cameraZoomed,
      isAvatarVisible,
      toggleAvatar,
      closeAvatar,
      addAvatarMessage,
      appendAvatarMessage,
      clearAvatarMessages,
      isPresenceMode,
      enterPresenceMode,
      exitPresenceMode,
    ],
  );

  return (
    <ChatContext.Provider value={value}>
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
