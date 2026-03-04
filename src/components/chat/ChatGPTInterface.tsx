import { useState, useEffect, useRef } from "react";
import { Send, Mic, Bot, User, Plus, Search, MessageSquare, Settings, Download, MoreVertical, Copy, ThumbsUp, ThumbsDown, Menu, Home, Trash2, Edit3, PanelLeftClose, PanelLeftOpen, Sparkles, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { Avatar } from "@radix-ui/react-avatar";
import TalkingHeadAvatar from "./TalkingHeadAvatar"
import { useChat } from "../../hooks/useChat"
import { motion, AnimatePresence } from "framer-motion"
import MessageRenderer from "./MessageRenderer"
import { jsPDF } from "jspdf";

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

const suggestedPrompts = [
  "Help me understand my personality type",
  "I'm feeling anxious, what can I do?",
  "Can you analyze my mood patterns?",
  "What are some stress management techniques?",
  "Tell me about different types of therapy",
  "How can I improve my mental wellness?",
];

const quickCategories = [
  { label: "Mental Health", icon: "🧠", color: "bg-blue-100 text-blue-800" },
  { label: "Personality", icon: "🎭", color: "bg-purple-100 text-purple-800" },
  { label: "Stress Relief", icon: "🌿", color: "bg-green-100 text-green-800" },
  { label: "Relationships", icon: "💖", color: "bg-pink-100 text-pink-800" },
  { label: "Self-Care", icon: "✨", color: "bg-yellow-100 text-yellow-800" },
  { label: "Therapy", icon: "💬", color: "bg-indigo-100 text-indigo-800" },
];

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

const ChatGPTInterface = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [recentChats, setRecentChats] = useState<Array<{ id: string, title: string, created_at: string, messageCount: number }>>([]);
  const [transcribingMsgId, setTranscribingMsgId] = useState<string | null>(null);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const { user } = useAuth();
  const { settings } = useSettings();
  const { toast } = useToast();
  const { isRecording, isProcessing, toggleRecording, currentTranscript } = useVoiceRecording();
  const [voiceTempMsgId, setVoiceTempMsgId] = useState<string | null>(null);
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const voiceSilenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTranscriptRef = useRef('');
  const isAutoStoppingRef = useRef(false);
  const { isAvatarVisible, toggleAvatar, closeAvatar, addAvatarMessage, clearAvatarMessages, message: avatarCurrentMessage } = useChat();

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
        await handleSendMessage(result.transcript);
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

        // Set first user message as preview
        if (msg.role === 'user' && !session.firstUserMessage) {
          session.firstUserMessage = msg.content;
        }
      });

      // Convert to RecentChat array
      const chatList = Array.from(sessionMap.values())
        .filter(session => session.messageCount > 0) // Only show sessions with messages
        .map(session => ({
          id: session.id,
          title: session.firstUserMessage ?
            (session.firstUserMessage.substring(0, 50) + (session.firstUserMessage.length > 50 ? '...' : '')) :
            'New Chat',
          created_at: session.lastActivity,
          messageCount: session.messageCount
        }))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20); // Show latest 20 chats

      console.log('✅ Processed chat sessions:', chatList.length);
      setRecentChats(chatList);

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

      const response = await fetch(`${backendUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          user_message: textToSend,
          session_id: sessionIdToUse,
          voice_analysis: null,  // Can be extended for voice features
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

      const data = await response.json();
      console.log('📡 Backend response:', data);

      if (!data || !data.message) {
        throw new Error('Invalid response from backend');
      }

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: data.message || "I apologize, but I'm having trouble responding right now. Please try again.",
        sender: "ai",
        timestamp: new Date(),
      };

      console.log(`AI Response: ${aiResponse.content}`);

      // Mark for real-time transcription if avatar is visible
      if (isAvatarVisible) {
        setTranscribingMsgId(aiResponse.id);
      }

      // ✅ Always queue message - avatar will play when opened
      console.log('🎭 [Chat] Queueing AI response for avatar (will play when opened)');
      console.log('🎭 [Chat] Backend data contains:', {
        hasMessage: !!data.message,
        hasAudio: !!data.audio,
        hasLipsync: !!data.lipsync,
        animation: data.animation,
        facialExpression: data.facial_expression
      });
      addAvatarMessage(data); // Pass full backend response with audio/lipsync

      // Only add AI response if we're still on the same session
      const currentSession = localStorage.getItem('currentChatSession');
      if (currentSession === sessionIdToUse) {
        setMessages(prev => [...prev, aiResponse]);
      }

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

  return (
    <div className="flex h-screen bg-background text-text-primary transition-colors duration-300">
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
            className="w-full h-12 rounded-2xl bg-[#0f172a] hover:bg-[#1e293b] border-0 text-white justify-start gap-2 text-sm font-semibold shadow-theme hover:shadow-theme-lg transition-all duration-300"
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

            {/* Recent Chats Section with Animations */}
            <div className="pt-1 pb-1">
              <div className="flex items-center justify-between px-1 mb-2">
                <h3 className="text-sm font-semibold text-primary/80 uppercase tracking-wider">
                  Recent Chats
                </h3>
                {(loadingChats || loadingSession) && (
                  <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                )}
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                {recentChats.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="px-3 py-2 text-sm text-text-secondary italic"
                  >
                    No recent chats
                  </motion.div>
                ) : (
                  <AnimatePresence>
                    {recentChats.map((chat, index) => (
                      <motion.div
                        key={chat.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Button
                          variant="ghost"
                          disabled={loadingSession}
                          className={`w-full h-auto rounded-2xl text-left p-3 transition-all duration-300 group relative border ${currentSessionId === chat.id
                            ? 'bg-background/80 border-primary/45 text-text-primary shadow-theme'
                            : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border hover:bg-background/50'
                            } ${loadingSession ? 'opacity-50 cursor-not-allowed' : ''}`}
                          onClick={() => selectRecentChat(chat.id)}
                        >
                          <div className="flex items-start gap-2 w-full">
                            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <motion.div
                                animate={{
                                  scale: currentSessionId === chat.id ? [1, 1.2, 1] : 1,
                                }}
                                transition={{ duration: 0.3 }}
                                className={`w-2.5 h-2.5 rounded-full ${currentSessionId === chat.id ? 'bg-success shadow-theme' : 'bg-text-secondary/80'
                                  }`}
                              ></motion.div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate leading-tight text-sm font-medium">
                                {chat.title}
                              </p>
                              <p className="text-xs text-text-secondary mt-0.5">
                                {chat.messageCount || 0} messages • {new Date(chat.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </Button>
                      </motion.div>
                    ))}
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
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-theme">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-xl font-bold text-text-primary">MindMitra</h1>
            </div>
            {isLoading && (
              <Badge variant="secondary" className="animate-pulse bg-surface text-text-primary border border-border">
                <motion.span
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  Thinking...
                </motion.span>
              </Badge>
            )}
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
              <TalkingHeadAvatar />
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
          <div className="flex-1 overflow-y-scroll bg-background transition-colors duration-300">
            <ScrollArea className="h-full">
              <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                <AnimatePresence>
                  {filteredMessages.map((message, index) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
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
                            <Bot className="h-4 w-4" />
                          </motion.div>
                          <div className="flex-1 space-y-2">
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.1 }}
                            >
                              {isAvatarVisible && transcribingMsgId === message.id ? (
                                <div className="mm-bubble mm-bubble--ai min-h-[2.5rem]">
                                  <TypewriterText
                                    text={message.content}
                                    speed={350}
                                    onComplete={() => setTranscribingMsgId(null)}
                                    className="text-text-primary"
                                  />
                                </div>
                              ) : (
                                <div className="mm-bubble mm-bubble--ai">
                                  <MessageRenderer content={message.content} />
                                </div>
                              )}
                            </motion.div>
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 0 }}
                              whileHover={{ opacity: 1 }}
                              className="flex items-center gap-2 transition-opacity"
                            >
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 hover:bg-background hover:scale-110 transition-all"
                                onClick={() => copyMessage(message.content)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-background hover:scale-110 transition-all">
                                <ThumbsUp className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-danger/10 hover:text-danger hover:scale-110 transition-all">
                                <ThumbsDown className="h-3 w-3" />
                              </Button>
                              <span className="text-xs text-text-secondary ml-2">
                                {message.timestamp.toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </motion.div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-3 justify-end items-start">
                          <div className="flex-1 flex flex-col items-end">
                            <motion.div
                              initial={{ scale: 0.95, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="mm-bubble mm-bubble--user"
                            >
                              <span className="mm-user-text">{message.content}</span>
                            </motion.div>
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 0 }}
                              whileHover={{ opacity: 1 }}
                              className="flex items-center justify-end gap-2 mt-1 transition-opacity"
                            >
                              <span className="text-xs text-text-secondary opacity-70">
                                {message.timestamp.toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 hover:bg-background hover:scale-110 transition-all"
                                onClick={() => copyMessage(message.content)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </motion.div>
                          </div>
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200 }}
                            className="mm-avatar mm-avatar--user flex-shrink-0"
                          >
                            <User className="h-4 w-4" />
                          </motion.div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Typing Indicator */}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex gap-3 items-start"
                  >
                    <div className="mm-avatar mm-avatar--ai flex-shrink-0">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="mm-bubble mm-bubble--ai py-3 px-5">
                      <div className="flex gap-1">
                        <motion.div
                          animate={{ y: [0, -8, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                          className="w-2 h-2 bg-primary rounded-full"
                        />
                        <motion.div
                          animate={{ y: [0, -8, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                          className="w-2 h-2 bg-primary rounded-full"
                        />
                        <motion.div
                          animate={{ y: [0, -8, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                          className="w-2 h-2 bg-primary rounded-full"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
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
                      ? 'text-danger bg-danger/10 hover:bg-danger/20 shadow-theme'
                      : 'hover:bg-background'
                      }`}
                    onClick={handleVoiceInput}
                    disabled={isProcessing || isLoading}
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
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Button
                    onClick={() => handleSendMessage()}
                    disabled={!inputValue.trim() || isLoading}
                    className="bg-primary hover:bg-secondary text-white h-9 w-9 p-0 rounded-full shadow-theme hover:shadow-theme-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <motion.div
                      initial={{ rotate: 0 }}
                      whileHover={{ rotate: 45 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Send className="h-4 w-4" />
                    </motion.div>
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
