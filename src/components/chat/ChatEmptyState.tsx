import { motion } from "framer-motion";
import Pulse from "@/components/identity/Pulse";
import { CHAT_MESSAGE_SPRING, emptyStateStarters, bodyCueChips } from "./chatConstants";

/**
 * Calmer chat opening:
 *   1. Pulse — the breathing identity, present before any words.
 *   2. A short, low-pressure invitation.
 *   3. Three text-based starters (no chips, no clinical vocab).
 *   4. Body-cue chips below — a one-tap somatic on-ramp; clinically
 *      richer than 1–5 mood and more honest about how distress shows
 *      up in the body.
 *
 * Replaces the older "mood widget appears as second message" pattern,
 * which felt procedural and broke the conversational flow.
 */
const ChatEmptyState = ({
    onSend,
}: {
    onSend: (text: string) => void;
}) => (
    <motion.div
        key="empty-state"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={CHAT_MESSAGE_SPRING}
        className="mx-auto flex max-w-md flex-col items-center pt-10 text-center"
    >
        <Pulse size={120} state="idle" intensity={0.85} />

        <p className="mt-8 font-display text-2xl tracking-tight text-foreground">
            Whenever you&apos;re ready.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
            No script. Pick a way in, or just start typing.
        </p>

        <div className="mt-6 flex w-full flex-col gap-2">
            {emptyStateStarters.map((s) => (
                <button
                    key={s.label}
                    type="button"
                    onClick={() => onSend(s.prompt)}
                    className="rounded-2xl border border-border/50 bg-background px-4 py-3 text-left text-sm text-foreground transition-colors hover:border-border hover:bg-[hsl(var(--ink-1))]"
                >
                    {s.label}
                </button>
            ))}
        </div>

        <div className="mt-8 w-full">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-5">
                Or start with how it feels
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {bodyCueChips.map((chip) => (
                    <button
                        key={chip.label}
                        type="button"
                        onClick={() => onSend(chip.prompt)}
                        className="rounded-full border border-border/50 bg-background px-3 py-1.5 text-xs text-ink-7 transition-colors hover:border-border hover:bg-[hsl(var(--ink-1))]"
                    >
                        {chip.label}
                    </button>
                ))}
            </div>
        </div>
    </motion.div>
);

export default ChatEmptyState;
