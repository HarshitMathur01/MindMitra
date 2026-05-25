import ChatGPTInterface from "@/components/chat/ChatGPTInterface";
import { AmbienceProvider } from "@/components/sanctuary/AmbienceProvider";
import { ChatProvider } from "../hooks/useChat"

const Chat = () => {
  return (
    <div className="qc-tone min-h-screen bg-[color:var(--qc-canvas)] text-[color:var(--qc-ink)] transition-colors duration-300">
      <AmbienceProvider>
        <ChatProvider>
          <ChatGPTInterface />
        </ChatProvider>
      </AmbienceProvider>
    </div>
  );
};

export default Chat;
