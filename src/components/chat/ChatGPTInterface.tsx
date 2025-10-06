import { useState, useEffect, useRef } from "react";
import { Send, Mic, Bot, User, Plus, Search, MessageSquare, Settings, Download, MoreVertical, Copy, ThumbsUp, ThumbsDown, Menu, Home, Trash2, Edit3, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { Avatar } from "@radix-ui/react-avatar";
import GirlAvatar from "./GirlAvatar"
import {useChat} from "../../hooks/useChat"

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

const ChatGPTInterface = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAvatarVisible, setIsAvatarVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [recentChats, setRecentChats] = useState<Array<{id: string, title: string, created_at: string, messageCount: number}>>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { isRecording, isProcessing, toggleRecording, currentTranscript } = useVoiceRecording();
  const [voiceTempMsgId, setVoiceTempMsgId] = useState<string|null>(null);
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {chat} = useChat();

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
  }, [user]);

  // Refresh recent chats periodically to catch any new messages
  useEffect(() => {
    if (user) {
      const interval = setInterval(() => {
        loadRecentChats();
      }, 10000); // Refresh every 10 seconds

      return () => clearInterval(interval);
    }
  }, [user]);

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

    console.log('🚀 CHAT DEBUG: Sending message via ChatGPTInterface...');
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
      console.log('📡 Calling enhanced-chat-context function...');

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

      // Save the user message first
      await saveMessage(userMessage, sessionIdToUse);

      // Call the enhanced-chat-context function
      const { data, error } = await supabase.functions.invoke('enhanced-chat-context', {
        body: {
          message: textToSend,
          sessionId: sessionIdToUse
        }
      });

      console.log('📡 Function response:', { data, error });

      if (error) {
        console.error('❌ Function error:', error);
        throw error;
      }

      if (!data || !data.message) {
        throw new Error('Invalid response from function');
      }

      // Update session ID if it was generated by the edge function
      if (data.sessionId && data.sessionId !== currentSessionId) {
        setCurrentSessionId(data.sessionId);
        localStorage.setItem('currentChatSession', data.sessionId);
        console.log('💾 Updated session ID from server:', data.sessionId);
      }

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: data.message || "I apologize, but I'm having trouble responding right now. Please try again.",
        sender: "ai",
        timestamp: new Date(),
      };

      await chat(aiResponse.content)
      // Only add AI response if we're still on the same session
      // Insert Voice Piepline here
      const currentSession = localStorage.getItem('currentChatSession');
      if (currentSession === sessionIdToUse || currentSession === data.sessionId) {
        setMessages(prev => [...prev, aiResponse]);
      }

      // Log debug info if available
      if (data.debug) {
        console.log('🔍 Debug info from enhanced function:', data.debug);
        console.log('🎮 Activities found:', data.debug.activitiesFound);
        console.log('🧠 Has game memory:', data.debug.hasGameMemory);
      }

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
        // Stop recording and process result
        const result = await toggleRecording(currentSessionId, voiceTempMsgId || undefined);
        console.log('🎤 [UI] Received result from stopping recording:', result);
        if (voiceTempMsgId) {
          setMessages(msgs => msgs.filter(m => m.id !== voiceTempMsgId));
          setVoiceTempMsgId(null);
        }
        if (result && result.transcript) {
          await handleSendMessage(result.transcript);
        }
      } else {
        // Start recording
        console.log('🎤 [UI] Starting recording...');
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
  // Update temporary voice message with live transcript
  useEffect(() => {
    if (isRecording && voiceTempMsgId && currentTranscript) {
      setMessages(msgs => msgs.map(m => m.id === voiceTempMsgId ? { ...m, content: currentTranscript || '🎤 Recording...' } : m));
    }
  }, [isRecording, currentTranscript, voiceTempMsgId]);
    } catch (error) {
      console.error('❌ [UI] Voice input error:', error);
    }
  };  const handleKeyPress = (e: React.KeyboardEvent) => {
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
    
    // Immediately refresh recent chats to show new session
    await loadRecentChats();
  };

  if (!user) {
    return null; // Will redirect to auth
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* ChatGPT-style Dark Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-0' : 'w-64'} transition-all duration-300 bg-gray-900 text-white flex flex-col border-r border-gray-700 overflow-hidden`}>
        {/* Sidebar Header */}
        <div className="p-3 border-b border-gray-700">
          <Button
            onClick={startNewChat}
            className="w-full bg-transparent hover:bg-gray-800 border border-gray-600 text-white justify-start gap-2 text-sm"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
            New chat
          </Button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-gray-500 text-sm"
            />
          </div>
        </div>

        {/* Navigation & Content */}
        <div className="flex-1 overflow-hidden">
          <div className="p-2 space-y-1 h-full flex flex-col">
            {/* Navigation Items */}
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-300 hover:bg-gray-800 hover:text-white text-sm flex-shrink-0"
              onClick={() => navigate('/')}
            >
              <Home className="h-4 w-4 mr-3" />
              Home
            </Button>
            
            {/* Recent Chats Section */}
            <div className="pt-3 pb-1 flex-shrink-0">
              <div className="flex items-center justify-between px-3 mb-2">
                <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                  Recent Chats
                </h3>
                {(loadingChats || loadingSession) && (
                  <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                )}
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {recentChats.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-500 italic">
                    No recent chats
                  </div>
                ) : (
                  recentChats.map((chat) => (
                    <Button
                      key={chat.id}
                      variant="ghost"
                      disabled={loadingSession}
                      className={`w-full text-left p-2 transition-colors text-xs hover:bg-gray-800 group relative border border-transparent ${
                        currentSessionId === chat.id ? 'bg-gray-800 border-gray-600 text-white' : 'text-gray-300 hover:text-white hover:border-gray-700'
                      } ${loadingSession ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => selectRecentChat(chat.id)}
                    >
                      <div className="flex items-start gap-2 w-full">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${
                          currentSessionId === chat.id ? 'bg-green-500' : 'bg-gray-500'
                        }`}></div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate leading-tight font-medium">
                            {chat.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {chat.messageCount || 0} messages • {new Date(chat.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </Button>
                  ))
                )}
              </div>
            </div>
            
            {/* Quick Topics Section */}
            <div className="pt-1 pb-1 flex-shrink-0">
              <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider px-3 mb-1">
                Quick Topics
              </h3>
              <div className="space-y-0">
                {quickCategories.map((category) => (
                  <Button
                    key={category.label}
                    variant="ghost"
                    className="w-full justify-start text-gray-300 hover:bg-gray-800 hover:text-white text-sm py-1 h-7"
                    onClick={() => handleSendMessage(`Tell me about ${category.label.toLowerCase()}`)}
                  >
                    <span className="mr-2 text-sm">{category.icon}</span>
                    {category.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Suggested Prompts Section */}
            <div className="pt-1 pb-1 flex-shrink-0">
              <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider px-3 mb-1">
                Suggested
              </h3>
              <div className="space-y-0">
                {suggestedPrompts.slice(0, 3).map((prompt, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    className="w-full justify-start text-gray-300 hover:bg-gray-800 hover:text-white text-xs p-2 h-auto leading-tight"
                    onClick={() => handleSendMessage(prompt)}
                  >
                    <span className="text-left line-clamp-2">
                      {prompt.length > 35 ? `${prompt.substring(0, 35)}...` : prompt}
                    </span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Spacer to push footer to bottom */}
            <div className="flex-1"></div>

            {/* Footer */}
            <div className="flex-shrink-0 border-t border-gray-700 pt-2">
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                    <User className="h-3 w-3 text-white" />
                  </div>
                  <span className="text-sm text-gray-300 truncate">
                    {user?.email?.split('@')[0] || 'User'}
                  </span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-400 hover:text-white">
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
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="border-b bg-white dark:bg-gray-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              >
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">MindMate</h1>
            {isLoading && (
              <Badge variant="secondary" className="animate-pulse">
                Thinking...
              </Badge>
            )}
          </div>
          <button onClick={()=>setIsAvatarVisible((state)=>!state)}>
            Toggle Avtar
          </button>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => toast({ title: "Feature coming soon!", description: "Export functionality will be available soon." })}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Chat
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Messages Area */}
        <div className={`grid grid-rows-1 h-[80%]  ${isAvatarVisible?'grid-cols-2':'grid-cols-1'}`}>
        {isAvatarVisible && <GirlAvatar/>}
        <div className="flex-1 overflow-y-scroll bg-white dark:bg-gray-800">
          <ScrollArea className="h-full">
            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
              {filteredMessages.map((message) => (
                <div key={message.id} className="group">
                  {message.sender === "ai" ? (
                    <div className="flex gap-4 items-start">
                      <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="text-sm font-bold text-gray-900 dark:text-white">MindMate</div>
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <div 
                            className="text-sm leading-snug text-gray-900 dark:text-gray-100 font-medium"
                            dangerouslySetInnerHTML={{
                              __html: message.content
                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                                .replace(/`(.*?)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs">$1</code>')
                                .replace(/^- (.+)$/gm, '<li class="mb-1">$1</li>')
                                .replace(/(<li.*<\/li>)/s, '<ul class="list-disc list-inside space-y-0 ml-4 my-2">$1</ul>')
                                .replace(/\n\n/g, '<br><br>')
                                .replace(/\n/g, '<br>')
                            }}
                          />
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
                            onClick={() => copyMessage(message.content)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700">
                            <ThumbsUp className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700">
                            <ThumbsDown className="h-3 w-3" />
                          </Button>
                          <span className="text-xs text-gray-500 ml-2">
                            {message.timestamp.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-4 justify-end items-start">
                      <div className="flex-1 flex justify-end">
                        <div className="max-w-xs sm:max-w-md lg:max-w-lg xl:max-w-xl">
                          <div className="bg-blue-600 text-white rounded-2xl px-4 py-3 inline-block">
                            <p className="text-sm font-medium whitespace-pre-wrap break-words">{message.content}</p>
                          </div>
                          <div className="flex items-center justify-end gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-xs text-gray-500">
                              {message.timestamp.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
                              onClick={() => copyMessage(message.content)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-white" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>
        </div>
        {/* Input Area */}
        <div className="border-t bg-white dark:bg-gray-800 p-4">
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Message MindMate..."
                className="pr-20 py-3 text-sm rounded-2xl border-2 border-gray-300 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 dark:border-gray-500 dark:text-white"
                disabled={isLoading}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className={`h-8 w-8 p-0 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 ${
                    isRecording ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : ''
                  }`}
                  onClick={handleVoiceInput}
                  disabled={isProcessing || isLoading}
                >
                  {isProcessing ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  ) : (
                    <Mic className={`h-4 w-4 ${isRecording ? 'animate-pulse' : ''}`} />
                  )}
                </Button>
                <Button
                  onClick={() => handleSendMessage()}
                  disabled={!inputValue.trim() || isLoading}
                  className="bg-blue-400 hover:bg-blue-500 text-white h-8 w-8 p-0 rounded-full"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatGPTInterface;
