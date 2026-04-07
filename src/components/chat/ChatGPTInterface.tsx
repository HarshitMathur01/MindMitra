import { useState, useEffect, useRef, useMemo } from "react";
import { Send, Mic, User, Plus, Search, MessageSquare, Settings, Download, MoreVertical, Copy, ThumbsUp, ThumbsDown, Menu, Home, Trash2, Edit3, PanelLeftClose, PanelLeftOpen, Eye, EyeOff, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { Avatar } from "@radix-ui/react-avatar";
import TalkingHeadAvatar from "./TalkingHeadAvatar"
import { useChat } from "../../hooks/useChat"
import { motion, AnimatePresence } from "framer-motion"
import MessageRenderer from "./MessageRenderer"
import { jsPDF } from "jspdf";
import QuickReplies from "./QuickReplies";
import { AVATAR_OPTIONS } from "@/lib/avatarOptions";

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
}

type RecentChatPreview = {
  id: string;
  title: string;
  created_at: string;
  messageCount: number;
};

const suggestedPrompts = [
  "Help me understand my personality type",
  "I'm feeling anxious, what can I do?",
  "Can you analyze my mood patterns?",
  "What are some stress management techniques?",
  "Tell me about different types of therapy",
  "How can I improve my mental wellness?",
];

const quickCategories = [
  { label: "Mental Health", icon: "🧠", color: "bg-primary/15 text-primary" },
  { label: "Personality", icon: "🎭", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  { label: "Stress Relief", icon: "🌿", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  { label: "Relationships", icon: "💖", color: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300" },
  { label: "Self-Care", icon: "✨", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  { label: "Therapy", icon: "💬", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" },
];

const loadingPhases = [
  "Reading this with care",
  "Thinking of what to say",
  "Putting it into words",
];

type MoodOption = {
  emoji: string;
  label: string;
  value: number;
};

const moodLabelsByValue: Record<number, string> = {
  1: "Struggling",
  2: "Low",
  3: "Okay",
  4: "Good",
  5: "Great",
};

const moodEmojiPools: Record<number, string[]> = {
  1: ["😔", "😣", "😞", "😢", "🥺"],
  2: ["😕", "🙁", "😟", "🫤", "😶"],
  3: ["😐", "🙂", "😌", "🫡", "😶‍🌫️"],
  4: ["😊", "😃", "😄", "😎", "🌤️"],
  5: ["🤩", "😁", "✨", "🥳", "🌟"],
};

const hashSessionSeed = (sessionId: string): number => {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash = (hash * 31 + sessionId.charCodeAt(i)) % 1000003;
  }
  return hash;
};

const buildMoodOptionsForSession = (sessionId: string | null): MoodOption[] => {
  const values = [1, 2, 3, 4, 5];
  const seed = sessionId ? hashSessionSeed(sessionId) : Math.floor(Math.random() * 1000000);

  return values.map((value, index) => {
    const pool = moodEmojiPools[value] ?? ["🙂"];
    const emoji = pool[(seed + index * 7) % pool.length] ?? pool[0];

    return {
      value,
      label: moodLabelsByValue[value] ?? "Mood",
      emoji,
    };
  });
};

// Real-time transcription component — reveals text word by word
const TypewriterText = ({
  text,
  speed = 350,
  onComplete,
  className,
  maxVisibleWords,
}: {
  text: string;
  speed?: number;
  onComplete?: () => void;
  className?: string;
  maxVisibleWords?: number;
}) => {
  const [visibleCount, setVisibleCount] = useState(0);
  const wordsRef = useRef<string[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    wordsRef.current = text.split(' ');
    setVisibleCount(0);

    if (intervalRef.current) clearInterval(intervalRef.current);

    let count = 0;
    intervalRef.current = setInterval(() => {
      count++;
      setVisibleCount(count);
      if (count >= wordsRef.current.length) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        onCompleteRef.current?.();
      }
    }, speed);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text, speed]);

  const allVisible = wordsRef.current.slice(0, visibleCount);
  const displayedWords = maxVisibleWords ? allVisible.slice(-maxVisibleWords) : allVisible;
  const displayedText = displayedWords.join(' ');
  const isComplete = visibleCount >= wordsRef.current.length;

  return (
    <span className={className}>
      {displayedText}
      {!isComplete && (
        <span className="inline-block w-[2px] h-[1em] bg-primary ml-1 animate-pulse align-middle" />
      )}
    </span>
  );
};

const RecentChatItem = ({
  chat,
  isActive,
  loadingSession,
  onSelect,
}: {
  chat: RecentChatPreview;
  isActive: boolean;
  loadingSession: boolean;
  onSelect: (chatId: string) => void;
}) => {
  const [displayMessageCount, setDisplayMessageCount] = useState(chat.messageCount || 0);

  useEffect(() => {
    if (displayMessageCount === chat.messageCount) {
      return undefined;
    }

    const startCount = displayMessageCount;
    const endCount = chat.messageCount;
    const startedAt = performance.now();
    let frameId = 0;

    const animateCount = (now: number) => {
      const progress = Math.min((now - startedAt) / 320, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(startCount + (endCount - startCount) * easedProgress);

      setDisplayMessageCount(nextValue);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(animateCount);
      }
    };

    frameId = window.requestAnimationFrame(animateCount);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [chat.messageCount, displayMessageCount]);

  return (
    <motion.div
      layout="position"
      initial={false}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      <Button
        variant="ghost"
        disabled={loadingSession}
        className={`w-full h-auto rounded-xl text-left px-3 py-2.5 transition-all duration-200 group relative border-l-2 ${isActive
          ? 'bg-primary/10 border-l-primary text-text-primary'
          : 'border-l-transparent text-text-secondary hover:text-text-primary hover:bg-background/50'
          } ${loadingSession ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => onSelect(chat.id)}
      >
        <div className="min-w-0 w-full">
          <p className="truncate leading-tight text-sm font-medium">{chat.title}</p>
          <p className="text-xs text-text-secondary/70 mt-0.5">{displayMessageCount} msgs</p>
        </div>
      </Button>
    </motion.div>
  );
};

const mergeRecentChats = (previousChats: RecentChatPreview[], nextChats: RecentChatPreview[]) => {
  const previousChatsById = new Map(previousChats.map((chat) => [chat.id, chat]));

  const mergedChats = nextChats.map((chat) => {
    const previousChat = previousChatsById.get(chat.id);

    if (!previousChat) {
      return chat;
    }

    const stableTitle = previousChat.title || chat.title;

    if (
      previousChat.title === stableTitle &&
      previousChat.created_at === chat.created_at &&
      previousChat.messageCount === chat.messageCount
    ) {
      return previousChat;
    }

    return {
      ...previousChat,
      title: stableTitle,
      created_at: chat.created_at,
      messageCount: chat.messageCount,
    };
  });

  const isSameList = previousChats.length === mergedChats.length && previousChats.every((chat, index) => chat === mergedChats[index]);
  return isSameList ? previousChats : mergedChats;
};

const ChatGPTInterface = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [recentChats, setRecentChats] = useState<RecentChatPreview[]>([]);
  const [transcribingMsgId, setTranscribingMsgId] = useState<string | null>(null);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const { user } = useAuth();
  const { settings, saveSettings } = useSettings();
  const { toast } = useToast();
  const { isRecording, isProcessing, toggleRecording, currentTranscript, lastVoiceAnalysis } = useVoiceRecording();
  const [voiceTempMsgId, setVoiceTempMsgId] = useState<string | null>(null);
  const pendingVoiceAnalysisRef = useRef<any>(null);
  const pendingAudioDataRef = useRef<string | null>(null);
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  // Mood check-in state (per session)
  const [moodSelected, setMoodSelected] = useState(false);
  const [moodValue, setMoodValue] = useState<number | null>(null);
  const moodOptions = useMemo(() => buildMoodOptionsForSession(currentSessionId), [currentSessionId]);
  // Send micro-interaction
  const [justSent, setJustSent] = useState(false);
  // Scroll-to-bottom button
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const voiceSilenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTranscriptRef = useRef('');
  const isAutoStoppingRef = useRef(false);
  const { isAvatarVisible, toggleAvatar, closeAvatar, addAvatarMessage, clearAvatarMessages, message: avatarCurrentMessage } = useChat();

  // ── Avatar model selection ───────────────────────────────────────────────────────
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(
    settings?.avatar_model ?? 'brunette'
  );
  useEffect(() => {
    if (settings?.avatar_model) {
      setSelectedAvatarId(settings.avatar_model);
    }
  }, [settings?.avatar_model]);
  const selectedAvatar = AVATAR_OPTIONS.find(a => a.id === selectedAvatarId) ?? AVATAR_OPTIONS[0];

  const userDisplayName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split("@")[0] ??
    "U";
  const userAvatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const userInitial = userDisplayName.trim().charAt(0).toUpperCase() || "U";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!isLoading) {
      setLoadingProgress(0);
      return;
    }

    const interval = window.setInterval(() => {
      setLoadingProgress((current) => {
        if (current >= 92) {
          return current;
        }

        if (current < 28) {
          return current + 4;
        }

        if (current < 55) {
          return current + 3;
        }

        if (current < 78) {
          return current + 2;
        }

        return current + 1;
      });
    }, 180);

    return () => window.clearInterval(interval);
  }, [isLoading]);

  const loadingPhase = loadingPhases[Math.min(Math.floor(loadingProgress / 33), loadingPhases.length - 1)] ?? loadingPhases[0];
  const headerStatusText = isLoading ? loadingPhase : 'Online';
  const bubbleStatusText = `${loadingPhase} ${loadingProgress}%`;

  // Signal to PersonalitySelector that a chat session is open (enables mid-session switch warning)
  useEffect(() => {
    localStorage.setItem('mm-active-chat-session', 'true');
    window.dispatchEvent(new StorageEvent('storage', { key: 'mm-active-chat-session', newValue: 'true' }));
    return () => {
      localStorage.removeItem('mm-active-chat-session');
      window.dispatchEvent(new StorageEvent('storage', { key: 'mm-active-chat-session', newValue: null }));
    };
  }, []);

  // Initialize session from localStorage
  useEffect(() => {
    const savedSessionId = localStorage.getItem('currentChatSession');
    if (savedSessionId) {
      setCurrentSessionId(savedSessionId);
      console.log('🔄 Restored session ID from localStorage:', savedSessionId);
    }
  }, []);

  // Load recent chats and restore session when component mounts
  useEffect(() => {
    if (user) {
      console.log('👤 User authenticated, loading chat data...');

      // Load recent chats first
      loadRecentChats();

      // Check if there's a current session to restore
      const savedSessionId = localStorage.getItem('currentChatSession');
      if (savedSessionId) {
        console.log('🔄 Restoring saved session:', savedSessionId);
        selectRecentChat(savedSessionId);
      } else {
        console.log('🆕 No saved session, starting new chat');
        startNewChat();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Refresh recent chats periodically to catch any new messages
  useEffect(() => {
    if (user) {
      const interval = setInterval(() => {
        loadRecentChats();
      }, 10000); // Refresh every 10 seconds

      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Update temporary voice message with live transcript
  useEffect(() => {
    if (isRecording && voiceTempMsgId && currentTranscript) {
      setMessages(msgs => msgs.map(m =>
        m.id === voiceTempMsgId
          ? { ...m, content: currentTranscript || '🎤 Recording...' }
          : m
      ));
    }
  }, [isRecording, currentTranscript, voiceTempMsgId]);

  const clearVoiceSilenceTimer = () => {
    if (voiceSilenceTimeoutRef.current) {
      clearTimeout(voiceSilenceTimeoutRef.current);
      voiceSilenceTimeoutRef.current = null;
    }
  };

  const clearVoiceTempMessage = () => {
    if (voiceTempMsgId) {
      setMessages(msgs => msgs.filter(m => m.id !== voiceTempMsgId));
      setVoiceTempMsgId(null);
    }
  };

  const stopVoiceRecordingAndSend = async () => {
    if (!isRecording || isAutoStoppingRef.current) return;

    isAutoStoppingRef.current = true;
    try {
      const result = await toggleRecording(currentSessionId || undefined, voiceTempMsgId || undefined);
      clearVoiceTempMessage();

      if (result?.transcript) {
        // Store voice analysis + audio data for the next handleSendMessage call
        pendingVoiceAnalysisRef.current = result.voiceAnalysis || null;
        pendingAudioDataRef.current = result.audioData || null;
        await handleSendMessage(result.transcript);
        pendingVoiceAnalysisRef.current = null;
        pendingAudioDataRef.current = null;
      }
    } finally {
      isAutoStoppingRef.current = false;
      clearVoiceSilenceTimer();
      lastTranscriptRef.current = '';
    }
  };

  useEffect(() => {
    if (!isRecording || !isAvatarVisible) {
      clearVoiceSilenceTimer();
      lastTranscriptRef.current = '';
      return;
    }

    const transcript = currentTranscript.trim();
    if (!transcript || transcript === lastTranscriptRef.current) return;

    lastTranscriptRef.current = transcript;
    clearVoiceSilenceTimer();

    voiceSilenceTimeoutRef.current = setTimeout(() => {
      stopVoiceRecordingAndSend();
    }, 1500);

    return () => {
      clearVoiceSilenceTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, isAvatarVisible, currentTranscript, currentSessionId, voiceTempMsgId]);

  useEffect(() => {
    return () => {
      clearVoiceSilenceTimer();
    };
  }, []);

  const saveMessage = async (message: Message, sessionId: string) => {
    try {
      if (!user) return;

      console.log('💾 Saving message to database:', {
        session_id: sessionId,
        content: message.content,
        role: message.sender === 'user' ? 'user' : 'assistant'
      });

      const { error } = await supabase
        .from('chat_messages')
        .insert({
          user_id: user.id,
          session_id: sessionId,
          content: message.content,
          sender: message.sender,
          role: message.sender === 'user' ? 'user' : 'assistant'
        });

      if (error) {
        console.error('❌ Error saving message:', error);
        throw error;
      }

      console.log('✅ Message saved successfully');
    } catch (error) {
      console.error('❌ Failed to save message:', error);
    }
  };

  const loadRecentChats = async () => {
    if (!user) return;

    setLoadingChats(true);
    try {
      console.log('🔍 Loading recent chats from chat_messages table...');

      // Get unique sessions with their latest activity and first user message
      const { data, error } = await supabase
        .from('chat_messages')
        .select('session_id, content, created_at, role')
        .eq('user_id', user.id)
        .not('session_id', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error loading chat messages:', error);
        return;
      }

      console.log('📊 Total messages found:', data?.length || 0);

      if (!data || data.length === 0) {
        setRecentChats([]);
        return;
      }

      // Group messages by session_id
      const sessionMap = new Map();

      data.forEach(msg => {
        if (!sessionMap.has(msg.session_id)) {
          sessionMap.set(msg.session_id, {
            id: msg.session_id,
            messages: [],
            firstUserMessage: null,
            lastActivity: msg.created_at,
            messageCount: 0
          });
        }

        const session = sessionMap.get(msg.session_id);
        session.messages.push(msg);
        session.messageCount++;

        // Update last activity if this message is newer
        if (msg.created_at > session.lastActivity) {
          session.lastActivity = msg.created_at;
        }

        // We fetch messages in descending order, so overwriting user messages
        // leaves us with the oldest user message as a stable session title.
        if (msg.role === 'user') {
          session.firstUserMessage = msg.content;
        }
      });

      const existingTitlesById = new Map(recentChats.map((chat) => [chat.id, chat.title]));

      // Convert to RecentChat array
      const chatList = Array.from(sessionMap.values())
        .filter(session => session.messageCount > 0) // Only show sessions with messages
        .map(session => ({
          id: session.id,
          title: existingTitlesById.get(session.id) ?? (session.firstUserMessage ?
            (session.firstUserMessage.substring(0, 50) + (session.firstUserMessage.length > 50 ? '...' : '')) :
            'New Chat'),
          created_at: session.lastActivity,
          messageCount: session.messageCount
        }))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20); // Show latest 20 chats

      console.log('✅ Processed chat sessions:', chatList.length);
      setRecentChats((previousChats) => mergeRecentChats(previousChats, chatList));

    } catch (error) {
      console.error('❌ Failed to load recent chats:', error);
    } finally {
      setLoadingChats(false);
    }
  };

  const selectRecentChat = async (chatId: string) => {
    console.log('🔄 Switching to chat session:', chatId);

    // Prevent loading if already on this session and messages are loaded
    if (currentSessionId === chatId && messages.length > 0) {
      console.log('Already on session:', chatId);
      return;
    }

    // Prevent multiple simultaneous session loads
    if (loadingSession) {
      console.log('Session already loading, ignoring click');
      return;
    }

    setLoadingSession(true);

    try {
      // Clear current messages first to prevent mixing
      setMessages([]);

      // Load messages for this specific session first
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, content, role, created_at')
        .eq('session_id', chatId)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Error loading session messages:', error);
        toast({
          title: "Error",
          description: "Failed to load chat session. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Convert to Message format with validation
      const sessionMessages: Message[] = data?.map(msg => ({
        id: msg.id,
        content: msg.content,
        sender: (msg.role === 'user' ? 'user' : 'ai') as "user" | "ai",
        timestamp: new Date(msg.created_at)
      })) || [];

      console.log('✅ Loaded messages for session:', sessionMessages.length, 'Session ID:', chatId);

      // Update session state and localStorage after successful message load
      setCurrentSessionId(chatId);
      localStorage.setItem('currentChatSession', chatId);

      // Set the messages
      setMessages(sessionMessages);

    } catch (error) {
      console.error('❌ Failed to load session messages:', error);
      toast({
        title: "Error",
        description: "Failed to switch to chat session. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingSession(false);
    }
  };

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || inputValue;
    if (!textToSend.trim() || isLoading) return;

    console.log('🚀 DIRECT BACKEND MODE: Sending message...');
    console.log('Message:', textToSend);
    console.log('Current session ID:', currentSessionId);

    const userMessage: Message = {
      id: Date.now().toString(),
      content: textToSend,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    // Send button micro-interaction
    setJustSent(true);
    setTimeout(() => setJustSent(false), 600);

    try {
      // Get current session for authentication
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No active session found');
      }

      // Ensure we have a session ID
      let sessionIdToUse = currentSessionId;
      if (!sessionIdToUse) {
        sessionIdToUse = crypto.randomUUID();
        setCurrentSessionId(sessionIdToUse);
        localStorage.setItem('currentChatSession', sessionIdToUse);
        console.log('🆔 Generated new session ID:', sessionIdToUse);
      }

      // Save the user message first (non-blocking - ⚡ P0 optimization)
      saveMessage(userMessage, sessionIdToUse).catch(err =>
        console.error('❌ Background save failed:', err)
      );

      // Call backend directly (no Edge Function)
      const backendUrl = import.meta.env.VITE_BACKEND_URL;
      if (!backendUrl) {
        throw new Error('VITE_BACKEND_URL environment variable is not configured');
      }
      console.log('📡 Calling backend directly:', `${backendUrl}/chat`);
      console.log('🎭 Avatar visibility state:', isAvatarVisible);

      // Stream natively via SSE hook
      const response = await fetch(`${backendUrl}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          user_message: textToSend,
          session_id: sessionIdToUse,
          voice_analysis: pendingVoiceAnalysisRef.current || null,
          audio_data: pendingAudioDataRef.current || null,
          avatar_visible: isAvatarVisible,  // ⚡ P0: Skip TTS when avatar hidden
          personality: settings?.companion_personality || settings?.avatar_personality || 'mitra',
          companion_name: settings?.companion_name || 'Mitra',
          language: settings?.language || 'english',
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Backend error:', response.status, errorText);
        throw new Error(`Backend returned ${response.status}: ${errorText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullMessage = "";
      let finalData: any = {};

      const tempId = (Date.now() + 1).toString();
      const aiResponse: Message = {
        id: tempId,
        content: "",
        sender: "ai",
        timestamp: new Date(),
      };

      let isFirstChunk = true;

      if (reader) {
        while (true) {
          const { value, done: readerDone } = await reader.read();
          if (readerDone) break;
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const sseData = JSON.parse(line.substring(6));

                  if (isFirstChunk && (sseData.chunk || sseData.message)) {
                    isFirstChunk = false;
                    setIsLoading(false); // Instantly drop the "breathing space" loading bubble
                    const currentSessionCheck = localStorage.getItem('currentChatSession');
                    if (currentSessionCheck === sessionIdToUse) {
                      setMessages(prev => [...prev, aiResponse]);
                    }
                  }

                  if (sseData.chunk) {
                    fullMessage += sseData.chunk;
                    setMessages(prev => prev.map(msg => msg.id === tempId ? { ...msg, content: fullMessage } : msg));
                  } else if (sseData.message) {
                    if (isFirstChunk) { // Fallback if no chunks received
                      isFirstChunk = false;
                      setIsLoading(false);
                      const currentSessionCheck = localStorage.getItem('currentChatSession');
                      if (currentSessionCheck === sessionIdToUse) {
                        setMessages(prev => [...prev, aiResponse]);
                      }
                    }
                    finalData = sseData;
                    fullMessage = sseData.message; // Ensure exact final match
                    setMessages(prev => prev.map(msg => msg.id === tempId ? { ...msg, content: fullMessage } : msg));
                  } else if (sseData.error) {
                    console.error('SSE Error:', sseData.error);
                  }
                } catch (e) { }
              }
            }
          }
        }
      }

      console.log('📡 Stream complete. Final data:', finalData);
      const data = finalData;

      if (!data || !data.message) {
        // Fallback if missing payload
        data.message = fullMessage || "I apologize, but I'm having trouble responding right now.";
      }
      aiResponse.content = data.message;

      console.log(`AI Response: ${aiResponse.content}`);

      // Mark for real-time transcription if avatar is visible
      if (isAvatarVisible) {
        setTranscribingMsgId(aiResponse.id);
      }

      // ✅ Always queue message - avatar will play when opened
      console.log('🎭 [Chat] Queueing AI response for avatar (will play when opened)');
      console.log('🎭 [Chat] Backend data contains:', {
        hasMessage: !!data.message,
        animation: data.animation,
        facialExpression: data.facial_expression
      });
      addAvatarMessage(data);

      // Save AI response to database (non-blocking - ⚡ P0 optimization)
      saveMessage(aiResponse, sessionIdToUse).catch(err =>
        console.error('❌ Background save failed:', err)
      );

      console.log('✅ Message exchange completed');

      // Refresh recent chats list after successful message exchange
      setTimeout(async () => {
        await loadRecentChats();
      }, 1000);

    } catch (error) {
      console.error('❌ Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to get AI response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceInput = async () => {
    try {
      console.log('🎤 [UI] Voice button clicked, current recording state:', isRecording);
      console.log('🎤 [UI] Session ID:', currentSessionId);
      console.log('🎤 [UI] About to call toggleRecording...');

      if (isRecording) {
        await stopVoiceRecordingAndSend();
      } else {
        // Start recording
        console.log('🎤 [UI] Starting recording...');
        clearVoiceSilenceTimer();
        lastTranscriptRef.current = '';
        // Add temporary message
        const tempId = `voice-${Date.now()}`;
        setVoiceTempMsgId(tempId);
        setMessages(msgs => [...msgs, {
          id: tempId,
          content: '🎤 Recording...',
          sender: 'user',
          timestamp: new Date()
        }]);
        await toggleRecording(currentSessionId, tempId);
        console.log('🎤 [UI] Recording started successfully');
      }
    } catch (error) {
      console.error('❌ [UI] Voice input error:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Copied!",
      description: "Message copied to clipboard.",
    });
  };

  const getExportFileName = (extension: "pdf" | "json" | "csv") => {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    return `mindmitra-chat-${stamp}.${extension}`;
  };

  const downloadBlob = (content: BlobPart, mimeType: string, fileName: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const exportChatAsJson = () => {
    if (messages.length === 0) {
      toast({
        title: "No messages to export",
        description: "Start a conversation first, then try again.",
      });
      return;
    }

    const exportPayload = {
      sessionId: currentSessionId,
      exportedAt: new Date().toISOString(),
      totalMessages: messages.length,
      messages: messages.map((message) => ({
        id: message.id,
        sender: message.sender,
        timestamp: message.timestamp.toISOString(),
        content: message.content,
      })),
    };

    downloadBlob(
      JSON.stringify(exportPayload, null, 2),
      "application/json;charset=utf-8",
      getExportFileName("json")
    );

    toast({
      title: "Chat exported",
      description: "Downloaded as JSON.",
    });
  };

  const exportChatAsCsv = () => {
    if (messages.length === 0) {
      toast({
        title: "No messages to export",
        description: "Start a conversation first, then try again.",
      });
      return;
    }

    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const header = ["id", "sender", "timestamp", "content"];
    const rows = messages.map((message) => [
      message.id,
      message.sender,
      message.timestamp.toISOString(),
      message.content.replace(/\r?\n/g, "\\n"),
    ]);

    const csvContent = [header, ...rows]
      .map((row) => row.map((cell) => escapeCsv(String(cell))).join(","))
      .join("\n");

    downloadBlob(
      csvContent,
      "text/csv;charset=utf-8",
      getExportFileName("csv")
    );

    toast({
      title: "Chat exported",
      description: "Downloaded as CSV.",
    });
  };

  const exportChatAsPdf = () => {
    if (messages.length === 0) {
      toast({
        title: "No messages to export",
        description: "Start a conversation first, then try again.",
      });
      return;
    }

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const horizontalPadding = 40;
    const maxTextWidth = pageWidth - horizontalPadding * 2;

    let y = 48;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("MindMitra Chat Export", horizontalPadding, y);

    y += 20;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const exportedAt = new Date().toLocaleString();
    doc.text(`Exported at: ${exportedAt}`, horizontalPadding, y);

    y += 24;
    doc.setFontSize(11);

    messages.forEach((message, index) => {
      const senderLabel = message.sender === "user" ? "User" : "MindMitra";
      const timestamp = message.timestamp.toLocaleString();
      const metaLine = `[${timestamp}] ${senderLabel}`;
      const contentLines = doc.splitTextToSize(message.content || "", maxTextWidth);

      const blockHeight = 18 + contentLines.length * 14 + 10;
      if (y + blockHeight > pageHeight - 40) {
        doc.addPage();
        y = 48;
      }

      doc.setFont("helvetica", "bold");
      doc.text(metaLine, horizontalPadding, y);
      y += 16;

      doc.setFont("helvetica", "normal");
      doc.text(contentLines.length > 0 ? contentLines : [""], horizontalPadding, y);
      y += contentLines.length * 14 + 8;

      if (index < messages.length - 1) {
        doc.setDrawColor(220);
        doc.line(horizontalPadding, y, pageWidth - horizontalPadding, y);
        y += 12;
      }
    });

    doc.save(getExportFileName("pdf"));

    toast({
      title: "Chat exported",
      description: "Downloaded as PDF.",
    });
  };

  const filteredMessages = messages.filter(message =>
    searchQuery === "" ||
    message.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startNewChat = async () => {
    console.log('🆕 Starting new chat...');

    const newSessionId = crypto.randomUUID();

    // Clear current state first
    setMessages([]);
    setCurrentSessionId(newSessionId);
    setSearchQuery("");
    setMoodSelected(false);
    setMoodValue(null);
    localStorage.setItem('currentChatSession', newSessionId);

    console.log('✅ New chat session created:', newSessionId);

    // Fetch personalized greeting (non-blocking)
    fetchGreeting(newSessionId).catch(err => {
      console.log('⚠️ Greeting skipped:', err);
    });

    // Immediately refresh recent chats to show new session
    await loadRecentChats();
  };

  const fetchGreeting = async (sessionId: string) => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL;
      if (!backendUrl) {
        console.log('⚠️ Backend URL not configured, skipping greeting');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.log('⚠️ No auth token, skipping greeting');
        return;
      }

      const personalityId = settings?.companion_personality || settings?.avatar_personality || 'mitra';
      const companionName = settings?.companion_name || '';

      console.log('👋 Fetching personalized greeting...');
      const params = new URLSearchParams({ session_id: sessionId });
      if (personalityId) params.set('personality', personalityId);
      if (companionName) params.set('companion_name', companionName);

      const response = await fetch(`${backendUrl}/chat/greeting?${params}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Greeting API failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.show_greeting && data.greeting) {
        console.log(`✅ Got greeting: "${data.greeting}" (${data.language_used}, ${data.time_slot})`);

        // Add greeting as first AI message
        const greetingMessage: Message = {
          id: crypto.randomUUID(),
          content: data.greeting,
          sender: 'ai',
          timestamp: new Date()
        };

        setMessages([greetingMessage]);

        // Also add to avatar if visible
        if (isAvatarVisible) {
          addAvatarMessage({
            text: data.greeting,
            audio: null,
            facialExpression: 'smile',
            animation: 'Talking'
          });
        }
      }
    } catch (error) {
      console.log('⚠️ Greeting generation failed (non-critical):', error);
      // Fail silently - greeting is nice-to-have, not required
    }
  };

  if (!user) {
    return null; // Will redirect to auth
  }

  // ── Mood check-in handler ─────────────────────────────────────────────────
  const handleMoodSelect = (value: number) => {
    setMoodValue(value);
    setMoodSelected(true);
    const moodMap: Record<number, string> = {
      1: "I'm really struggling right now",
      2: "I'm feeling a bit low",
      3: "I'm feeling okay",
      4: "I'm feeling pretty good",
      5: "I'm feeling great!",
    };
    // Auto-send mood as an opening message
    handleSendMessage(moodMap[value]);
  };

  // ── Static quick-reply chips based on AI message topic ────────────────────
  const getQuickReplies = (content: string): string[] => {
    const lower = content.toLowerCase();
    if (lower.includes('breath') || lower.includes('exhale') || lower.includes('inhale'))
      return ['Guide me through it', 'How long should I do this?', 'What else can help?'];
    if (lower.includes('stress') || lower.includes('overwhelm') || lower.includes('pressure'))
      return ['Tell me more techniques', 'Why do I feel this way?', 'Help me calm down now'];
    if (lower.includes('anxiet') || lower.includes('worry') || lower.includes('panic'))
      return ['What causes anxiety?', 'Try a grounding exercise', 'When should I seek help?'];
    if (lower.includes('sleep') || lower.includes('insomnia') || lower.includes('tired'))
      return ['Give me sleep tips', 'Why can\'t I sleep?', 'Try a relaxation technique'];
    if (lower.includes('sad') || lower.includes('depress') || lower.includes('hopeless'))
      return ['I want to talk more', 'What can I do right now?', 'Help me find a therapist'];
    if (lower.includes('motivat') || lower.includes('goal') || lower.includes('productiv'))
      return ['How do I stay consistent?', 'Set a small goal with me', 'Why do I procrastinate?'];
    if (lower.includes('relationship') || lower.includes('friend') || lower.includes('family'))
      return ['Tell me more', 'How do I communicate better?', 'Set healthy boundaries'];
    return ['Tell me more', 'How can I apply this?', 'What should I do next?'];
  };

  // ── Date separator helper ─────────────────────────────────────────────────
  const formatDateSeparator = (date: Date): string => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const d = date.toDateString();
    if (d === today) return 'Today';
    if (d === yesterday) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // ── Group sidebar chats by date ───────────────────────────────────────────
  const groupedChats = (() => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    return {
      today: recentChats.filter(c => new Date(c.created_at).toDateString() === today),
      yesterday: recentChats.filter(c => new Date(c.created_at).toDateString() === yesterday),
      earlier: recentChats.filter(c => {
        const d = new Date(c.created_at).toDateString();
        return d !== today && d !== yesterday;
      }),
    };
  })();

  return (
    <div className="flex h-screen bg-background text-text-primary transition-colors duration-300 relative overflow-hidden">
      {/* Ambient depth blobs — warm teal + ivory */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-20 -right-10 w-80 h-80 rounded-full bg-primary/[0.06] blur-3xl" />
        <div className="absolute -bottom-16 -left-10 w-72 h-72 rounded-full bg-[hsl(38,55%,80%)]/[0.14] blur-3xl" />
      </div>
      {/* Enhanced ChatGPT-style Sidebar with Glassmorphism */}
      <motion.div
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className={`${sidebarCollapsed ? 'w-0' : 'w-72'} transition-all duration-300 bg-gradient-to-b from-primary/25 via-background to-background text-text-primary flex flex-col border-r border-border backdrop-blur-xl overflow-hidden shadow-theme`}
      >
        {/* Sidebar Header with Gradient */}
        <div className="p-4 border-b border-border bg-background/40">
          <Button
            onClick={startNewChat}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-primary to-[hsl(168,48%,34%)] hover:from-[hsl(188,55%,32%)] hover:to-[hsl(168,52%,28%)] border-0 text-white justify-start gap-2 text-sm font-semibold shadow-sm hover:shadow-md transition-all duration-300"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
            New chat
          </Button>
        </div>

        {/* Search with Animation */}
        <div className="p-4 border-b border-border/80">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-12 rounded-2xl pl-10 bg-background/75 border border-border text-text-primary placeholder:text-text-secondary focus:border-primary focus:ring-2 focus:ring-primary/25 text-sm transition-all duration-300"
            />
          </div>
        </div>

        {/* Navigation & Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 custom-scrollbar">
            {/* Navigation Items with Hover Effects */}
            <Button
              variant="ghost"
              className="w-full h-12 rounded-2xl justify-start px-3 text-text-primary bg-background/60 hover:bg-background/90 text-sm font-medium flex-shrink-0 transition-all duration-300"
              onClick={() => navigate('/')}
            >
              <Home className="h-5 w-5 mr-2" />
              Home
            </Button>

            {/* Recent Chats — grouped by date */}
            <div className="pt-1 pb-1">
              <div className="flex items-center justify-between px-1 mb-2">
                <h3 className="text-sm font-semibold text-primary/80 uppercase tracking-wider">
                  Recent Chats
                </h3>
              </div>
              <div className="space-y-0.5 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                {loadingChats ? (
                  <div className="space-y-2 py-2 px-1">
                    <Skeleton className="h-9 w-full bg-surface/50 rounded-xl" />
                    <Skeleton className="h-9 w-[80%] bg-surface/50 rounded-xl" />
                    <Skeleton className="h-9 w-full bg-surface/50 rounded-xl" />
                  </div>
                ) : recentChats.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-3 py-2 text-sm text-text-secondary italic">
                    No recent chats
                  </motion.div>
                ) : (
                  <AnimatePresence initial={false} mode="popLayout">
                    {(["today", "yesterday", "earlier"] as const).map((group) => {
                      const chats = groupedChats[group];
                      if (!chats.length) return null;
                      const label = group === "today" ? "Today" : group === "yesterday" ? "Yesterday" : "Earlier";
                      return (
                        <div key={group}>
                          <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/55 px-3 pt-2 pb-1">{label}</span>
                          {chats.map((chat) => (
                            <RecentChatItem
                              key={chat.id}
                              chat={chat}
                              isActive={currentSessionId === chat.id}
                              loadingSession={loadingSession}
                              onSelect={selectRecentChat}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </AnimatePresence>
                )}
              </div>
            </div>

            {/* Quick Topics Section with Gradient Effects */}
            <div className="pt-1 pb-1">
              <h3 className="text-sm font-semibold text-primary/80 uppercase tracking-wider px-1 mb-2">
                Quick Topics
              </h3>
              <div className="space-y-0.5">
                {quickCategories.map((category) => (
                  <Button
                    key={category.label}
                    variant="ghost"
                    className="w-full justify-start px-3 text-text-primary/90 hover:bg-background/60 hover:text-text-primary text-sm py-1 h-9 rounded-xl transition-all duration-300"
                    onClick={() => handleSendMessage(`Tell me about ${category.label.toLowerCase()}`)}
                  >
                    <span className="w-5 h-5 mr-2 flex items-center justify-center text-lg flex-shrink-0">{category.icon}</span>
                    {category.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Suggested Prompts Section with Hover Effects */}
            <div className="pt-1 pb-1">
              <h3 className="text-sm font-semibold text-primary/80 uppercase tracking-wider px-1 mb-2">
                Suggested
              </h3>
              <div className="space-y-0.5">
                {suggestedPrompts.slice(0, 3).map((prompt, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    className="w-full justify-start px-3 text-text-secondary hover:bg-background/60 hover:text-text-primary text-sm p-2.5 h-auto leading-tight rounded-xl transition-all duration-300"
                    onClick={() => handleSendMessage(prompt)}
                  >
                    <span className="text-left line-clamp-2">
                      {prompt.length > 35 ? `${prompt.substring(0, 35)}...` : prompt}
                    </span>
                  </Button>
                ))}
              </div>
            </div>

          </div>

          {/* Footer with Gradient — pinned at bottom */}
          <div className="flex-shrink-0 border-t border-border pt-2 bg-background/30 px-3">
            <div className="flex items-center justify-between px-1 py-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-theme">
                  <User className="h-3 w-3 text-white" />
                </div>
                <span className="text-sm text-text-secondary truncate max-w-[170px]">
                  {user?.email?.split('@')[0] || 'User'}
                </span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-text-secondary hover:text-text-primary hover:bg-background transition-colors">
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => supabase.auth.signOut()}>
                    <Download className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Enhanced Chat Header with Glassmorphism */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="border-b border-border bg-surface/80 backdrop-blur-xl p-4 flex items-center justify-between shadow-theme"
        >
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="hover:bg-background transition-colors"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="w-9 h-9 rounded-full bg-[#FAEBD7] flex items-center justify-center shadow-[0_8px_18px_rgba(15,23,42,0.18)] transition-colors duration-150 hover:bg-[#F3DFC6]"
                  aria-label="Go to home"
                >
                  <img src="/image.png" alt="MindMitra" className="h-5 w-5 object-contain" />
                </button>
                {/* Online indicator dot — pulse when loading, steady when idle */}
                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-background ${isLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
              </div>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="text-left"
                aria-label="Go to home"
              >
                <h1 className="text-xl font-bold text-text-primary leading-tight">MindMitra</h1>
                <p className="text-[11px] text-text-secondary leading-none">{headerStatusText}</p>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  toggleAvatar();
                  if (isAvatarVisible) setTranscribingMsgId(null); // Clear transcription when hiding avatar
                }}
                className={`
                  group relative overflow-hidden transition-all duration-300
                  ${isAvatarVisible
                    ? 'bg-surface border-primary/40 hover:shadow-theme'
                    : 'bg-surface border-border hover:shadow-theme'
                  }
                `}
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  animate={{
                    x: isAvatarVisible ? ['-100%', '100%'] : '-100%',
                  }}
                  transition={{
                    duration: 2,
                    repeat: isAvatarVisible ? Infinity : 0,
                    ease: 'linear',
                  }}
                />
                <div className="relative flex items-center gap-2">
                  <motion.div
                    animate={{ rotate: isAvatarVisible ? 0 : 180 }}
                    transition={{ duration: 0.3 }}
                  >
                    {isAvatarVisible ? (
                      <Eye className="h-4 w-4 text-primary" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-text-secondary" />
                    )}
                  </motion.div>
                  <span className="font-medium">
                    {isAvatarVisible ? 'Hide Avatar' : 'Show Avatar'}
                  </span>
                  <motion.div
                    animate={{ scale: isAvatarVisible ? [1, 1.2, 1] : 1 }}
                    transition={{ duration: 1.5, repeat: isAvatarVisible ? Infinity : 0 }}
                  >
                    <div className={`
                      w-2 h-2 rounded-full 
                      ${isAvatarVisible
                        ? 'bg-success shadow-theme'
                        : 'bg-text-secondary'
                      }
                    `} />
                  </motion.div>
                </div>
              </Button>
            </motion.div>

            {/* ── Avatar model picker ───────────────────────────────────────── */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-surface border-border hover:shadow-theme gap-2"
                >
                  <User className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm hidden sm:inline">{selectedAvatar.name}</span>
                  <ChevronDown className="h-3 w-3 text-text-secondary" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {AVATAR_OPTIONS.map((avatar) => (
                  <DropdownMenuItem
                    key={avatar.id}
                    onClick={() => {
                      setSelectedAvatarId(avatar.id);
                      saveSettings({ avatar_model: avatar.id });
                    }}
                    className="flex items-center justify-between py-2"
                  >
                    <div>
                      <p className="font-medium text-sm">{avatar.name}</p>
                      <p className="text-xs text-muted-foreground">{avatar.description}</p>
                    </div>
                    {selectedAvatarId === avatar.id && (
                      <div className="w-2 h-2 rounded-full bg-primary ml-2 flex-shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="hover:bg-background transition-colors">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={exportChatAsPdf}>
                  <Download className="h-4 w-4 mr-2" />
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportChatAsJson}>
                  <Download className="h-4 w-4 mr-2" />
                  Export as JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportChatAsCsv}>
                  <Download className="h-4 w-4 mr-2" />
                  Export as CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </motion.div>

        {/* Messages Area with Animations - Conditional 50-50 split */}
        <div className={`grid grid-rows-1 h-[80%] ${isAvatarVisible ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {isAvatarVisible && (
            <div className="relative bg-background border-r border-border overflow-hidden transition-colors duration-300">
              <TalkingHeadAvatar key={selectedAvatarId} avatarUrl={selectedAvatar.url} />
              {/* Real-time transcription subtitle overlay */}
              <AnimatePresence>
                {avatarCurrentMessage?.text && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.3 }}
                    className="absolute bottom-0 left-0 right-0 p-3 pointer-events-none z-10"
                  >
                    <div className="bg-black/70 backdrop-blur-md rounded-xl px-4 py-3 mx-2 max-h-24 overflow-hidden">
                      <TypewriterText
                        text={avatarCurrentMessage.text}
                        speed={350}
                        maxVisibleWords={12}
                        className="text-white text-sm font-medium leading-relaxed drop-shadow-lg"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          <div className="flex-1 overflow-y-scroll bg-background transition-colors duration-300 relative"
            ref={scrollAreaRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 250);
            }}
          >
            <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
              {/* ── Mood check-in widget (new session only) ──────────────── */}
              <AnimatePresence>
                {filteredMessages.length <= 1 && !moodSelected && (
                  <motion.div
                    key="mood-widget"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12, scale: 0.95 }}
                    transition={{ duration: 0.35 }}
                    className="mx-auto max-w-sm bg-surface/90 border border-border rounded-2xl p-5 text-center space-y-3 shadow-sm"
                  >
                    <p className="text-sm font-semibold text-text-primary">How are you feeling right now?</p>
                    <div className="flex justify-center gap-2">
                      {moodOptions.map(({ emoji, label, value }) => (
                        <button
                          key={value}
                          onClick={() => handleMoodSelect(value)}
                          className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-primary/10 transition-colors group"
                          title={label}
                        >
                          <span className="text-2xl group-hover:scale-125 transition-transform duration-200 select-none">{emoji}</span>
                          <span className="text-[10px] text-muted-foreground">{label}</span>
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setMoodSelected(true)}
                      className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                    >
                      Skip
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Message list ─────────────────────────────────────────── */}
              {loadingSession && filteredMessages.length === 0 ? (
                <div className="space-y-6 w-full py-4">
                  <div className="flex gap-3 items-start w-full">
                    <Skeleton className="w-8 h-8 rounded-full flex-shrink-0 bg-surface/80" />
                    <div className="space-y-2 flex-1 max-w-[85%]">
                      <Skeleton className="h-16 w-full sm:w-[80%] rounded-2xl rounded-tl-sm bg-surface/60" />
                      <Skeleton className="h-4 w-24 bg-surface/40" />
                    </div>
                  </div>
                  <div className="flex gap-3 items-start justify-end w-full">
                    <div className="space-y-2 flex-1 max-w-[85%] flex flex-col items-end">
                      <Skeleton className="h-12 w-full sm:w-[50%] rounded-2xl rounded-tr-sm bg-primary/20" />
                    </div>
                  </div>
                  <div className="flex gap-3 items-start w-full">
                    <Skeleton className="w-8 h-8 rounded-full flex-shrink-0 bg-surface/80" />
                    <div className="space-y-2 flex-1 max-w-[85%]">
                      <Skeleton className="h-24 w-full sm:w-[90%] rounded-2xl rounded-tl-sm bg-surface/60" />
                    </div>
                  </div>
                </div>
              ) : (
                <AnimatePresence>
                  {filteredMessages.map((message, index) => {
                    const isNewDay = index === 0 ||
                      new Date(message.timestamp).toDateString() !== new Date(filteredMessages[index - 1].timestamp).toDateString();
                    const isLastAi = message.sender === "ai" && index === filteredMessages.length - 1;
                    return (
                      <div key={message.id}>
                        {/* Date separator */}
                        {isNewDay && (
                          <div className="flex items-center gap-3 my-2">
                            <div className="flex-1 h-px bg-border/60" />
                            <span className="text-[11px] text-muted-foreground/70 font-medium px-2">
                              {formatDateSeparator(message.timestamp)}
                            </span>
                            <div className="flex-1 h-px bg-border/60" />
                          </div>
                        )}
                        <motion.div
                          initial={{ opacity: 0, y: 20, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.3 }}
                          className="group"
                        >
                          {message.sender === "ai" ? (
                            <div className="flex gap-3 items-start">
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 200 }}
                                className="mm-avatar mm-avatar--ai flex-shrink-0"
                              >
                                <img src="/image6.png" alt="AI companion" className="h-4 w-4 object-cover" />
                              </motion.div>
                              <div className="flex-1 space-y-1.5">
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
                                  {isAvatarVisible && transcribingMsgId === message.id ? (
                                    <div className="mm-bubble mm-bubble--ai min-h-[2.5rem]">
                                      <TypewriterText text={message.content} speed={350} onComplete={() => setTranscribingMsgId(null)} className="text-text-primary" />
                                    </div>
                                  ) : (
                                    <div className="mm-bubble mm-bubble--ai">
                                      <MessageRenderer content={message.content} />
                                    </div>
                                  )}
                                </motion.div>
                                {/* Quick-reply chips under last AI message */}
                                {isLastAi && (
                                  <QuickReplies
                                    suggestions={getQuickReplies(message.content)}
                                    onSelect={(text) => handleSendMessage(text)}
                                    visible={!isLoading}
                                  />
                                )}
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0 }} whileHover={{ opacity: 1 }} className="flex items-center gap-2 transition-opacity">
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-background hover:scale-110 transition-all" onClick={() => copyMessage(message.content)}>
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-background hover:scale-110 transition-all">
                                    <ThumbsUp className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-danger/10 hover:text-danger hover:scale-110 transition-all">
                                    <ThumbsDown className="h-3 w-3" />
                                  </Button>
                                  <span className="text-xs text-text-secondary ml-2">
                                    {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </motion.div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-3 justify-end items-start">
                              <div className="flex-1 flex flex-col items-end">
                                <motion.div initial={{ scale: 0.95, opacity: 0, x: 12 }} animate={{ scale: 1, opacity: 1, x: 0 }} className="mm-bubble mm-bubble--user">
                                  <span className="mm-user-text">{message.content}</span>
                                </motion.div>
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0 }} whileHover={{ opacity: 1 }} className="flex items-center justify-end gap-2 mt-1 transition-opacity">
                                  <span className="text-xs text-text-secondary opacity-70">
                                    {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-background hover:scale-110 transition-all" onClick={() => copyMessage(message.content)}>
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </motion.div>
                              </div>
                              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }} className="mm-avatar mm-avatar--user flex-shrink-0">
                                {userAvatarUrl ? (
                                  <img src={userAvatarUrl} alt={userDisplayName} className="h-4 w-4 rounded-full object-cover" />
                                ) : (
                                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white">
                                    {userInitial}
                                  </span>
                                )}
                              </motion.div>
                            </div>
                          )}
                        </motion.div>
                      </div>
                    );
                  })}
                </AnimatePresence>
              )}

              {/* Typing Indicator */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex gap-3 items-start"
                >
                  <div className="mm-avatar mm-avatar--ai flex-shrink-0">
                    <img src="/image6.png" alt="AI companion" className="h-4 w-4 object-cover" />
                  </div>
                  <div className="mm-bubble mm-bubble--ai min-w-[220px] py-3 px-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] text-text-secondary">{bubbleStatusText}</p>
                      <span className="text-[10px] font-medium text-primary/80">breathing space</span>
                    </div>
                    <div className="mt-2.5 space-y-2">
                      <div className="h-1.5 overflow-hidden rounded-full bg-primary/10">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-primary/40 via-primary to-primary/50"
                          animate={{
                            width: `${Math.max(12, loadingProgress)}%`,
                            opacity: [0.7, 1, 0.7],
                          }}
                          transition={{
                            width: { duration: 0.35, ease: "easeOut" },
                            opacity: { duration: 2.2, repeat: Infinity, ease: "easeInOut" },
                          }}
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <motion.div
                          className="h-2.5 w-2.5 rounded-full bg-primary/55"
                          animate={{ scale: [1, 1.35, 1], opacity: [0.45, 0.85, 0.45] }}
                          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 0 }}
                        />
                        <motion.div
                          className="h-2.5 w-2.5 rounded-full bg-primary/45"
                          animate={{ scale: [1, 1.28, 1], opacity: [0.35, 0.72, 0.35] }}
                          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 0.25 }}
                        />
                        <motion.div
                          className="h-2.5 w-2.5 rounded-full bg-primary/35"
                          animate={{ scale: [1, 1.2, 1], opacity: [0.28, 0.6, 0.28] }}
                          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Scroll-to-bottom floating button */}
            <AnimatePresence>
              {showScrollBtn && (
                <motion.button
                  key="scroll-btn"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={scrollToBottom}
                  className="fixed bottom-24 right-6 z-30 w-10 h-10 rounded-full bg-primary/90 text-white shadow-lg flex items-center justify-center hover:bg-primary transition-colors backdrop-blur-sm"
                >
                  <ChevronDown className="h-4 w-4" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
        {/* Enhanced Input Area with Glassmorphism */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="border-t border-border bg-surface/80 backdrop-blur-xl p-4 shadow-theme"
        >
          <div className="max-w-4xl mx-auto">
            <div className="relative group">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Message MindMitra..."
                className="pr-20 py-4 text-sm rounded-2xl border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/20 bg-crushed-silk text-text-primary transition-all duration-300 shadow-theme focus:shadow-theme-lg"
                disabled={isLoading}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`h-9 w-9 p-0 rounded-full transition-all duration-300 ${isRecording
                      ? 'text-danger bg-danger/10 hover:bg-danger/20 voice-recording-active'
                      : 'hover:bg-background'
                      }`}
                    onClick={handleVoiceInput}
                    disabled={isProcessing || isLoading}
                    aria-label={isRecording ? 'Stop recording' : 'Start voice recording'}
                  >
                    {isProcessing ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    ) : (
                      <motion.div
                        animate={isRecording ? { scale: [1, 1.2, 1] } : {}}
                        transition={{ duration: 1, repeat: isRecording ? Infinity : 0 }}
                      >
                        <Mic className="h-4 w-4" />
                      </motion.div>
                    )}
                  </Button>
                </motion.div>
                <motion.div
                  animate={justSent ? { scale: [1, 1.22, 0.95, 1], rotate: [0, 12, -6, 0] } : {}}
                  transition={{ type: "spring", stiffness: 400, damping: 14 }}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Button
                    onClick={() => handleSendMessage()}
                    disabled={!inputValue.trim() || isLoading}
                    className="bg-gradient-to-br from-primary to-[hsl(168,48%,34%)] hover:from-[hsl(188,55%,32%)] hover:to-[hsl(168,52%,28%)] text-white h-9 w-9 p-0 rounded-full shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </motion.div>
              </div>

              {/* Character count indicator */}
              {inputValue.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute -bottom-6 right-2 text-xs text-text-secondary"
                >
                  {inputValue.length} characters
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ChatGPTInterface;
