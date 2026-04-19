import { motion } from "framer-motion";
import Pulse from "@/components/identity/Pulse";
import { CHAT_MESSAGE_SPRING } from "./chatConstants";

/**
 * Replaces the dot-loader with the breathing identity. Phrase rotates
 * slowly via the parent (`loadingPhase`) so the user sees actual care
 * being taken, not a generic spinner.
 */
const ChatThinking = ({ loadingPhase }: { loadingPhase: string }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={CHAT_MESSAGE_SPRING}
        className="flex gap-3 items-center"
    >
        <div className="flex-shrink-0">
            <Pulse size={48} state="thinking" intensity={0.9} />
        </div>
        <p className="text-[12.5px] text-muted-foreground">{loadingPhase}</p>
    </motion.div>
);

export default ChatThinking;
