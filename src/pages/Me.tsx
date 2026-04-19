import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
    BookmarkCheck,
    MessageSquare,
    ShieldCheck,
    Settings as SettingsIcon,
    ArrowRight,
    Sparkles,
    Trash2,
} from "lucide-react";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { PageShell } from "@/components/layout/PageShell";
import Pulse from "@/components/identity/Pulse";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { supabase } from "@/integrations/supabase/client";
import { DURATION, EASE } from "@/lib/redesign/tokens";
import {
    loadKeptMoments,
    toggleKeptMoment,
    type KeptMoment,
} from "@/components/chat/chatHelpers";

const eyebrow = "text-[11px] font-medium uppercase tracking-[0.2em] text-ink-5";

interface RecentSession {
    id: string;
    title: string;
    lastActivity: string;
    messageCount: number;
}

function formatRelativeDate(iso: string): string {
    const date = new Date(iso);
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86_400_000).toDateString();
    const d = date.toDateString();
    if (d === today) return "today";
    if (d === yesterday) return "yesterday";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * /me — "Memory & wellbeing".
 *
 * The single visible surface for the product's biggest claim — that
 * MindMitra is *personal*. We deliberately keep this page reflective,
 * not gamified: no streaks, no scores. What it shows:
 *
 *   1. Pulse hero — same identity as the chat, signals continuity.
 *   2. Safety plan card — entry point + status, pinned high.
 *   3. Saved moments — what the user explicitly kept ("Keep this").
 *   4. Recent conversations — quick re-entry + sense of history.
 *   5. What MindMitra remembers — short, honest summary of what
 *      the system actually knows (companion, language, personality),
 *      with a clear edit path.
 *
 * Network:
 *   - Recent sessions: aggregated from `chat_messages` (same shape as
 *     the chat sidebar — no new tables required).
 *   - Saved moments: localStorage today (cheap, instant); we'll mirror
 *     to a `kept_moments` table when cross-device sync is needed.
 */
