import { motion, AnimatePresence } from "framer-motion";
import {
    Plus,
    Search,
    MessageSquare,
    Home,
    User,
    MoreVertical,
    Settings,
    LogOut,
    Heart,
    ShieldCheck,
    Dumbbell,
    BookOpen,
    Phone,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import RecentChatItem from "./RecentChatItem";
import { CHAT_SOFT_SPRING } from "./chatConstants";
import type { RecentChatPreview } from "./chatTypes";
import { useLocalizedT } from "@/hooks/useLocalizedT";

/**
 * Sidebar shortcuts to other product surfaces. We intentionally route
 * to *real pages* (Memory & mood, Safety plan, Mind Gym, Resources,
 * Therapist bridge) rather than firing a generic "Tell me about X"
 * prompt, which previous UX testing showed felt like a chatbot
 * cul-de-sac with no real payoff.
 */
type SidebarShortcut = {
    label: string;
    icon: typeof Heart;
    path: string;
    accent?: boolean;
};

const sidebarShortcuts: SidebarShortcut[] = [
    { label: "Memory & mood", icon: Heart, path: "/me" },
    { label: "Safety plan", icon: ShieldCheck, path: "/safety-plan" },
    { label: "Mind Gym", icon: Dumbbell, path: "/mindgym" },
    { label: "Resources", icon: BookOpen, path: "/psychological-content" },
    { label: "Talk to a therapist", icon: Phone, path: "/therapist-bridge", accent: true },
];

interface ChatSidebarProps {
    sidebarCollapsed: boolean;
    onExpand: () => void;
    /**
     * Required so we can collapse the sidebar after a destination tap on
     * mobile (it overlays the chat surface there). Optional on desktop.
     */
    onCollapse?: () => void;
    onNewChat: () => void;
    searchQuery: string;
    onSearchChange: (q: string) => void;
    loadingChats: boolean;
    loadingSession: boolean;
    recentChats: RecentChatPreview[];
    currentSessionId: string | null;
    onSelectChat: (chatId: string) => void;
    onSendQuickPrompt: (prompt: string) => void;
    userEmail?: string | null;
}

const groupChatsByDate = (chats: RecentChatPreview[]) => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86_400_000).toDateString();
    return {
        today: chats.filter((c) => new Date(c.created_at).toDateString() === today),
        yesterday: chats.filter((c) => new Date(c.created_at).toDateString() === yesterday),
        earlier: chats.filter((c) => {
            const d = new Date(c.created_at).toDateString();
            return d !== today && d !== yesterday;
        }),
    };
};

