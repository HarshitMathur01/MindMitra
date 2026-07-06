import { motion } from "framer-motion";
import { Mic, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CHAT_SOFT_SPRING } from "./chatConstants";
import ChatSafetyRail from "./ChatSafetyRail";
import { useLocalizedT } from "@/hooks/useLocalizedT";

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
    const { t } = useLocalizedT();
    // `onKeyPress` is deprecated in React and has inconsistent IME / mobile
    // behaviour (notably broken Enter handling on some Android keyboards).
    // `onKeyDown` is the supported, widely-tested handler. We also guard
    // against IME composition so users typing Hindi/Tamil via a soft
    // keyboard don't accidentally submit mid-character.
    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
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
                        onKeyDown={onKeyDown}
                        placeholder={t("chat.composer.placeholder", "Take your time…")}
                        // h-14 on mobile gives the input enough vertical
                        // air to clear the larger touch targets and feels
                        // less cramped under thumbs. h-12 stays on sm+.
                        className="pr-[6.5rem] sm:pr-24 h-14 sm:h-12 text-[16px] sm:text-[15px] rounded-full bg-transparent border-0 text-foreground placeholder:text-ink-5 shadow-none focus-visible:outline-none focus-visible:ring-0"
                        disabled={isLoading}
                        // Calmer mobile keyboard — no autocorrect surprises
                        // when typing emotionally charged content; no
                        // capitalize-every-sentence quirks. Users who want
                        // them can override at the OS level.
                        autoComplete="off"
                        autoCapitalize="sentences"
                        spellCheck={true}
                    />
                    <div className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <Button
                            size="sm"
                            variant="ghost"
                            // 44×44 px on mobile (Apple HIG / WCAG 2.5.5
                            // minimum tap target), 36×36 on sm+.
                            className={`h-11 w-11 sm:h-9 sm:w-9 p-0 rounded-full transition-all duration-200 ${
                                isRecording
                                    ? "text-[hsl(var(--warmth-500))] bg-[hsl(var(--warmth-100))] hover:bg-[hsl(var(--warmth-200))]"
                                    : "hover:bg-muted/40"
                            }`}
                            onClick={onVoiceInput}
                            disabled={isProcessing || isLoading}
                            aria-label={isRecording ? t("chat.composer.stopRecordingAria", "Stop recording") : t("chat.composer.speakAria", "Speak instead")}
                        >
                            {isProcessing ? (
                                <div className="h-5 w-5 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-[hsl(var(--accent-500))] border-t-transparent" />
                            ) : (
                                <Mic className="h-5 w-5 sm:h-4 sm:w-4" strokeWidth={1.8} />
                            )}
                        </Button>
                        <Button
                            onClick={onSubmit}
                            disabled={!inputValue.trim() || isLoading}
                            className="h-11 w-11 sm:h-9 sm:w-9 p-0 rounded-full transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label={isLoading ? t("chat.composer.sendingAria", "Sending…") : t("chat.composer.sendAria", "Send")}
                            aria-busy={isLoading}
                        >
                            {/* While awaiting a reply, mirror the mic's processing
                                spinner (border-current so it reads on the primary
                                fill) instead of just dimming — clearer that the
                                message is in flight. */}
                            {isLoading ? (
                                <div className="h-4 w-4 sm:h-3.5 sm:w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : (
                                <Send className="h-4 w-4 sm:h-3.5 sm:w-3.5" strokeWidth={1.8} />
                            )}
                        </Button>
                    </div>
                </div>

                {showSafetyRail && <ChatSafetyRail />}
            </div>
        </motion.div>
    );
};

export default ChatComposer;