export default function Me() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { settings } = useSettings();

    const [keptMoments, setKeptMoments] = useState<KeptMoment[]>([]);
    const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(false);

    useEffect(() => {
        setKeptMoments(loadKeptMoments().sort((a, b) => b.keptAt.localeCompare(a.keptAt)));
    }, []);

    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        const load = async () => {
            setLoadingSessions(true);
            try {
                const { data, error } = await supabase
                    .from("chat_messages")
                    .select("session_id, content, created_at, role")
                    .eq("user_id", user.id)
                    .not("session_id", "is", null)
                    .order("created_at", { ascending: false })
                    .limit(120);
                if (cancelled || error || !data) return;

                const sessionMap = new Map<string, RecentSession & { firstUser: string | null }>();
                for (const msg of data) {
                    if (!msg.session_id) continue;
                    if (!sessionMap.has(msg.session_id)) {
                        sessionMap.set(msg.session_id, {
                            id: msg.session_id,
                            title: "New conversation",
                            lastActivity: msg.created_at,
                            messageCount: 0,
                            firstUser: null,
                        });
                    }
                    const s = sessionMap.get(msg.session_id)!;
                    s.messageCount += 1;
                    if (msg.created_at > s.lastActivity) s.lastActivity = msg.created_at;
                    if (msg.role === "user") s.firstUser = msg.content;
                }

                const list = Array.from(sessionMap.values())
                    .map((s) => ({
                        id: s.id,
                        title: s.firstUser
                            ? s.firstUser.substring(0, 60) + (s.firstUser.length > 60 ? "…" : "")
                            : "New conversation",
                        lastActivity: s.lastActivity,
                        messageCount: s.messageCount,
                    }))
                    .sort(
                        (a, b) =>
                            new Date(b.lastActivity).getTime() -
                            new Date(a.lastActivity).getTime(),
                    )
                    .slice(0, 6);
                if (!cancelled) setRecentSessions(list);
            } finally {
                if (!cancelled) setLoadingSessions(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [user]);

    const handleUnkeep = (m: KeptMoment) => {
        toggleKeptMoment(m);
        setKeptMoments((prev) => prev.filter((x) => x.id !== m.id));
    };

    const goToSession = (sessionId: string) => {
        // Chat surface restores from this localStorage key on mount.
        localStorage.setItem("currentChatSession", sessionId);
        navigate("/chat");
    };

    const remembered = useMemo(() => {
        const items: { label: string; value: string }[] = [];
        const companion = settings?.companion_name?.trim();
        if (companion) items.push({ label: "Calls you", value: "you" });
        if (companion) items.push({ label: "Your companion's name", value: companion });
        const personality =
            settings?.companion_personality || settings?.avatar_personality;
        if (personality) items.push({ label: "Companion tone", value: personality });
        if (settings?.language)
            items.push({ label: "Conversation language", value: settings.language });
        if (settings?.avatar_model)
            items.push({ label: "Avatar", value: settings.avatar_model });
        if (items.length === 0) {
            items.push({
                label: "First-time here",
                value: "Nothing remembered yet — your settings will fill this in.",
            });
        }
        return items;
    }, [settings]);

    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground transition-colors duration-300">
            <Header />

            <PageShell>
                {/* ── Hero ───────────────────────────────────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: DURATION.long, ease: EASE.outExpo }}
                    className="grid items-center gap-6 pt-10 sm:grid-cols-[1fr_auto] sm:gap-10 sm:pt-14"
                >
                    <div className="min-w-0">
                        <p className={eyebrow}>You</p>
                        <h1 className="mt-2 text-balance font-display text-[clamp(1.85rem,4vw,2.5rem)] font-light leading-[1.1] tracking-tight text-ink-8">
                            Memory &amp; wellbeing.{" "}
                            <span className="text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]">
                                Quiet, yours.
                            </span>
                        </h1>
                        <p className="mt-4 max-w-prose text-[15px] leading-[1.7] text-ink-6">
                            What you&apos;ve kept, where you&apos;ve been, and what MindMitra
                            knows about you. Nothing here is shared. You can edit or remove
                            any of it, anytime.
                        </p>
                    </div>
                    <div className="hidden shrink-0 sm:block">
                        <Pulse size={132} state="idle" intensity={0.85} />
                    </div>
                </motion.section>

                {/* ── Safety plan card — pinned high, intentional anchor ─ */}
                <motion.section
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: DURATION.long, ease: EASE.outExpo, delay: 0.05 }}
                    className="mt-10"
                >
                    <button
                        type="button"
                        onClick={() => navigate("/safety-plan")}
                        className="group flex w-full items-center justify-between gap-4 rounded-[1.5rem] border border-border/40 bg-[hsl(var(--ink-1))] p-5 text-left transition-colors hover:bg-background sm:p-6"
                    >
                        <div className="flex items-start gap-4">
                            <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-[hsl(var(--accent-100))] text-[hsl(var(--accent-700))]">
                                <ShieldCheck className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                                <p className={eyebrow}>For your hardest moments</p>
                                <p className="mt-1 font-display text-[18px] text-ink-8">
                                    Your safety plan
                                </p>
                                <p className="mt-1 text-[14px] leading-[1.55] text-ink-6">
                                    A short plan you build once and keep with you — warning
                                    signs you recognise, things that help, people you can reach.
                                </p>
                            </div>
                        </div>
                        <ArrowRight className="hidden h-4 w-4 shrink-0 text-ink-5 transition-transform group-hover:translate-x-0.5 sm:inline-block" />
                    </button>
                </motion.section>

                {/* ── Saved moments + Recent conversations ───────────── */}
                <section className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
                    {/* Saved moments */}
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: DURATION.long, ease: EASE.outExpo, delay: 0.1 }}
                        className="rounded-[1.5rem] border border-border/40 bg-[hsl(var(--card))] p-5 sm:p-6"
                    >
                        <div className="flex items-center gap-2">
                            <BookmarkCheck className="h-4 w-4 text-[hsl(var(--accent-600))]" />
                            <h2 className="font-display text-[18px] text-ink-8">
                                Things you wanted to keep
                            </h2>
                        </div>
                        <p className="mt-1 text-[13px] text-ink-6">
                            Tap &quot;Keep this&quot; on any AI reply that lands well — they show up here.
                        </p>

                        <div className="mt-5 space-y-3">
                            {keptMoments.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-border/60 px-4 py-8 text-center text-[14px] text-ink-5">
                                    Nothing kept yet. That&apos;s okay — there&apos;s no quota.
                                </div>
                            ) : (
                                keptMoments.map((m) => (
                                    <div
                                        key={m.id}
                                        className="group rounded-2xl border border-border/40 bg-background p-4"
                                    >
                                        <p className="text-[14px] leading-[1.6] text-ink-7 whitespace-pre-wrap">
                                            {m.content}
                                        </p>
                                        <div className="mt-3 flex items-center justify-between gap-3">
                                            <span className="text-[11px] text-ink-5">
                                                kept {formatRelativeDate(m.keptAt)}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleUnkeep(m)}
                                                className="inline-flex items-center gap-1 text-[11px] text-ink-5 transition-colors hover:text-ink-7"
                                                aria-label="Remove this kept moment"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>

                    {/* Recent conversations */}
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: DURATION.long, ease: EASE.outExpo, delay: 0.15 }}
                        className="rounded-[1.5rem] border border-border/40 bg-[hsl(var(--card))] p-5 sm:p-6"
                    >
                        <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-ink-7" />
                            <h2 className="font-display text-[18px] text-ink-8">
                                Where you&apos;ve been
                            </h2>
                        </div>
                        <p className="mt-1 text-[13px] text-ink-6">
                            Pick up a thread, or start fresh.
                        </p>

                        <div className="mt-5 space-y-2">
                            {loadingSessions ? (
                                <>
                                    {[0, 1, 2].map((i) => (
                                        <div
                                            key={i}
                                            className="h-14 animate-pulse rounded-xl bg-[hsl(var(--ink-2))]"
                                        />
                                    ))}
                                </>
                            ) : recentSessions.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-border/60 px-4 py-8 text-center text-[14px] text-ink-5">
                                    No conversations yet.
                                </div>
                            ) : (
                                recentSessions.map((s) => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => goToSession(s.id)}
                                        className="group flex w-full items-start justify-between gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors hover:border-border/40 hover:bg-background"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-[14px] font-medium text-ink-8">
                                                {s.title}
                                            </p>
                                            <p className="mt-0.5 text-[11.5px] text-ink-5">
                                                {formatRelativeDate(s.lastActivity)} · {s.messageCount} messages
                                            </p>
                                        </div>
                                        <ArrowRight className="mt-1.5 h-3.5 w-3.5 shrink-0 text-ink-5 transition-transform group-hover:translate-x-0.5" />
                                    </button>
                                ))
                            )}
                        </div>

                        <Button
                            variant="ghost"
                            className="mt-4 w-full justify-center text-[13px]"
                            onClick={() => navigate("/chat")}
                        >
                            Start a new conversation
                        </Button>
                    </motion.div>
                </section>

                {/* ── What MindMitra remembers ──────────────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: DURATION.long, ease: EASE.outExpo, delay: 0.2 }}
                    className="mt-10 rounded-[1.5rem] border border-border/40 bg-[hsl(var(--card))] p-5 sm:p-6"
                >
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-[hsl(var(--accent-600))]" />
                                <h2 className="font-display text-[18px] text-ink-8">
                                    What MindMitra remembers about you
                                </h2>
                            </div>
                            <p className="mt-1 text-[13px] text-ink-6">
                                Plain, honest, editable. We never share this with anyone.
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0 gap-1.5"
                            onClick={() => navigate("/settings")}
                        >
                            <SettingsIcon className="h-3.5 w-3.5" />
                            Edit
                        </Button>
                    </div>

                    <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {remembered.map((item) => (
                            <div
                                key={item.label}
                                className="rounded-xl border border-border/40 bg-background px-4 py-3"
                            >
                                <dt className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-5">
                                    {item.label}
                                </dt>
                                <dd className="mt-1 text-[14px] text-ink-7 first-letter:capitalize">
                                    {item.value}
                                </dd>
                            </div>
                        ))}
                    </dl>

                    <p className="mt-5 text-[12px] text-ink-5">
                        Long-term memory of your conversations stays on the server, encrypted,
                        and is used only to make MindMitra feel like it knows you. You can
                        export or delete everything from{" "}
                        <button
                            type="button"
                            onClick={() => navigate("/settings")}
                            className="underline-offset-2 hover:text-ink-7 hover:underline"
                        >
                            Settings
                        </button>
                        .
                    </p>
                </motion.section>

                <div className="h-20" />
            </PageShell>

            <Footer />
        </div>
    );
}
