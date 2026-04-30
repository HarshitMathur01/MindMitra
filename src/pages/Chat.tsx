import ChatGPTInterface from "@/components/chat/ChatGPTInterface";
import { ChatProvider } from "../hooks/useChat"

const Chat = () => {
  return (
    <div className="qc-tone min-h-screen bg-[color:var(--qc-canvas)] text-[color:var(--qc-ink)] transition-colors duration-300">
      <ChatProvider>
        <ChatGPTInterface />
      </ChatProvider>
    </div>
  );
};

export default Chat;
