import ChatGPTInterface from "@/components/chat/ChatGPTInterface";
import {ChatProvider} from "../hooks/useChat"

const Chat = () => {
  return (
    <ChatProvider>
      <ChatGPTInterface />
    </ChatProvider>
  );
};

export default Chat;
