/**
 * ChatMoodWidget — the one-shot mood picker shown after the first AI turn.
 * Kept as an explicit prompt (rather than an always-on chip) because it
 * produced a clear engagement lift in the previous ship.
 *
 * Rendered inside the orchestrator's AnimatePresence; the motion.div here
 * picks up the exit animation through PresenceContext.
 */

import { motion } from "framer-motion";

import { useLocalizedT } from "@/hooks/useLocalizedT";
import { CHAT_MESSAGE_SPRING } from "./chatConstants";

interface ChatMoodWidgetProps {
    options: Array<{ emoji: string; label: string; value: number }>;
    onSelect: (value: number) => void;
    onDismiss: () => void;
}

const ChatMoodWidget = ({ options, onSelect, onDismiss }: ChatMoodWidgetProps) => {
    const { t: tSanctuary } = useLocalizedT();

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={CHAT_MESSAGE_SPRING}
            className="mx-auto max-w-sm rounded-[24px] bg-[hsl(var(--warmth-50))] p-6 text-center space-y-4"
        >
            <p className="text-[15px] text-ink-7">{tSanctuary("chat.moodWidget.prompt")}</p>
            <div className="flex flex-wrap justify-center gap-2">
                {options.map(({ emoji, label, value }) => (
                    <button
                        key={value}
                        onClick={() => onSelect(value)}
                        className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-muted/40 transition-colors group"
                        title={label}
                    >
                        <span className="text-2xl group-hover:scale-125 transition-transform duration-200 select-none">
                            {emoji}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                            {label}
                        </span>
                    </button>
                ))}
            </div>
            <button
                onClick={onDismiss}
                className="text-[12px] text-ink-5 hover:text-ink-7 transition-colors"
            >
                {tSanctuary("chat.moodWidget.maybeLater")}
            </button>
        </motion.div>
    );
};

export default ChatMoodWidget;
