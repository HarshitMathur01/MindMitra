import { useState, useEffect } from "react";
import { Send, Mic, Bot, User, Plus, Search, MessageSquare, Settings, Download, MoreVertical, Copy, ThumbsUp, ThumbsDown } from "lucide-react";
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

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
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

const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const { isRecording, isProcessing, toggleRecording } = useVoiceRecording();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    loadMessages();
  }, [user, navigate]);

  const loadMessages = async () => {
    try {
      if (!user) return;

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const loadedMessages = data.map(msg => ({
          id: msg.id,
          content: msg.content,
          sender: msg.sender as "user" | "ai",
          timestamp: new Date(msg.created_at),
        }));
        setMessages(loadedMessages);
      } else {
        setMessages([{
          id: "welcome",
          content: "Welcome to your advanced MindMate chat! I'm here to provide deep psychological insights, help with mental health questions, and guide you through personalized exercises. What would you like to explore today?",
          sender: "ai",
          timestamp: new Date(),
        }]);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const saveMessage = async (message: Message) => {
    try {
      if (!user || message.id === "welcome") return;

      const { error } = await supabase
        .from('chat_messages')
        .insert({
          user_id: user.id,
          content: message.content,
          sender: message.sender,
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || inputValue;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: textToSend,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    await saveMessage(userMessage);
    
    setInputValue("");
    setIsLoading(true);

    try {
      const conversationHistory = messages.slice(-10);
      
      const { data, error } = await supabase.functions.invoke('chat-with-groq', {
        body: {
          message: textToSend,
          conversationHistory
        }
      });

      if (error) throw error;

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response || "I apologize, but I'm having trouble responding right now. Please try again.",
        sender: "ai",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiResponse]);
      await saveMessage(aiResponse);
    } catch (error) {
      console.error('Error sending message:', error);
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
      const transcribedText = await toggleRecording();
      if (transcribedText) {
        setInputValue(transcribedText);
      }
    } catch (error) {
      console.error('Error with voice input:', error);
      toast({
        title: "Voice input failed",
        description: "Please try again.",
        variant: "destructive",
      });
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

  const filteredMessages = messages.filter(message =>
    searchQuery === "" || 
    message.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startNewChat = () => {
    setMessages([{
      id: "welcome-new",
      content: "Starting a fresh conversation! What would you like to discuss today?",
      sender: "ai",
      timestamp: new Date(),
    }]);
    setSearchQuery("");
  };

  if (!user) {
    return null; // Will redirect to auth
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/')}>
                ← Back
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Advanced Chat</h1>
                  <p className="text-sm text-muted-foreground">AI Psychology Assistant</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={startNewChat}>
                <Plus className="h-4 w-4 mr-2" />
                New Chat
              </Button>
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
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)]">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Search */}
            <Card className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </Card>

            {/* Quick Categories */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Quick Topics</h3>
              <div className="grid grid-cols-2 gap-2">
                {quickCategories.map((category) => (
                  <Button
                    key={category.label}
                    variant="ghost"
                    size="sm"
                    className="h-auto p-2 flex flex-col items-center gap-1 hover:bg-muted"
                    onClick={() => handleSendMessage(`Tell me about ${category.label.toLowerCase()}`)}
                  >
                    <span className="text-lg">{category.icon}</span>
                    <span className="text-xs">{category.label}</span>
                  </Button>
                ))}
              </div>
            </Card>

            {/* Suggested Prompts */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Suggested Questions</h3>
              <div className="space-y-2">
                {suggestedPrompts.slice(0, 4).map((prompt, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    size="sm"
                    className="w-full text-left justify-start h-auto p-2 text-xs hover:bg-muted"
                    onClick={() => handleSendMessage(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </Card>
          </div>

          {/* Main Chat */}
          <div className="lg:col-span-3">
            <Card className="h-full flex flex-col">
              {/* Chat Header */}
              <div className="flex items-center gap-3 p-4 border-b bg-gradient-chat">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">MindMate Assistant</h3>
                  <p className="text-sm text-muted-foreground">
                    Online • {filteredMessages.length} messages
                  </p>
                </div>
                {isLoading && (
                  <Badge variant="secondary" className="animate-pulse">
                    Thinking...
                  </Badge>
                )}
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {filteredMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${
                        message.sender === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {message.sender === "ai" && (
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      
                      <div className="group relative max-w-[80%]">
                        <div
                          className={`${
                            message.sender === "user" ? "chat-bubble-user" : "chat-bubble-ai"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs opacity-70">
                              {message.timestamp.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => copyMessage(message.content)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                              {message.sender === "ai" && (
                                <>
                                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                                    <ThumbsUp className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                                    <ThumbsDown className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {message.sender === "user" && (
                        <div className="w-8 h-8 bg-secondary/20 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-secondary" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="p-4 border-t bg-muted/30">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Ask anything about psychology, mental health, or request personalized insights..."
                      className="pr-12 bg-background"
                      disabled={isLoading}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className={`absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 ${
                        isRecording ? 'text-red-500 bg-red-50' : ''
                      }`}
                      onClick={handleVoiceInput}
                      disabled={isProcessing || isLoading}
                    >
                      {isProcessing ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      ) : (
                        <Mic className={`h-4 w-4 ${isRecording ? 'animate-pulse' : ''}`} />
                      )}
                    </Button>
                  </div>
                  <Button
                    onClick={() => handleSendMessage()}
                    disabled={!inputValue.trim() || isLoading}
                    className="gradient-primary hover-glow"
                  >
                    {isLoading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;