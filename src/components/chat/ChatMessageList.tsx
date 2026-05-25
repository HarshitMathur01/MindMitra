import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Copy,
    ThumbsUp,
    ThumbsDown,
    MoreVertical,
    Bookmark,
    BookmarkCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocalizedT } from "@/hooks/useLocalizedT";
import MessageRenderer from "./MessageRenderer";
import QuickReplies from "./QuickReplies";
import {
    formatDateSeparator,
    getQuickReplies,
    isMomentKept,
    toggleKeptMoment,
} from "./chatHelpers";
import { CHAT_MESSAGE_SPRING } from "./chatConstants";
import type { Message } from "./chatTypes";

interface ChatMessageListProps {
    messages: Message[];
    isLoading: boolean;
    sessionId: string | null;
    userInitial: string;
    userDisplayName: string;
    userAvatarUrl?: string;
    onCopyMessage: (content: string) => void;
    onFeedback: (kind: "up" | "down") => void;
    onSendMessage: (text: string) => void;
    /**
     * Optional spring override for the bubble entry transition. Falls back to
     * the default CHAT_MESSAGE_SPRING when omitted. Supplied by
     * useChatPersonalization so warmth from the latest turn's tone params
     * shapes how new messages land.
     */
    messageSpring?: typeof CHAT_MESSAGE_SPRING;
}

/**
 * Pure render of the conversation timeline.
 *
 * Two intentional UX additions over the previous monolith:
 *   1. "Keep this" bookmark on every AI message — saves to
 *      localStorage; surfaces in /me. Lets the user collect what
 *      actually helped without writing it down.
 *   2. Body-cue chips & quick replies live INSIDE the last AI bubble,
 *      not as floating chrome below the timeline, so they read as
 *      part of the conversation, not interface overhead.
 */
