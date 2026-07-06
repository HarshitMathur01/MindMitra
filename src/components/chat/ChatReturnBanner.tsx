/**
 * ChatReturnBanner — shown when the user completed a MindGym tool that was
 * opened from chat. Tapping a chip posts as a normal user message through
 * the LLM; the orchestrator owns clearing the handoff + sending.
 */

import { useLocalizedT } from "@/hooks/useLocalizedT";
import type { ChatActivityHandoff } from "@/lib/chat/activitySuggestion";
import QuickReplies from "./QuickReplies";

interface ChatReturnBannerProps {
    handoff: ChatActivityHandoff;
    onReply: (text: string) => void;
}

const ChatReturnBanner = ({ handoff, onReply }: ChatReturnBannerProps) => {
    const { t: tSanctuary } = useLocalizedT();

    return (
        <div className="border-t border-border bg-card/40 px-4 sm:px-6 pt-3 pb-1">
            <div className="max-w-4xl mx-auto flex flex-col gap-1">
                <p className="text-[12px] text-ink-5">
                    {tSanctuary("activitySuggestion.returnHeading", "back from {{activity}} — how did it land?", {
                        activity: handoff.activity_id.replace(/^\//, "").replace(/-/g, " "),
                    })}
                </p>
                <QuickReplies
                    visible
                    suggestions={[
                        tSanctuary("activitySuggestion.returnChips.better", "better"),
                        tSanctuary("activitySuggestion.returnChips.same", "same"),
                        tSanctuary("activitySuggestion.returnChips.notForMe", "not for me"),
                    ]}
                    onSelect={onReply}
                />
            </div>
        </div>
    );
};

export default ChatReturnBanner;
