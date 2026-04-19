import { useNavigate } from "react-router-dom";
import { LifeBuoy } from "lucide-react";

/**
 * Always-present, deliberately quiet rail under the composer.
 *
 * Why it lives here (and not as a button or dialog):
 *   - For a youth mental-health product, the path to help must be
 *     reachable without thinking, without searching, and without
 *     the cognitive load of a modal opening at the worst moment.
 *   - Two anchored choices (their plan, their helpline) — both one
 *     tap away. No upsell, no "learn more" — just the door.
 *   - Tone stays soft so it doesn't read as "you're in trouble"
 *     during normal conversation.
 *
 * Crisis detection in the backend remains the active escalation; this
 * is the *passive* always-there safety net.
 */
const ChatSafetyRail = () => {
    const navigate = useNavigate();

    return (
        <div className="mx-auto mt-2 flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 text-[11.5px] text-ink-5">
            <span className="inline-flex items-center gap-1">
                <LifeBuoy className="h-3 w-3" />
                If you need help right now
            </span>
            <button
                type="button"
                onClick={() => navigate("/safety-plan")}
                className="underline-offset-2 transition-colors hover:text-ink-7 hover:underline"
            >
                Open your safety plan
            </button>
            <span aria-hidden="true">·</span>
            <a
                href="tel:18005990019"
                className="underline-offset-2 transition-colors hover:text-ink-7 hover:underline"
            >
                Call KIRAN · 1800-599-0019
            </a>
        </div>
    );
};

export default ChatSafetyRail;
