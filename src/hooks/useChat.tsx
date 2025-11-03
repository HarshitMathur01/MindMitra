import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
  const chat = async (message) => {
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
      
      // Generate or retrieve session ID
      const sessionId = sessionStorage.getItem('chat_session_id') || `session_${Date.now()}`;
      sessionStorage.setItem('chat_session_id', sessionId);

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
      setMessages((messages) => [...messages, ...resp]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((messages) => [...messages, { 
        text: `Sorry, I encountered an error: ${error.message}. Please try again.`, 
        audio: null 
      }]);
    }
    setLoading(false);
  };

  // New: chatWithAudio for sending audio to /transcribe-and-chat
  const chatWithAudio = async (audioBlob) => {
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
      
      const sessionId = sessionStorage.getItem('chat_session_id') || `session_${Date.now()}`;
      sessionStorage.setItem('chat_session_id', sessionId);

      // Convert audio blob to base64
      const reader = new FileReader();
      const audioBase64 = await new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(audioBlob);
      });

      const { data, error } = await supabase.functions.invoke('enhanced-chat-context', {
        body: { 
          audio: audioBase64,
          user_id: userId,
          session_id: sessionId
        }
      });

      if (error) {
        console.error('Edge Function error (audio):', error);
        throw error;
      }

      const resp = data.messages || [{ text: data.response || 'No response', audio: null }];
      setMessages((messages) => [...messages, ...resp]);
    } catch (error) {
      console.error('Chat with audio error:', error);
      setMessages((messages) => [...messages, { 
        text: `Sorry, I encountered an error processing your audio: ${error.message}`, 
        audio: null 
      }]);
    }
    setLoading(false);
  };
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState();
  const [loading, setLoading] = useState(false);
  const [cameraZoomed, setCameraZoomed] = useState(true);
  const onMessagePlayed = () => {
    setMessages((messages) => messages.slice(1));
  };

  useEffect(() => {
    if (messages.length > 0) {
      setMessage(messages[0]);
    } else {
      setMessage(null);
    }
  }, [messages]);

  return (
    <ChatContext.Provider
      value={{
        chat,
        chatWithAudio, // add this
        message,
        onMessagePlayed,
        loading,
        cameraZoomed,
        setCameraZoomed,
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
