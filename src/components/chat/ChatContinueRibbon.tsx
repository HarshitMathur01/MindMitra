import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { CHAT_MESSAGE_SPRING } from "./chatConstants";

/**
 * "Where you left off" — appears once at the top of a restored
 * session if the most recent exchange wasn't from "today". Helps the
 * user re-orient without scrolling, and signals continuity (the
 * personalization moat made visible).
 *
 * Quiet card; tap scrolls to the latest message. Dismissible.
 */
const ChatContinueRibbon = ({
    lastAiMessage,
    timeAgo,
    onJump,
    onDismiss,
}: {
    lastAiMessage: string;
    timeAgo: string;
    onJump: () => void;
    onDismiss: () => void;
}) => {
    const trimmed =
        lastAiMessage.length > 140
            ? `${lastAiMessage.slice(0, 140).trimEnd()}…`
            : lastAiMessage;

    return (
        <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={CHAT_MESSAGE_SPRING}
            className="rounded-2xl border border-border/50 bg-[hsl(var(--ink-1))] p-4"
        >
            <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-5">
                        Where you left off · {timeAgo}
                    </p>
                    <p className="mt-1.5 text-[14px] leading-[1.55] text-ink-7 line-clamp-2">
                        {trimmed}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onJump}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-[12px] font-medium text-ink-7 transition-colors hover:bg-background"
                    aria-label="Continue this conversation"
                >
                    Continue
                    <ArrowRight className="h-3 w-3" />
                </button>
            </div>
            <button
                type="button"
                onClick={onDismiss}
                className="mt-2 text-[11px] text-ink-5 transition-colors hover:text-ink-7"
            >
                Dismiss
            </button>
        </motion.div>
    );
};

export default ChatContinueRibbon;
