import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Check, Copy } from "lucide-react";
import { duration, ease } from "@/lib/motion";

const affirmations = [
    "You are worthy of love and kindness — especially from yourself.",
    "Every step forward, no matter how small, is still progress.",
    "It's okay to rest. You don't have to earn your right to take a break.",
    "Your feelings are valid. You don't need to justify how you feel.",
    "You've survived 100% of your hardest days. You're stronger than you think.",
    "Healing isn't linear — and that's perfectly okay.",
    "You are not your thoughts. You are the awareness behind them.",
    "Asking for help is a sign of strength, not weakness.",
    "Be gentle with yourself — you're doing the best you can.",
    "This moment is temporary. Brighter days are ahead.",
    "You don't have to have it all figured out to move forward.",
    "Your journey is unique — comparison steals joy.",
];

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 5) return "Still up?";
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    if (hour < 21) return "Good evening";
    return "Late night?";
};

/**
 * Daily affirmation — a handwritten note on a warm card.
 * No color theme swapping, no glow, no pagination dots.
 * Quiet, consistent, one thought at a time.
 */
const DailyAffirmation = () => {
    const [index, setIndex] = useState(() => {
        const dayOfYear = Math.floor(
            (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
                86400000,
        );
        return dayOfYear % affirmations.length;
    });
    const [copied, setCopied] = useState(false);

    const affirmation = affirmations[index];
    const greeting = getGreeting();

    const refresh = () => {
        setIndex((prev) => (prev + 1) % affirmations.length);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(`"${affirmation}" — MindMitra`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <section className="py-16 md:py-24">
            <div className="mx-auto max-w-2xl px-gutter">
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: duration.long, ease: ease.outExpo }}
                    className="rounded-[28px] bg-[hsl(var(--warmth-50))] px-8 py-10 md:px-12 md:py-14"
                >
                    <div className="flex items-center justify-between">
                        <p className="text-[13px] text-[hsl(var(--warmth-500))]">
                            {greeting}. A thought for today —
                        </p>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={copyToClipboard}
                                className="rounded-full p-2 text-[hsl(var(--warmth-500))] transition-colors hover:bg-[hsl(var(--warmth-100))]"
                                aria-label={copied ? "Copied" : "Copy affirmation"}
                            >
                                <AnimatePresence mode="wait">
                                    {copied ? (
                                        <motion.span
                                            key="check"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: duration.quick }}
                                        >
                                            <Check className="h-4 w-4" strokeWidth={1.6} />
                                        </motion.span>
                                    ) : (
                                        <motion.span
                                            key="copy"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: duration.quick }}
                                        >
                                            <Copy className="h-4 w-4" strokeWidth={1.6} />
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </button>
                            <button
                                onClick={refresh}
                                className="rounded-full p-2 text-[hsl(var(--warmth-500))] transition-colors hover:bg-[hsl(var(--warmth-100))]"
                                aria-label="Another one"
                            >
                                <RefreshCw className="h-4 w-4" strokeWidth={1.6} />
                            </button>
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.p
                            key={index}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: duration.base, ease: ease.outExpo }}
                            className="mt-6 font-display text-[22px] font-normal leading-[1.45] tracking-tight-1 text-ink-8 md:text-[26px]"
                        >
                            {affirmation}
                        </motion.p>
                    </AnimatePresence>

                    <p className="mt-8 text-[13px] text-ink-5">
                        You don't have to believe it today. You can just read it.
                    </p>
                </motion.div>
            </div>
        </section>
    );
};

export default DailyAffirmation;
