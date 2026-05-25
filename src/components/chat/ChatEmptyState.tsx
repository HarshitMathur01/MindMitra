import { motion } from "framer-motion";
import Pulse from "@/components/identity/Pulse";
import { useLocalizedT } from "@/hooks/useLocalizedT";
import { CHAT_MESSAGE_SPRING } from "./chatConstants";
import { useEmptyStateStarters, useBodyCueChips } from "./chatI18n";

type TimeBucket = "late-night" | "morning" | "afternoon" | "evening" | "night";

const BUCKET_TO_KEY: Record<TimeBucket, string> = {
    "late-night": "lateNight",
    morning: "morning",
    afternoon: "afternoon",
    evening: "evening",
    night: "night",
};

function useGreeting(
    displayName: string | undefined,
    timeBucket: TimeBucket | undefined,
): { headline: string; subcopy: string } {
    const { t } = useLocalizedT();
    if (!timeBucket) {
        return {
            headline: t("chat.emptyState.fallback.headline"),
            subcopy: t("chat.emptyState.fallback.subcopy"),
        };
    }
    const firstName = (displayName ?? "").trim().split(/\s+/)[0];
    const named = Boolean(firstName) && firstName.length <= 24;
    const bucketKey = BUCKET_TO_KEY[timeBucket];
    const base = `chat.emptyState.greetings.${bucketKey}`;
    return {
        headline: named
            ? t(`${base}.headlineNamed`, { name: firstName })
            : t(`${base}.headlineUnnamed`),
        subcopy: t(`${base}.subcopy`),
    };
}

/**
 * Calmer chat opening:
 *   1. Pulse — the breathing identity, present before any words.
 *   2. A short, low-pressure invitation.
 *   3. Three text-based starters (no chips, no clinical vocab).
 *   4. Body-cue chips below — a one-tap somatic on-ramp; clinically
 *      richer than 1–5 mood and more honest about how distress shows
 *      up in the body.
 *
 * The headline + subcopy interpolate the user's first name and the
 * current time bucket when both are known — falls back cleanly when
 * either is missing so cold-load + first-visit cases still look complete.
 */
const ChatEmptyState = ({
    onSend,
    displayName,
    timeBucket,
}: {
    onSend: (text: string) => void;
    displayName?: string;
    timeBucket?: TimeBucket;
}) => {
    const { t } = useLocalizedT();
    const { headline, subcopy } = useGreeting(displayName, timeBucket);
    const starters = useEmptyStateStarters();
    const bodyCues = useBodyCueChips();
    return (
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
            {headline}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
            {subcopy}
        </p>

        <div className="mt-6 flex w-full flex-col gap-2">
            {starters.map((s) => (
                <button
                    key={s.key}
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
                {t("chat.emptyState.bodyCueHeading")}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {bodyCues.map((chip) => (
                    <button
                        key={chip.key}
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
};

export default ChatEmptyState;
