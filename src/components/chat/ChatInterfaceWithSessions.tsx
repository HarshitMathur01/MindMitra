// -- filepath: /Users/harshitmathur/MindMitra/src/components/chat/ChatInterfaceWithSessions.tsx

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { supabase } from '@/integrations/supabase/client';
// Card import removed — message bubbles use plain divs for full style control
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Plus, MessageCircle, Bot, User, Mic, MicOff, Volume2 } from 'lucide-react';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
  session_id: string;
  user_id: string;
  metadata?: Record<string, unknown>;
}

interface ChatSession {
  id: string;
  title: string;
  updated_at: string;
  created_at: string;
}

export function ChatInterfaceWithSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const { user } = useAuth();
  const { settings } = useSettings();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Voice recording hook with improved UX
  const {
    isRecording,
    isProcessing,
    lastVoiceInsights,
    currentTranscript,
    recordingDuration,
    startRecording,
    stopRecording,
    toggleRecording
  } = useVoiceRecording();

  // Load user's chat sessions when component mounts
  useEffect(() => {
    if (user) {
      loadChatSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Load messages when session changes
  useEffect(() => {
    if (currentSession) {
      loadSessionMessages(currentSession.id);
    }
  }, [currentSession]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatSessions = async () => {
    if (!user) return;

    try {
      // Get unique sessions from chat_messages table
      const { data: messagesData, error } = await supabase
        .from('chat_messages')
        .select('session_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group messages by session_id and create session objects
      const sessionMap = new Map<string, ChatSession>();

      (messagesData || []).forEach(msg => {
        if (msg.session_id && !sessionMap.has(msg.session_id)) {
          sessionMap.set(msg.session_id, {
            id: msg.session_id,
            title: 'Chat Session',
            created_at: msg.created_at,
            updated_at: msg.created_at
          });
        }
      });

      const formattedSessions: ChatSession[] = Array.from(sessionMap.values())
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

      setSessions(formattedSessions);

      // Auto-select first session if none selected
      if (!currentSession && formattedSessions.length > 0) {
        setCurrentSession(formattedSessions[0]);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const loadSessionMessages = async (sessionId: string) => {
    try {
      const { data: messagesData, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formattedMessages: Message[] = (messagesData || []).map(msg => ({
        id: msg.id || `msg-${Date.now()}-${Math.random()}`,
        content: msg.content,
        role: (msg.role || msg.sender) as 'user' | 'assistant',
        created_at: msg.created_at,
        session_id: msg.session_id || sessionId,
        user_id: msg.user_id,
        metadata: undefined
      }));

      setMessages(formattedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const createNewSession = async () => {
    if (!user) return;

    try {
      // Create a new session by generating a UUID
      const newSessionId = crypto.randomUUID();
      const now = new Date().toISOString();

      const newSession: ChatSession = {
        id: newSessionId,
        title: 'New Chat',
        created_at: now,
        updated_at: now
      };

      setSessions(prev => [newSession, ...prev]);
      setCurrentSession(newSession);
      setMessages([]);

      // Focus input after creating new session
      setTimeout(() => inputRef.current?.focus(), 100);

    } catch (error) {
      console.error('Error creating new session:', error);
    }
  };

  const sendMessage = async (messageText?: string, voiceInsights?: unknown) => {
    const message = messageText || inputMessage.trim();
    if (!message || !user || !currentSession || isLoading) return;

    console.log('🚀 [CHAT] Starting message send process...');
    console.log('📝 [CHAT] Message text:', message);
    console.log('🎤 [CHAT] Voice insights provided:', !!voiceInsights);
    if (voiceInsights) {
      console.log('🔍 [CHAT] Voice analysis details:', voiceInsights);
    }

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      content: message,
      role: 'user',
      created_at: new Date().toISOString(),
      session_id: currentSession.id,
      user_id: user.id,
      metadata: voiceInsights ? { voice_analysis: voiceInsights } : undefined
    };

    // Immediately add user message to UI
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      console.log('📡 [CHAT] Calling enhanced-chat-context edge function...');

      // Call the enhanced-chat-context edge function with voice analysis
      const { data, error } = await supabase.functions.invoke('enhanced-chat-context', {
        body: {
          user_message: message,
          session_id: currentSession.id,
          user_id: user.id,
          voiceAnalysis: voiceInsights, // Pass voice analysis to edge function
          personality: settings?.companion_personality || settings?.avatar_personality || 'mitra',
          companion_name: settings?.companion_name || 'Mitra',
          language: settings?.language || 'english',
        }
      });

      if (error) {
        console.error('❌ [CHAT] Edge function error:', error);
        throw error;
      }

      console.log('✅ [CHAT] Edge function response received');
      console.log('📊 [CHAT] Response data:', data);

      // Add AI response to messages
      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        content: data.message || 'I apologize, but I encountered an issue processing your request.',
        role: 'assistant',
        created_at: new Date().toISOString(),
        session_id: currentSession.id,
        user_id: user.id,
        metadata: {
          ...data.session_insights,
          voice_aware: !!voiceInsights, // Flag to show this response considered voice
          processing_debug: data.debug || {}
        }
      };

      setMessages(prev => [...prev, aiMessage]);

      // Update session title if it's the first message
      if (messages.length === 0) {
        const updatedSession = {
          ...currentSession,
          title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
          updated_at: new Date().toISOString()
        };
        setCurrentSession(updatedSession);
        setSessions(prev => prev.map(s => s.id === currentSession.id ? updatedSession : s));
      }

    } catch (error) {
      console.error('Error sending message:', error);

      // Add error message
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        content: 'Sorry, I encountered an error processing your message. Please try again.',
        role: 'assistant',
        created_at: new Date().toISOString(),
        session_id: currentSession.id,
        user_id: user.id
      }; setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
      inputRef.current?.focus();
    }
  };

  // Voice message handler
  const handleVoiceMessage = async () => {
    if (!currentSession) {
      console.warn('🚫 [VOICE] No active session for voice recording');
      return;
    }

    if (isRecording) {
      console.log('🎤 [VOICE] Stopping voice recording...');
      // Stop recording and process
      const voiceResult = await stopRecording(
        currentSession.id,
        undefined, // messageId 
        true // enableVoiceAnalysis
      );

      if (voiceResult && voiceResult.transcript.trim()) {
        console.log('✅ [VOICE] Voice recording successful');
        console.log('📝 [VOICE] Transcript:', voiceResult.transcript);
        console.log('🧠 [VOICE] Analysis insights:', voiceResult.insights);

        // Send the enhanced message with voice insights
        await sendMessage(voiceResult.transcript, voiceResult.insights);
      } else {
        console.warn('❌ [VOICE] No valid transcript received');
      }
    } else {
      console.log('🎤 [VOICE] Starting voice recording...');
      await startRecording();
    }
  };

  const handleTextMessage = async () => {
    console.log('⌨️ [TEXT] Sending text message...');
    await sendMessage();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextMessage();
    }
  };

  // Message animation variants
  const messageVariants = {
    initial: { opacity: 0, y: 20, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -10, scale: 0.95 }
  };

  // Typing indicator component
  const TypingIndicator = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-start space-x-3"
    >
      {/* Bot avatar — teal gradient */ }
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-primary to-[hsl(168,45%,34%)] flex items-center justify-center shadow-sm">
        <Bot className="h-4 w-4 text-white" />
      </div>
      <div className="bg-surface shadow-sm border border-border border-l-2 border-l-primary/30 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2.5">
        <span className="text-[13px] text-muted-foreground italic">MindMitra is reflecting&hellip;</span>
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '160ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: '320ms' }} />
        </div>
      </div>
    </motion.div>
  );

  return (
    // ── Root shell — background + ambient depth blobs
    <div className="flex h-screen bg-background relative overflow-hidden">
      {/* Ambient depth: warm ivory + teal blobs give spatial warmth without distraction */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-[-6rem] right-[-4rem] w-80 h-80 rounded-full bg-primary/6 blur-3xl" />
        <div className="absolute bottom-[-4rem] left-[-3rem] w-72 h-72 rounded-full bg-[hsl(38,55%,80%)]/20 blur-3xl" />
      </div>

      {/* ── Sidebar — elevation layer 1 */}
      <motion.div
        className="relative z-10 w-72 bg-surface/95 backdrop-blur-md border-r border-border flex flex-col shadow-[2px_0_12px_hsl(188_30%_15%/0.05)]"
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-border">
          <Button
            onClick={createNewSession}
            className="w-full bg-gradient-to-r from-primary to-[hsl(168,48%,34%)] hover:from-[hsl(188,55%,32%)] hover:to-[hsl(168,52%,28%)] text-white shadow-sm hover:shadow-md transition-all duration-200 gap-2"
          >
            <Plus className="h-4 w-4" />
            New Conversation
          </Button>
        </div>

{/* Sessions list — compact list-item style, not card-per-card */}
        <ScrollArea className="flex-1 custom-scrollbar">
          <div className="py-2 px-2 space-y-0.5">
            {sessions.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8 px-4 leading-relaxed">
                No conversations yet.<br />Start one above.
              </p>
            )}
            <AnimatePresence>
              {sessions.map((session, index) => {
                const isActive = currentSession?.id === session.id;
                return (
                  <motion.button
                    key={session.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.25, delay: index * 0.04 }}
                    onClick={() => setCurrentSession(session)}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                      isActive
                        ? 'bg-primary/10 border-l-2 border-primary text-text-primary'
                        : 'border-l-2 border-transparent text-text-secondary hover:bg-crushed-silk hover:text-text-primary'
                    }`}
                  >
                    <MessageCircle className={`h-3.5 w-3.5 flex-shrink-0 ${ isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-primary/70' }`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] truncate leading-snug ${ isActive ? 'font-semibold' : 'font-medium' }`}>
                        {session.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {new Date(session.updated_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </motion.div>

      {/* ── Main Chat Column — elevation layer 0 (base) */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0">
        {currentSession ? (
          <>
            {/* Chat Header — slight elevation above messages */}
            <motion.div
              className="px-6 py-3.5 bg-surface/90 backdrop-blur-md border-b border-border flex items-center gap-3"
              initial={{ y: -16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              {/* Online indicator */}
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-[hsl(168,45%,34%)] flex items-center justify-center shadow-sm">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-surface" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-[15px] font-semibold text-text-primary truncate leading-tight">{currentSession.title}</h2>
                <p className="text-[12px] text-muted-foreground leading-tight">
                  MindMitra &bull; Safe &amp; Confidential
                </p>
              </div>
            </motion.div>

            {/* ── Messages Area — pure background so bubbles float cleanly */}
            <ScrollArea className="flex-1 custom-scrollbar">
              <div className="px-4 py-6 space-y-5 max-w-3xl mx-auto">
                {messages.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                      <MessageCircle className="h-5 w-5 text-primary/60" />
                    </div>
                    <p className="text-sm">Say hello to start your session.</p>
                  </div>
                )}
                <AnimatePresence initial={false}>
                  {messages.map((message, index) => (
                    <motion.div
                      key={message.id}
                      variants={messageVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.15) }}
                      className={`flex items-end gap-2.5 ${ message.role === 'user' ? 'justify-end' : 'justify-start' }`}
                    >
                      {/* ── AI avatar (left side) */}
                      {message.role === 'assistant' && (
                        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-primary to-[hsl(168,45%,34%)] flex items-center justify-center shadow-sm mb-1">
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                      )}

                      <div className={`flex flex-col gap-1 max-w-[72%] ${ message.role === 'user' ? 'items-end' : 'items-start' }`}>

                        {/* ── User bubble — deep teal gradient, confident ownership */}
                        {message.role === 'user' ? (
                          <div className="px-4 py-2.5 rounded-2xl rounded-br-sm bg-gradient-to-br from-[hsl(188,55%,30%)] to-[hsl(168,50%,27%)] text-white shadow-md message-slide-in">
                            <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
                          </div>
                        ) : (
                          // ── AI bubble — elevated surface, left accent border
                          <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-surface shadow-sm border border-border border-l-4 border-l-primary/25 message-slide-in">
                            <p className="text-[14px] text-text-primary leading-relaxed whitespace-pre-wrap">{message.content}</p>
                          </div>
                        )}

                        <p className="text-[11px] text-muted-foreground px-1">
                          {new Date(message.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      {/* ── User avatar (right side) — warm amber = human warmth */}
                      {message.role === 'user' && (
                        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-300 flex items-center justify-center shadow-sm mb-1">
                          <User className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Typing Indicator */}
                <AnimatePresence>
                  {isTyping && <TypingIndicator />}
                </AnimatePresence>

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* ── Input area — elevation layer 1, same as sidebar */}
            <motion.div
              className="px-4 py-3 bg-surface/95 backdrop-blur-md border-t border-border"
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <div className="max-w-3xl mx-auto space-y-2">

                {/* Voice Status Banners — shown above input so they don't crowd */}
                <AnimatePresence>
                  {isProcessing && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-primary/8 text-primary text-[13px] rounded-xl border border-primary/20"
                    >
                      <Volume2 className="w-3.5 h-3.5 animate-spin" />
                      Analysing your voice and generating insights&hellip;
                    </motion.div>
                  )}
                  {isRecording && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                      className="px-3 py-2 bg-[hsl(353_66%_97%)] text-[hsl(353_66%_40%)] text-[13px] rounded-xl border border-[hsl(353_66%_85%)] space-y-1"
                    >
                      <div className="flex items-center justify-center gap-2 font-medium">
                        <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
                        Recording &mdash; {recordingDuration}s &mdash; tap mic to stop
                        <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
                      </div>
                      {currentTranscript && (
                        <p className="text-[12px] opacity-75 italic text-center">&ldquo;{currentTranscript}&rdquo;</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Main input row */}
                <div className="flex items-center gap-2">

                  {/* Voice button — teal (primary), not blue */}
                  <button
                    onClick={handleVoiceMessage}
                    disabled={isProcessing || isLoading}
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center relative transition-all duration-200 ${
                      isRecording
                        ? 'bg-danger text-white animate-pulse shadow-md scale-110'
                        : 'bg-primary/10 text-primary hover:bg-primary hover:text-white shadow-sm hover:shadow-md hover:scale-105'
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                    title={isRecording ? `Stop (${recordingDuration}s)` : isProcessing ? 'Processing…' : 'Voice message'}
                  >
                    {isProcessing ? (
                      <Volume2 className="w-4 h-4 animate-spin" />
                    ) : isRecording ? (
                      <>
                        <MicOff className="w-4 h-4" />
                        {recordingDuration > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 bg-surface text-danger text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold border border-danger/30">
                            {recordingDuration}
                          </span>
                        )}
                      </>
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </button>

                  {/* Text input — warm background, clean rounded rectangle */}
                  <Input
                    ref={inputRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={
                      isRecording ? 'Listening…' :
                      isProcessing ? 'Processing voice…' :
                          "Share what's on your mind…"
                    }
                    disabled={isRecording || isProcessing}
                    className="flex-1 h-10 px-4 text-[14px] bg-background border border-border rounded-xl placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-colors disabled:opacity-60"
                  />

                  {/* Send button */}
                  <Button
                    onClick={handleTextMessage}
                    disabled={isLoading || !inputMessage.trim() || isRecording || isProcessing}
                    size="icon"
                    className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-[hsl(168,48%,34%)] hover:from-[hsl(188,55%,32%)] hover:to-[hsl(168,52%,28%)] text-white shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>

                {/* Voice-aware indicator */}
                {messages.some(msg => msg.metadata?.voice_aware) && (
                  <p className="text-[11px] text-primary/70 text-center">
                    🎤 Voice-enhanced mode active — your emotional tone is being considered
                  </p>
                )}

                <p className="text-[11px] text-muted-foreground/60 text-center">
                  End-to-end encrypted &bull; Private &bull; Confidential
                </p>
              </div>
            </motion.div>
          </>
        ) : (
          /* ── Welcome / empty state */
          <motion.div
            className="flex-1 flex items-center justify-center p-8"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center max-w-sm bg-surface/80 backdrop-blur-sm rounded-2xl p-10 shadow-sm border border-border">
              {/* Animated avatar circle */}
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary to-[hsl(168,48%,34%)] flex items-center justify-center shadow-md breathing-pulse">
                <MessageCircle className="h-9 w-9 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-text-primary mb-2">Welcome to MindMitra</h2>
              <p className="text-[14px] text-muted-foreground mb-8 leading-relaxed">
                A safe, confidential space to talk. Share whatever is on your mind — your AI companion is here to listen.
              </p>
              <Button
                onClick={createNewSession}
                className="bg-gradient-to-br from-primary to-[hsl(168,48%,34%)] hover:from-[hsl(188,55%,32%)] hover:to-[hsl(168,52%,28%)] text-white px-8 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105"
              >
                Begin a Conversation
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
