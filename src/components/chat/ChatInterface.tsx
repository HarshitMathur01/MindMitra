import { useState, useEffect } from "react";
import { Send, Mic, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
}

const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const { toast } = useToast();
  const { isRecording, isProcessing, toggleRecording } = useVoiceRecording();

  // Load messages from database
  useEffect(() => {
    loadMessages();
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user?.id || null);
  };

  const loadMessages = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Show welcome message for unauthenticated users
        setMessages([{
          id: "welcome",
          content: "Hello! I'm your MindMate AI assistant. I'm here to help you with psychological insights, answer questions about mental health, and guide you through our interactive experiences. How can I assist you today?",
          sender: "ai",
          timestamp: new Date(),
        }]);
        return;
      }

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
        // Show welcome message for new users
        setMessages([{
          id: "welcome",
          content: "Hello! I'm your MindMate AI assistant. I'm here to help you with psychological insights, answer questions about mental health, and guide you through our interactive experiences. How can I assist you today?",
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
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return; // Don't save messages for unauthenticated users

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

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    
    // Save user message to database
    await saveMessage(userMessage);
    
    const messageContent = inputValue;
    setInputValue("");
    setIsLoading(true);

    try {
      // Get conversation history (last 10 messages for context)
      const conversationHistory = messages.slice(-10);
      
      const { data, error } = await supabase.functions.invoke('chat-with-groq', {
        body: {
          message: messageContent,
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
      
      // Save AI response to database
      await saveMessage(aiResponse);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to get AI response. Please try again.",
        variant: "destructive",
      });

      // Remove loading state and restore input if error
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: "I apologize, but I'm experiencing technical difficulties. Please try again in a moment.",
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorResponse]);
      
      // Save error response to database
      await saveMessage(errorResponse);
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

  return (
    <div className="flex flex-col h-[600px] bg-card rounded-2xl border shadow-lg">
      {/* Chat Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-gradient-chat rounded-t-2xl">
        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">MindMate Assistant</h3>
          <p className="text-sm text-muted-foreground">Online • Ready to help</p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
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
              
              <div
                className={`${
                  message.sender === "user" ? "chat-bubble-user" : "chat-bubble-ai"
                }`}
              >
                <p className="text-sm">{message.content}</p>
                <span className="text-xs opacity-70 mt-1 block">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
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
              placeholder="Ask me about psychology, mental health, or take a personality test..."
              className="pr-12 bg-background"
            />
            <Button
              size="sm"
              variant="ghost"
              className={`absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 ${
                isRecording ? 'text-red-500 bg-red-50' : ''
              }`}
              onClick={handleVoiceInput}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : (
                <Mic className={`h-4 w-4 ${isRecording ? 'animate-pulse' : ''}`} />
              )}
            </Button>
          </div>
          <Button
            onClick={handleSendMessage}
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
    </div>
  );
};

export default ChatInterface;