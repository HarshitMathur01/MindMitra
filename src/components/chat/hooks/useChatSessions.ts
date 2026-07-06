/**
 * useChatSessions — session identity, persistence, and the recent-chats
 * sidebar data for the chat surface.
 *
 * Owns: currentSessionId (+ localStorage mirror), recentChats/loadingChats,
 * loadingSession, the multi-tab activeSessionFlag broadcast, session restore
 * on login, the 10s sidebar polling loop, and the chat_messages reads/writes.
 *
 * The orchestrator stays in charge of the message timeline (setMessages) and
 * the in-flight HTTP request; it hands the hook two callbacks so ordering is
 * preserved exactly: onBeforeSwitch (abort active request + stop loading)
 * fires before any session switch, onNewChatReset clears the per-session UI
 * state (search, mood widget, continue ribbon) on "New chat".
 */

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useLocalizedT } from "@/hooks/useLocalizedT";

import { CHAT_STORAGE_KEYS } from "../chatConstants";
import { mergeRecentChats } from "../chatHelpers";
import type { Message, RecentChatPreview } from "../chatTypes";

export function useChatSessions({
    user,
    setMessages,
    hasMessages,
    onBeforeSwitch,
    onNewChatReset,
}: {
    user: User | null;
    setMessages: Dispatch<SetStateAction<Message[]>>;
    /** Whether the timeline currently has messages (guards a redundant re-select). */
    hasMessages: () => boolean;
    /** Abort the in-flight chat request + clear the loading flag. Runs before any switch. */
    onBeforeSwitch: () => void;
    /** Clear per-session UI state (search, mood widget, continue ribbon) on "New chat". */
    onNewChatReset: () => void;
}) {
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [recentChats, setRecentChats] = useState<RecentChatPreview[]>([]);
    const [loadingChats, setLoadingChats] = useState(false);
    const [loadingSession, setLoadingSession] = useState(false);

    const { toast } = useToast();
    const { t: tSanctuary } = useLocalizedT();

    const mountedRef = useRef(true);
    const consecutiveSaveFailuresRef = useRef(0);
    const lastSaveFailureToastAtRef = useRef(0);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Multi-tab coordination: advertise that a chat surface is open so other
    // tabs (and the session-end worker heuristics) can react.
    useEffect(() => {
        localStorage.setItem(CHAT_STORAGE_KEYS.activeSessionFlag, "true");
        window.dispatchEvent(
            new StorageEvent("storage", {
                key: CHAT_STORAGE_KEYS.activeSessionFlag,
                newValue: "true",
            }),
        );
        return () => {
            localStorage.removeItem(CHAT_STORAGE_KEYS.activeSessionFlag);
            window.dispatchEvent(
                new StorageEvent("storage", {
                    key: CHAT_STORAGE_KEYS.activeSessionFlag,
                    newValue: null,
                }),
            );
        };
    }, []);

    useEffect(() => {
        const savedSessionId = localStorage.getItem(CHAT_STORAGE_KEYS.activeSessionId);
        if (savedSessionId) setCurrentSessionId(savedSessionId);
    }, []);

    useEffect(() => {
        if (user) {
            loadRecentChats();
            const savedSessionId = localStorage.getItem(CHAT_STORAGE_KEYS.activeSessionId);
            if (savedSessionId) selectRecentChat(savedSessionId);
            else startNewChat();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    useEffect(() => {
        if (user) {
            const interval = setInterval(() => {
                if (!document.hidden) loadRecentChats();
            }, 10_000);
            return () => clearInterval(interval);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // Adopt the session id minted (or confirmed) by the backend on a turn.
    // No-op when unchanged so localStorage isn't rewritten on every response.
    const adoptSessionId = (id: string) => {
        if (!id || id === currentSessionId) return;
        setCurrentSessionId(id);
        localStorage.setItem(CHAT_STORAGE_KEYS.activeSessionId, id);
    };

    // Persistence is the contract that lets MindMitra honor "memory" —
    // dropping it silently breaks the entire personalisation loop. We
    // therefore (a) attempt the insert, (b) count consecutive failures, and
    // (c) surface a *single* calm toast after two back-to-back failures so
    // the user knows their words may not be remembered, without screaming
    // on every transient hiccup. Returns `true` on success.
    const saveMessage = async (message: Message, sessionId: string): Promise<boolean> => {
        if (!user) return false;
        try {
            const { error } = await supabase.from("chat_messages").insert({
                user_id: user.id,
                session_id: sessionId,
                content: message.content,
                sender: message.sender,
                role: message.sender === "user" ? "user" : "assistant",
            });
            if (error) throw error;
            consecutiveSaveFailuresRef.current = 0;
            return true;
        } catch (error) {
            consecutiveSaveFailuresRef.current += 1;
            console.error("❌ Failed to save message:", error);
            // Debounced user-facing notice: only after two consecutive
            // failures, and at most once per 30s, so a flaky network
            // doesn't drown the conversation in red toasts.
            const now = Date.now();
            if (
                mountedRef.current &&
                consecutiveSaveFailuresRef.current >= 2 &&
                now - lastSaveFailureToastAtRef.current > 30_000
            ) {
                lastSaveFailureToastAtRef.current = now;
                toast({
                    title: tSanctuary("chat.toasts.saveFailure.title"),
                    description: tSanctuary("chat.toasts.saveFailure.description"),
                });
            }
            return false;
        }
    };

    const loadRecentChats = async () => {
        if (!user) return;
        setLoadingChats(true);
        try {
            const { data, error } = await supabase
                .from("chat_messages")
                .select("session_id, content, created_at, role")
                .eq("user_id", user.id)
                .not("session_id", "is", null)
                .order("created_at", { ascending: false });

            if (error) {
                console.error("❌ Error loading chat messages:", error);
                return;
            }

            if (!data || data.length === 0) {
                setRecentChats([]);
                return;
            }

            const sessionMap = new Map<
                string,
                {
                    id: string;
                    messages: typeof data;
                    firstUserMessage: string | null;
                    lastActivity: string;
                    messageCount: number;
                }
            >();

            data.forEach((msg) => {
                if (!msg.session_id) return;
                if (!sessionMap.has(msg.session_id)) {
                    sessionMap.set(msg.session_id, {
                        id: msg.session_id,
                        messages: [],
                        firstUserMessage: null,
                        lastActivity: msg.created_at,
                        messageCount: 0,
                    });
                }
                const session = sessionMap.get(msg.session_id)!;
                session.messages.push(msg);
                session.messageCount++;
                if (msg.created_at > session.lastActivity) session.lastActivity = msg.created_at;
                // Descending fetch → overwriting leaves the OLDEST user
                // message as the stable session title.
                if (msg.role === "user") session.firstUserMessage = msg.content;
            });

            const existingTitlesById = new Map(recentChats.map((chat) => [chat.id, chat.title]));

            const chatList = Array.from(sessionMap.values())
                .filter((s) => s.messageCount > 0)
                .map((session) => ({
                    id: session.id,
                    title:
                        existingTitlesById.get(session.id) ??
                        (session.firstUserMessage
                            ? session.firstUserMessage.substring(0, 50) +
                            (session.firstUserMessage.length > 50 ? "..." : "")
                            : "New Chat"),
                    created_at: session.lastActivity,
                    messageCount: session.messageCount,
                }))
                .sort(
                    (a, b) =>
                        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
                )
                .slice(0, 20);

            setRecentChats((prev) => mergeRecentChats(prev, chatList));
        } catch (error) {
            console.error("❌ Failed to load recent chats:", error);
        } finally {
            setLoadingChats(false);
        }
    };

    const selectRecentChat = async (chatId: string) => {
        if (currentSessionId === chatId && hasMessages()) return;
        if (loadingSession) return;

        // Cancel any in-flight chat request from the previous session so
        // its response doesn't bleed into the newly-loaded one.
        onBeforeSwitch();
        setLoadingSession(true);
        try {
            setMessages([]);
            const { data, error } = await supabase
                .from("chat_messages")
                .select("id, content, role, created_at")
                .eq("session_id", chatId)
                .eq("user_id", user?.id)
                .order("created_at", { ascending: true });

            if (error) {
                console.error("❌ Error loading session messages:", error);
                toast({
                    title: tSanctuary("chat.toasts.sessionLoadError.title"),
                    description: tSanctuary("chat.toasts.sessionLoadError.description"),
                    variant: "destructive",
                });
                return;
            }

            const sessionMessages: Message[] =
                data?.map((msg) => ({
                    id: msg.id,
                    content: msg.content,
                    sender: (msg.role === "user" ? "user" : "ai") as "user" | "ai",
                    timestamp: new Date(msg.created_at),
                })) || [];

            setCurrentSessionId(chatId);
            localStorage.setItem(CHAT_STORAGE_KEYS.activeSessionId, chatId);
            setMessages(sessionMessages);
        } catch (error) {
            console.error("❌ Failed to load session messages:", error);
            toast({
                title: tSanctuary("chat.toasts.sessionSwitchError.title"),
                description: tSanctuary("chat.toasts.sessionSwitchError.description"),
                variant: "destructive",
            });
        } finally {
            setLoadingSession(false);
        }
    };

    const startNewChat = async () => {
        // "New chat" must hard-cancel any pending request so its response
        // doesn't show up in the freshly minted session.
        onBeforeSwitch();
        const newSessionId = "new"; // v3 will mint a fresh UUID on first turn
        setMessages([]);
        setCurrentSessionId(null);
        onNewChatReset();
        localStorage.removeItem(CHAT_STORAGE_KEYS.activeSessionId);
        await loadRecentChats();
        // v3 dropped the standalone greeting endpoint — the empty state
        // already renders a calm welcome surface, and the LLM responds on
        // the user's first turn. We intentionally avoid the pre-emptive
        // greeting fetch to keep cold-start latency under 300ms.
        void newSessionId;
    };

    return {
        currentSessionId,
        adoptSessionId,
        recentChats,
        loadingChats,
        loadingSession,
        saveMessage,
        loadRecentChats,
        selectRecentChat,
        startNewChat,
    };
}
