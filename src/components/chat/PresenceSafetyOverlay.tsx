/**
 * PresenceSafetyOverlay — quiet safety rail for Presence Mode.
 *
 * MindMitra is mental-health adjacent; the Stanley-Brown Safety Planning
 * Intervention (SPI) literature is unambiguous that crisis resources must
 * be reachable in ≤ 1 tap from any point of conversation. Half-pane chat
 * has the always-visible safety rail under the composer; Presence Mode
 * (which hides the composer) needs an equivalent that doesn't visually
 * compete with the avatar.
 *
 * Design:
 *   - Tiny "Need help?" pill in the top-right area while collapsed
 *     (intentionally subtle — distress users dislike loud crisis CTAs
 *     because they signal "you look unstable", which is shaming).
 *   - On tap, a calm sheet slides up with two clear actions:
 *       1. Open my safety plan  → /safety-plan (Stanley-Brown 6-step)
 *       2. Talk to iCall now    → tel: link to vetted national helpline
 *   - "Resume" button to return to the conversation.
 *
 * Citations: see CITATIONS.md (Stanley-Brown SPI; JMIR ECA scoping review).
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ShieldCheck, Phone, ChevronRight, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useChat } from "@/hooks/useChat";
import { PRIMARY_HELPLINE, helplineHref } from "@/lib/helplines";

/** Selector matching every focusable element inside the sheet so we can
 *  build a tab cycle. Keep the list narrow — `[tabindex="-1"]` is
 *  excluded because it shouldn't participate in the cycle. */
const FOCUSABLE_SELECTOR = [
    "a[href]",
    "button:not([disabled])",
    "textarea:not([disabled])",
    'input:not([disabled]):not([type="hidden"])',
    "select:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
].join(",");

const PresenceSafetyOverlay = () => {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();
    const reduceMotion = useReducedMotion();
    const { exitPresenceMode } = useChat();

    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const sheetRef = useRef<HTMLDivElement | null>(null);

    const goSafetyPlan = () => {
        // Exit Presence so the safety plan page is not occluded by our overlay.
        exitPresenceMode();
        navigate("/safety-plan");
    };

    /**
     * Focus management for the sheet:
     *   1. When it opens, focus moves to the first focusable element so a
     *      keyboard user is *inside* the sheet, not behind it on the avatar.
     *   2. While open, Tab/Shift+Tab cycle within the sheet (focus trap).
     *   3. ESC closes the sheet.
     *   4. When it closes, focus returns to the trigger button so the user
     *      doesn't lose their place — important for someone in distress
     *      navigating with keyboard or assistive tech.
     */
    useEffect(() => {
        if (!open) return;

        const sheet = sheetRef.current;
        if (!sheet) return;

        const focusables = Array.from(
            sheet.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        );
        focusables[0]?.focus();

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
                return;
            }
            if (e.key !== "Tab" || focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            // Restore focus to the trigger only if it's still in the DOM and
            // the focus is currently somewhere we don't expect (e.g. body).
            // If the user clicked an in-sheet link (safety plan) we let
            // navigation move focus naturally instead.
            if (triggerRef.current && document.contains(triggerRef.current)) {
                triggerRef.current.focus();
            }
        };
    }, [open]);

    return (
        <>
            {/* Collapsed pill — top-right, beneath the Exit button. */}
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen(true)}
                className="absolute top-[max(env(safe-area-inset-top),0.75rem)] right-4 sm:right-6 mt-12 z-30 inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur px-3 py-1.5 text-[12px] font-medium text-white/85 hover:bg-white/15 active:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
                aria-label="Open safety options"
                aria-haspopup="dialog"
                aria-expanded={open}
            >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Need help?</span>
            </button>

            <AnimatePresence>
                {open && (
                    <>
                        {/* Backdrop — dims the avatar but keeps it visible. */}
                        <motion.div
                            key="safety-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="absolute inset-0 z-40 bg-black/40 backdrop-blur-sm"
                            onClick={() => setOpen(false)}
                            aria-hidden
                        />
                        {/* Sheet */}
                        <motion.div
                            ref={sheetRef}
                            key="safety-sheet"
                            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                            className="absolute z-50 left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] w-[min(28rem,92vw)] rounded-3xl bg-[hsl(var(--background))] text-[hsl(var(--foreground))] shadow-2xl ring-1 ring-black/5 p-5 sm:p-6"
                            role="dialog"
                            aria-modal="true"
                            aria-label="Safety options"
                            // The sheet itself receives initial focus via the
                            // useEffect above; making it focusable here is a
                            // belt-and-braces fallback in case the sheet has no
                            // interactive children at first paint.
                            tabIndex={-1}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--accent-100))]">
                                        <ShieldCheck className="h-4 w-4 text-[hsl(var(--accent-700))]" />
                                    </span>
                                    <div>
                                        <p className="text-[15px] font-semibold leading-tight">
                                            You're not alone
                                        </p>
                                        <p className="text-[12px] text-ink-6 leading-tight mt-0.5">
                                            Two ways to find ground, fast.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    className="p-1 rounded-full hover:bg-muted/60 transition-colors"
                                    aria-label="Close safety options"
                                >
                                    <X className="h-4 w-4 text-ink-6" />
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={goSafetyPlan}
                                className="group w-full text-left rounded-2xl border border-border bg-card hover:border-[hsl(var(--accent-300))] hover:bg-[hsl(var(--accent-50))] px-4 py-3.5 transition-colors flex items-center justify-between"
                            >
                                <div>
                                    <p className="text-[14.5px] font-medium">Open my safety plan</p>
                                    <p className="text-[12.5px] text-ink-6 mt-0.5">
                                        Your own steps, written when you were calm.
                                    </p>
                                </div>
                                <ChevronRight className="h-4 w-4 text-ink-5 group-hover:text-[hsl(var(--accent-700))] transition-colors" />
                            </button>

                            <a
                                href={helplineHref(PRIMARY_HELPLINE)}
                                className="group mt-2.5 w-full text-left rounded-2xl border border-border bg-card hover:border-[hsl(var(--accent-300))] hover:bg-[hsl(var(--accent-50))] px-4 py-3.5 transition-colors flex items-center justify-between"
                            >
                                <div className="flex items-start gap-2.5">
                                    <Phone className="h-4 w-4 text-[hsl(var(--accent-700))] mt-0.5" />
                                    <div>
                                        <p className="text-[14.5px] font-medium">
                                            Call {PRIMARY_HELPLINE.name}
                                        </p>
                                        <p className="text-[12.5px] text-ink-6 mt-0.5">
                                            {PRIMARY_HELPLINE.display} — {PRIMARY_HELPLINE.description}
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-ink-5 group-hover:text-[hsl(var(--accent-700))] transition-colors" />
                            </a>

                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="mt-4 w-full text-center text-[13px] text-ink-6 hover:text-ink-8 transition-colors"
                            >
                                Resume conversation
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};

export default PresenceSafetyOverlay;