const ChatMessageList = ({
    messages,
    isLoading,
    sessionId,
    userInitial,
    userDisplayName,
    userAvatarUrl,
    onCopyMessage,
    onFeedback,
    onSendMessage,
    messageSpring,
}: ChatMessageListProps) => {
    const spring = messageSpring ?? CHAT_MESSAGE_SPRING;
    const { t, i18n } = useLocalizedT();
    // Local mirror of the kept-set so toggling re-renders without forcing
    // a parent state lift. Re-syncs on session change.
    const [keptIds, setKeptIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const ids = new Set<string>();
        messages.forEach((m) => {
            if (m.sender === "ai" && isMomentKept(m.id)) ids.add(m.id);
        });
        setKeptIds(ids);
    }, [messages, sessionId]);

    const handleKeep = (m: Message) => {
        const nowKept = toggleKeptMoment({
            id: m.id,
            sessionId: sessionId ?? "unknown",
            content: m.content,
            keptAt: new Date().toISOString(),
        });
        setKeptIds((prev) => {
            const next = new Set(prev);
            if (nowKept) next.add(m.id);
            else next.delete(m.id);
            return next;
        });
    };

    return (
        <AnimatePresence>
            {messages.map((message, index) => {
                const isNewDay =
                    index === 0 ||
                    new Date(message.timestamp).toDateString() !==
                        new Date(messages[index - 1].timestamp).toDateString();
                const isLastAi =
                    message.sender === "ai" && index === messages.length - 1;
                const kept = keptIds.has(message.id);

                return (
                    <div key={message.id}>
                        {isNewDay && (
                            <div className="flex items-center gap-3 my-2">
                                <div className="flex-1 h-px bg-border/60" />
                                <span className="text-[11px] text-muted-foreground/70 font-medium px-2">
                                    {formatDateSeparator(message.timestamp, t)}
                                </span>
                                <div className="flex-1 h-px bg-border/60" />
                            </div>
                        )}

                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            transition={spring}
                            className="group"
                        >
                            {message.sender === "ai" ? (
                                <div className="flex gap-2 sm:gap-3 items-start">
                                    <div className="flex-shrink-0">
                                        <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-primary/10 border border-border flex items-center justify-center">
                                            <img
                                                src="/image6.png"
                                                alt="AI companion"
                                                className="h-6 w-6 sm:h-7 sm:w-7 rounded-full object-cover"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex-1 flex flex-col items-start space-y-2 min-w-0">
                                        {/*
                                          Accessibility: while a message is actively
                                          streaming we expose it as a polite live
                                          region with aria-busy=true so screen
                                          readers announce updates without hijacking
                                          focus. Older AI messages are static and
                                          intentionally NOT live regions to avoid
                                          re-announcement on re-render.
                                        */}
                                        <div
                                            className="rounded-[18px] rounded-tl-md bg-ink-1 px-3.5 py-2.5 sm:px-4 sm:py-3 max-w-[94%] sm:max-w-[80%] lg:max-w-[70%]"
                                            {...(isLastAi && isLoading
                                                ? {
                                                      "aria-live": "polite" as const,
                                                      "aria-busy": true,
                                                      "aria-atomic": false,
                                                  }
                                                : {})}
                                        >
                                            <div className="chat-bubble-text text-[15px] leading-[1.55] text-ink-8">
                                                <MessageRenderer content={message.content} />
                                            </div>
                                        </div>

                                        {isLastAi && (
                                            <QuickReplies
                                                suggestions={getQuickReplies(message.content, i18n.language)}
                                                onSelect={onSendMessage}
                                                visible={!isLoading}
                                            />
                                        )}

                                        <div className="flex items-center gap-1.5">
                                            {/* "Keep this" — quiet bookmark, primary action on AI replies */}
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className={`h-8 gap-1 px-2 text-[11.5px] transition-all duration-200 ${
                                                    kept
                                                        ? "text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]"
                                                        : "text-muted-foreground hover:text-foreground"
                                                }`}
                                                onClick={() => handleKeep(message)}
                                                aria-label={kept ? t("chat.messageActions.keepAriaKept") : t("chat.messageActions.keepAriaUnkept")}
                                                aria-pressed={kept}
                                            >
                                                {kept ? (
                                                    <BookmarkCheck className="h-3.5 w-3.5" />
                                                ) : (
                                                    <Bookmark className="h-3.5 w-3.5" />
                                                )}
                                                {kept ? t("chat.messageActions.kept") : t("chat.messageActions.keepThis")}
                                            </Button>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0 hover:bg-muted/40 transition-all duration-200"
                                                        aria-label={t("chat.messageActions.menuAria")}
                                                    >
                                                        <MoreVertical className="h-3.5 w-3.5" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="start" className="w-44">
                                                    <DropdownMenuItem onClick={() => onCopyMessage(message.content)}>
                                                        <Copy className="h-4 w-4 mr-2" />
                                                        {t("chat.messageActions.copy")}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => onFeedback("up")}>
                                                        <ThumbsUp className="h-4 w-4 mr-2" />
                                                        {t("chat.messageActions.helpful")}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => onFeedback("down")}>
                                                        <ThumbsDown className="h-4 w-4 mr-2" />
                                                        {t("chat.messageActions.notHelpful")}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>

                                            <span className="text-xs text-muted-foreground ml-1">
                                                {message.timestamp.toLocaleTimeString([], {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-2 sm:gap-3 justify-end items-start">
                                    <div className="flex-1 flex flex-col items-end min-w-0">
                                        <div className="bg-ink-2 text-ink-8 rounded-[18px] rounded-tr-md px-3.5 py-2.5 sm:px-4 sm:py-3 max-w-[94%] sm:max-w-[80%] lg:max-w-[70%]">
                                            <span className="chat-bubble-text text-[15px] leading-[1.55] whitespace-pre-wrap">
                                                {message.content}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-end gap-2 mt-1">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0 hover:bg-muted/40 transition-all duration-200"
                                                        aria-label={t("chat.messageActions.menuAria")}
                                                    >
                                                        <MoreVertical className="h-3.5 w-3.5" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-40">
                                                    <DropdownMenuItem onClick={() => onCopyMessage(message.content)}>
                                                        <Copy className="h-4 w-4 mr-2" />
                                                        {t("chat.messageActions.copy")}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>

                                            <span className="text-xs text-muted-foreground">
                                                {message.timestamp.toLocaleTimeString([], {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0">
                                        {userAvatarUrl ? (
                                            <img
                                                src={userAvatarUrl}
                                                alt={userDisplayName}
                                                className="h-8 w-8 sm:h-9 sm:w-9 rounded-full object-cover border border-border"
                                            />
                                        ) : (
                                            <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-[hsl(var(--accent-100))] text-[13px] font-medium text-[hsl(var(--accent-600))]">
                                                {userInitial}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </div>
                );
            })}
        </AnimatePresence>
    );
};

export default ChatMessageList;