const ChatSidebar = ({
    sidebarCollapsed,
    onExpand,
    onCollapse,
    onNewChat,
    searchQuery,
    onSearchChange,
    loadingChats,
    loadingSession,
    recentChats,
    currentSessionId,
    onSelectChat,
    onSendQuickPrompt,
    userEmail,
}: ChatSidebarProps) => {
    const navigate = useNavigate();
    const { t } = useLocalizedT();
    const grouped = groupChatsByDate(recentChats);

    /**
     * Helper that navigates and dismisses the sidebar — important on
     * mobile, where the sidebar overlays the chat surface and would
     * otherwise stay open after the user taps a destination.
     */
    const goAndClose = (path: string) => {
        navigate(path);
        onCollapse?.();
    };

    /**
     * Same logic for "send a prompt" actions: dismiss the sidebar on
     * mobile so the user immediately sees the model start replying.
     */
    const sendAndClose = (prompt: string) => {
        onSendQuickPrompt(prompt);
        onCollapse?.();
    };

    return (
        <>
            {/* ── Collapsed slim rail ────────────────────────────────────────
                Visible on lg+ only when the panel is collapsed. The slim
                rail's expand affordance is the MessageSquare button (the
                semantic "see your past chats" cue), so the only sidebar
                toggle on screen is the one already in the header. */}
            {sidebarCollapsed && (
                <aside className="hidden lg:flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-[hsl(var(--ink-1))] py-3">
                    <button
                        type="button"
                        onClick={onNewChat}
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                        aria-label={t("chat.sidebar.newAria", "Start new conversation")}
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={onExpand}
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                        aria-label={t("chat.sidebar.pastConversationsAria", "Past conversations")}
                        title={t("chat.sidebar.pastConversationsAria", "Past conversations")}
                    >
                        <MessageSquare className="h-4 w-4" />
                    </button>
                    <div className="mt-auto flex flex-col items-center gap-1">
                        <button
                            type="button"
                            onClick={() => navigate("/me")}
                            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                            aria-label={t("chat.sidebar.memoryMoodAria", "Memory & mood")}
                            title={t("chat.sidebar.memoryMoodAria", "Memory & mood")}
                        >
                            <Heart className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate("/")}
                            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                            aria-label={t("chat.sidebar.homeAria", "Home")}
                            title={t("chat.sidebar.homeAria", "Home")}
                        >
                            <Home className="h-4 w-4" />
                        </button>
                    </div>
                </aside>
            )}

            {/* ── Mobile backdrop ───────────────────────────────────────────
                The expanded sidebar overlays the chat on small screens; a
                tap-anywhere backdrop dismisses it. */}
            <AnimatePresence>
                {!sidebarCollapsed && (
                    <motion.div
                        key="chat-sidebar-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        onClick={onCollapse}
                        className="fixed inset-0 z-30 bg-foreground/30 backdrop-blur-sm lg:hidden"
                        aria-hidden
                    />
                )}
            </AnimatePresence>

            <motion.div
                initial={{ x: -24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={CHAT_SOFT_SPRING}
                className={`${
                    sidebarCollapsed
                        ? "w-0 lg:w-0"
                        : "fixed inset-y-0 left-0 z-40 w-[min(86vw,18rem)] shadow-2xl lg:static lg:w-72 lg:shadow-none"
                } transition-[width] duration-base bg-surface text-foreground flex flex-col min-h-0 border-r border-border overflow-hidden`}
            >
                <div className="p-4 border-b border-border bg-surface">
                    <Button
                        onClick={onNewChat}
                        className="w-full h-11 justify-start gap-2 text-[14px] font-medium"
                        variant="default"
                    >
                        <Plus className="h-4 w-4" strokeWidth={1.8} />
                        A new conversation
                    </Button>
                </div>

                <div className="p-4 border-b border-border/80">
                    <div className="relative group">
                        <Search
                            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-foreground transition-colors"
                            strokeWidth={1.8}
                        />
                        <Input
                            placeholder={t("chat.sidebar.searchPlaceholder", "Look back at something you said")}
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="h-11 rounded-full pl-10 bg-background border border-input text-foreground placeholder:text-muted-foreground text-[14px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        />
                    </div>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 custom-scrollbar">
                        {/* ── Recent conversations ──────────────────────── */}
                        <div>
                            <div className="flex items-center justify-between px-1 mb-2">
                                <h3 className="text-[12px] font-medium uppercase tracking-[0.16em] text-ink-5">
                                    your conversations
                                </h3>
                            </div>
                            <div className="space-y-0.5 max-h-[40vh] overflow-y-auto custom-scrollbar pr-1">
                                {loadingChats ? (
                                    <div className="space-y-2 py-2 px-1">
                                        <Skeleton className="h-9 w-full bg-ink-2 rounded-full" />
                                        <Skeleton className="h-9 w-[80%] bg-ink-2 rounded-full" />
                                        <Skeleton className="h-9 w-full bg-ink-2 rounded-full" />
                                    </div>
                                ) : recentChats.length === 0 ? (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="px-3 py-2 text-[13px] text-ink-5"
                                    >
                                        Nothing here yet. That&apos;s okay.
                                    </motion.div>
                                ) : (
                                    <AnimatePresence initial={false} mode="popLayout">
                                        {(["today", "yesterday", "earlier"] as const).map((group) => {
                                            const chats = grouped[group];
                                            if (!chats.length) return null;
                                            const label =
                                                group === "today"
                                                    ? "today"
                                                    : group === "yesterday"
                                                      ? "yesterday"
                                                      : "earlier";
                                            return (
                                                <div key={group}>
                                                    <span className="block text-[12px] text-ink-5 px-3 pt-2 pb-1">
                                                        {label}
                                                    </span>
                                                    {chats.map((chat) => (
                                                        <RecentChatItem
                                                            key={chat.id}
                                                            chat={chat}
                                                            isActive={currentSessionId === chat.id}
                                                            loadingSession={loadingSession}
                                                            onSelect={(id) => {
                                                                onSelectChat(id);
                                                                onCollapse?.();
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                            );
                                        })}
                                    </AnimatePresence>
                                )}
                            </div>
                        </div>

                        {/* ── Product shortcuts ─────────────────────────────
                            Real destinations rather than generic prompts. The
                            therapist-bridge link is highlighted because it's
                            an MVP we want users to actually find. */}
                        <div>
                            <h3 className="text-[12px] font-medium uppercase tracking-[0.16em] text-ink-5 px-1 mb-2">
                                go deeper
                            </h3>
                            <div className="space-y-0.5">
                                {sidebarShortcuts.map((sc) => {
                                    const Icon = sc.icon;
                                    return (
                                        <Button
                                            key={sc.path}
                                            variant="ghost"
                                            className={`w-full h-10 rounded-xl justify-start px-3 text-[13.5px] font-medium transition-all duration-200 ${
                                                sc.accent
                                                    ? "text-[hsl(var(--accent-700))] hover:bg-[hsl(var(--accent-100))]/60"
                                                    : "text-foreground hover:bg-muted/40"
                                            }`}
                                            onClick={() => goAndClose(sc.path)}
                                        >
                                            <Icon
                                                className={`h-4 w-4 mr-2.5 ${
                                                    sc.accent ? "text-[hsl(var(--accent-600))]" : ""
                                                }`}
                                                strokeWidth={1.8}
                                            />
                                            {sc.label}
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Tiny "open in chat" prompt — keeps a single
                            entry-point for users who want to type rather
                            than browse. */}
                        <button
                            type="button"
                            onClick={() => sendAndClose("Help me name what I'm feeling right now.")}
                            className="block w-full rounded-2xl border border-dashed border-border/60 px-3 py-3 text-left text-[13px] leading-snug text-ink-6 transition-colors hover:border-border hover:bg-muted/30"
                        >
                            <span className="block text-[11px] uppercase tracking-[0.16em] text-ink-5">
                                not sure where to start?
                            </span>
                            <span className="mt-1 block text-ink-7">
                                Help me name what I&apos;m feeling right now.
                            </span>
                        </button>
                    </div>

                    <div className="flex-shrink-0 border-t border-border pt-2 bg-surface px-3">
                        <div className="flex items-center justify-between px-1 py-2">
                            <button
                                type="button"
                                onClick={() => goAndClose("/profile")}
                                className="flex items-center gap-2 rounded-lg px-1 py-1 -mx-1 transition-colors hover:bg-background"
                                aria-label={t("chat.sidebar.openProfileAria", "Open profile")}
                            >
                                <div className="w-7 h-7 rounded-full bg-[hsl(var(--accent-100))] flex items-center justify-center">
                                    <User
                                        className="h-3.5 w-3.5 text-[hsl(var(--accent-600))]"
                                        strokeWidth={1.8}
                                    />
                                </div>
                                <span className="text-[13px] text-ink-7 truncate max-w-[150px]">
                                    {userEmail?.split("@")[0] || "you"}
                                </span>
                            </button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-ink-5 hover:text-ink-7 hover:bg-background transition-colors"
                                        aria-label={t("chat.sidebar.accountMenuAria", "Account menu")}
                                    >
                                        <MoreVertical className="h-4 w-4" strokeWidth={1.8} />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem onClick={() => goAndClose("/profile")}>
                                        <User className="h-4 w-4 mr-2" strokeWidth={1.8} />
                                        Profile
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => goAndClose("/settings")}>
                                        <Settings className="h-4 w-4 mr-2" strokeWidth={1.8} />
                                        Settings
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => supabase.auth.signOut()}>
                                        <LogOut className="h-4 w-4 mr-2" strokeWidth={1.8} />
                                        Sign out
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>
            </motion.div>
        </>
    );
};

export default ChatSidebar;
