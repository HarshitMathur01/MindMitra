import { motion } from "framer-motion";
import { Eye, FileText, Lock, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { DURATION, EASE } from "@/lib/redesign/tokens";

/**
 * What the hand-off actually is — explained in plain language so a user
 * doesn't have to read terms-of-service to feel safe sharing.
 *
 * The four cards mirror the four real guarantees:
 *   - You see what the clinician sees, before they see it.
 *   - Nothing leaves until you book + consent.
 *   - You control the level of detail (full / patterns / assessments only).
 *   - You can pull access anytime.
 */

const eyebrow = "text-[11px] font-medium uppercase tracking-[0.2em] text-ink-5";

const items = [
    {
        icon: Eye,
        title: "You see it first",
        body: "Before any therapist receives anything, you preview the exact summary they'll get.",
    },
    {
        icon: FileText,
        title: "Pattern, not transcript",
        body: "By default they see your themes, mood trends, and assessments — not your raw chat history.",
    },
    {
        icon: Lock,
        title: "Nothing without consent",
        body: "Sharing only happens after you book and tick the boxes you're comfortable with.",
    },
    {
        icon: ShieldCheck,
        title: "Revocable, anytime",
        body: "Pull a clinician's access from your settings. They keep nothing on their side after that.",
    },
] as const;

const HandoffExplainer = () => {
    return (
        <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.long, ease: EASE.outExpo, delay: 0.1 }}
            className={cn(
                "mb-12 rounded-[1.75rem] border border-ink-3/40 bg-[hsl(var(--ink-1))]/60 p-6 sm:p-8",
                "dark:border-ink-3/30 dark:bg-[hsl(var(--ink-2))]/60",
            )}
        >
            <header className="mb-6 max-w-2xl space-y-2">
                <p className={eyebrow}>How the hand-off works</p>
                <h2 className="font-display text-[22px] font-normal leading-tight tracking-tight text-ink-8 md:text-[26px]">
                    What the therapist sees, and what stays with you.
                </h2>
                <p className="text-[14px] leading-relaxed text-ink-5">
                    A first session usually burns 20 minutes on backstory. We hand the clinician
                    a calm, opt-in summary so you can spend that time on what you actually came
                    for.
                </p>
            </header>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {items.map(({ icon: Icon, title, body }) => (
                    <div
                        key={title}
                        className="flex items-start gap-3 rounded-2xl border border-border/40 bg-[hsl(var(--card))] p-4 transition-colors hover:border-ink-3/60"
                    >
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--accent-100))] text-[hsl(var(--accent-700))]">
                            <Icon className="h-4 w-4" strokeWidth={1.8} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[14px] font-medium text-ink-8">{title}</p>
                            <p className="mt-1 text-[13px] leading-[1.55] text-ink-5">{body}</p>
                        </div>
                    </div>
                ))}
            </div>
        </motion.section>
    );
};

export default HandoffExplainer;
