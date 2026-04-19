import { motion } from "framer-motion";
import { Mic, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CHAT_SOFT_SPRING } from "./chatConstants";
import ChatSafetyRail from "./ChatSafetyRail";

interface ChatComposerProps {
    inputValue: string;
    onInputChange: (value: string) => void;
    onSubmit: () => void;
    onVoiceInput: () => void;
    isLoading: boolean;
    isRecording: boolean;
    isProcessing: boolean;
    /** Show the always-quiet safety rail under the composer. */
    showSafetyRail?: boolean;
}

/**
 * Sticky bottom composer.
 *
 * Two notable behaviors:
 *   - When `isRecording`, the mic pill takes a "held" warm tone so the
 *     user always knows recording is active without visual alarm.
 *   - The safety rail is rendered *below* the composer (not above
 *     it) so the path to help is the last thing the user sees on the
 *     screen — closer to thumb reach on mobile.
 */
const ChatComposer = ({
    inputValue,
    onInputChange,
    onSubmit,
    onVoiceInput,
    isLoading,
    isRecording,
    isProcessing,
    showSafetyRail = true,
}: ChatComposerProps) => {
    const onKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
        }
    };

    return (
        <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={CHAT_SOFT_SPRING}
            className="sticky bottom-0 z-20 shrink-0 border-t border-border bg-card/95 backdrop-blur p-3 sm:p-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
            <div className="max-w-3xl mx-auto">
                <div className="chat-input relative rounded-full bg-background border border-input transition-all duration-base">
                    <Input
                        value={inputValue}
                        onChange={(e) => onInputChange(e.target.value)}
                        onKeyPress={onKeyPress}
                        placeholder="Take your time…"
                        className="pr-24 h-12 text-[15px] rounded-full bg-transparent border-0 text-foreground placeholder:text-ink-5 shadow-none focus-visible:outline-none focus-visible:ring-0"
                        disabled={isLoading}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <Button
                            size="sm"
                            variant="ghost"
                            className={`h-9 w-9 p-0 rounded-full transition-all duration-200 ${
                                isRecording
                                    ? "text-[hsl(var(--warmth-500))] bg-[hsl(var(--warmth-100))] hover:bg-[hsl(var(--warmth-200))]"
                                    : "hover:bg-muted/40"
                            }`}
                            onClick={onVoiceInput}
                            disabled={isProcessing || isLoading}
                            aria-label={isRecording ? "Stop recording" : "Speak instead"}
                        >
                            {isProcessing ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[hsl(var(--accent-500))] border-t-transparent" />
                            ) : (
                                <Mic className="h-4 w-4" strokeWidth={1.8} />
                            )}
                        </Button>
                        <Button
                            onClick={onSubmit}
                            disabled={!inputValue.trim() || isLoading}
                            className="h-9 w-9 p-0 rounded-full transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label="Send"
                        >
                            <Send className="h-3.5 w-3.5" strokeWidth={1.8} />
                        </Button>
                    </div>
                </div>

                {showSafetyRail && <ChatSafetyRail />}
            </div>
        </motion.div>
    );
};

export default ChatComposer;
