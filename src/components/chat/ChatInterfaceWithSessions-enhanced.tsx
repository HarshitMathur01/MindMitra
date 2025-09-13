// -- filepath: /Users/harshitmathur/Desktop/MindMate/psyche-prompt-play/src/components/chat/ChatInterfaceWithSessions.tsx

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Plus, MessageCircle, Bot, User } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
  session_id: string;
  user_id: string;
  metadata?: any;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load user's chat sessions when component mounts
  useEffect(() => {
    if (user) {
      loadChatSessions();
    }
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

  const sendMessage = async () => {
    if (!inputMessage.trim() || !user || !currentSession) return;

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      content: inputMessage,
      role: 'user',
      created_at: new Date().toISOString(),
      session_id: currentSession.id,
      user_id: user.id
    };

    // Immediately add user message to UI
    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      // Call the enhanced-chat-context edge function
      const { data, error } = await supabase.functions.invoke('enhanced-chat-context', {
        body: {
          user_message: currentInput,
          session_id: currentSession.id,
          user_id: user.id
        }
      });

      if (error) throw error;

      // Add AI response to messages
      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        content: data.message || 'I apologize, but I encountered an issue processing your request.',
        role: 'assistant',
        created_at: new Date().toISOString(),
        session_id: currentSession.id,
        user_id: user.id,
        metadata: data.session_insights || {}
      };

      setMessages(prev => [...prev, aiMessage]);
      
      // Update session title if it's the first message
      if (messages.length === 0) {
        const updatedSession = {
          ...currentSession,
          title: currentInput.slice(0, 50) + (currentInput.length > 50 ? '...' : ''),
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
      };      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
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
      className="flex items-center space-x-2 p-4 bg-muted/50 rounded-lg"
    >
      <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-primary/60 rounded-full animate-pulse"></div>
        <div className="w-2 h-2 bg-primary/60 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
        <div className="w-2 h-2 bg-primary/60 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
      </div>
      <span className="text-sm text-muted-foreground">MindMate is thinking...</span>
    </motion.div>
  );

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Sidebar */}
      <motion.div 
        className="w-80 bg-white/80 backdrop-blur-sm border-r border-gray-200 flex flex-col"
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <Button 
            onClick={createNewSession}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white transition-all duration-300 transform hover:scale-105"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </div>

        {/* Sessions List */}
        <ScrollArea className="flex-1 custom-scrollbar">
          <div className="p-2 space-y-2">
            <AnimatePresence>
              {sessions.map((session, index) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <Card 
                    className={`p-3 cursor-pointer transition-all duration-300 hover:shadow-md ${
                      currentSession?.id === session.id 
                        ? 'bg-primary/10 border-primary/30 shadow-sm' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setCurrentSession(session)}
                  >
                    <div className="flex items-center space-x-3">
                      <MessageCircle className="h-4 w-4 text-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{session.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(session.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </motion.div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentSession ? (
          <>
            {/* Chat Header */}
            <motion.div 
              className="p-4 bg-white/80 backdrop-blur-sm border-b border-gray-200"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <h2 className="text-xl font-semibold text-gradient">{currentSession.title}</h2>
              <p className="text-sm text-muted-foreground">
                Your AI therapy companion • Safe & Confidential
              </p>
            </motion.div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4 custom-scrollbar">
              <div className="space-y-4 max-w-4xl mx-auto">
                <AnimatePresence>
                  {messages.map((message, index) => (
                    <motion.div
                      key={message.id}
                      variants={messageVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={{ duration: 0.4, delay: index * 0.05 }}
                      className={`flex items-start space-x-3 ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {message.role === 'assistant' && (
                        <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      
                      <div className={`max-w-[70%] ${
                        message.role === 'user' ? 'order-first' : ''
                      }`}>
                        <Card className={`p-4 ${
                          message.role === 'user' 
                            ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white ml-auto' 
                            : 'bg-white/70 backdrop-blur-sm border border-gray-200'
                        } message-slide-in`}>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {message.content}
                          </p>
                        </Card>
                        <p className={`text-xs text-muted-foreground mt-1 ${
                          message.role === 'user' ? 'text-right' : 'text-left'
                        }`}>
                          {new Date(message.created_at).toLocaleTimeString()}
                        </p>
                      </div>

                      {message.role === 'user' && (
                        <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                          <User className="h-4 w-4 text-blue-600" />
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

            {/* Input Area */}
            <motion.div 
              className="p-4 bg-white/80 backdrop-blur-sm border-t border-gray-200"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <div className="max-w-4xl mx-auto">
                <div className="flex space-x-3">
                  <Input
                    ref={inputRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Share what's on your mind... I'm here to listen and support you."
                    className="flex-1 p-4 text-base border-2 border-gray-200 focus:border-primary/50 rounded-full bg-white/70 backdrop-blur-sm"
                    disabled={isLoading}
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={isLoading || !inputMessage.trim()}
                    className="px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-full transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Your conversations are private and secure. MindMate uses end-to-end encryption.
                </p>
              </div>
            </motion.div>
          </>
        ) : (
          /* Welcome Screen */
          <motion.div 
            className="flex-1 flex items-center justify-center p-8"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            <div className="text-center max-w-md">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center breathing-pulse">
                <MessageCircle className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gradient mb-4">Welcome to MindMate</h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Start a conversation with your AI therapy companion. Share your thoughts, feelings, and experiences in a safe, supportive environment.
              </p>
              <Button 
                onClick={createNewSession}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8 py-3 rounded-full transition-all duration-300 transform hover:scale-105"
              >
                Start Your First Chat
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
