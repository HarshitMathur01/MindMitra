import ChatGPTInterface from "@/components/chat/ChatGPTInterface";
import { ChatProvider } from "../hooks/useChat"

const Chat = () => {
  return (
    <div className="min-h-screen bg-background text-text-primary transition-colors duration-300">
      <ChatProvider>
        <ChatGPTInterface />
      </ChatProvider>
    </div>
  );
};

export default Chat;
