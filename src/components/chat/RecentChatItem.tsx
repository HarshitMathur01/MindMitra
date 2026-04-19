import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { RecentChatPreview } from "./chatTypes";

/**
 * Single row in the sidebar's "What you've talked about" list.
 *
 * Visually communicates the *active* session via a left rail and a
 * subtle background; gently animates the message-count digit when it
 * changes so refreshes feel alive without flashing.
 */
const RecentChatItem = ({
    chat,
    isActive,
    loadingSession,
    onSelect,
}: {
    chat: RecentChatPreview;
    isActive: boolean;
    loadingSession: boolean;
    onSelect: (chatId: string) => void;
}) => {
    const [displayMessageCount, setDisplayMessageCount] = useState(chat.messageCount || 0);

    useEffect(() => {
        if (displayMessageCount === chat.messageCount) return undefined;

        const startCount = displayMessageCount;
        const endCount = chat.messageCount;
        const startedAt = performance.now();
        let frameId = 0;

        const animateCount = (now: number) => {
            const progress = Math.min((now - startedAt) / 320, 1);
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const nextValue = Math.round(startCount + (endCount - startCount) * easedProgress);
            setDisplayMessageCount(nextValue);
            if (progress < 1) {
                frameId = window.requestAnimationFrame(animateCount);
            }
        };

        frameId = window.requestAnimationFrame(animateCount);
        return () => window.cancelAnimationFrame(frameId);
    }, [chat.messageCount, displayMessageCount]);

    return (
        <motion.div
            layout="position"
            initial={false}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
            <Button
                variant="ghost"
                disabled={loadingSession}
                className={`w-full h-auto rounded-xl text-left px-3 py-2.5 transition-all duration-200 group relative border-l-2 ${
                    isActive
                        ? "bg-primary/10 border-l-primary text-foreground"
                        : "border-l-transparent text-muted-foreground hover:text-foreground hover:bg-background/50"
                } ${loadingSession ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={() => onSelect(chat.id)}
            >
                <div className="min-w-0 w-full">
                    <p className="truncate leading-tight text-sm font-medium">{chat.title}</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                        {displayMessageCount} messages
                    </p>
                </div>
            </Button>
        </motion.div>
    );
};

export default RecentChatItem;
