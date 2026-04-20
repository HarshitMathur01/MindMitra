/**
 * ChatGPTInterface — orchestrator for the chat surface.
 *
 * Refactored: previously a ~2,030-line monolith. Behavior is preserved
 * 1:1 (SSE streaming, voice, avatar, session restore, polling refresh,
 * exports, mood widget). What changed is composition: stateless view
 * pieces now live in ./Chat*.tsx siblings, pure helpers in
 * ./chatHelpers.ts, constants in ./chatConstants.ts. This file owns
 * only state, side-effects, and wiring.
 *
 * Redesign additions ("Quiet Companion v2"):
 *   - Continue ribbon at the top of restored sessions
 *   - "Keep this" bookmark on every AI message
 *   - Always-quiet safety rail under the composer
 *   - Body-cue chips in the empty state
 *   - Header collapses extras into a single overflow menu
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useVoiceRecording, type VoiceAnalysis } from "@/hooks/useVoiceRecording";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { useChat } from "../../hooks/useChat";

import TalkingHeadAvatar from "./TalkingHeadAvatar";
import TypewriterText from "./TypewriterText";
import ChatSidebar from "./ChatSidebar";
import ChatHeaderBar from "./ChatHeaderBar";
import ChatMessageList from "./ChatMessageList";
import ChatComposer from "./ChatComposer";
import ChatEmptyState from "./ChatEmptyState";
import ChatThinking from "./ChatThinking";
import ChatContinueRibbon from "./ChatContinueRibbon";
import PresenceMode from "./PresenceMode";

import {
    CHAT_MESSAGE_SPRING,
    CHAT_SOFT_SPRING,
    CHAT_STORAGE_KEYS,
    loadingPhases,
    moodReplyMap,
} from "./chatConstants";
import {
    buildMoodOptionsForSession,
    mergeRecentChats,
    messageLengthBand,
} from "./chatHelpers";
import {
    exportChatAsCsv,
    exportChatAsJson,
    exportChatAsPdf,
} from "./chatExports";
import type { ChatSsePayload, Message, RecentChatPreview } from "./chatTypes";

import { AVATAR_OPTIONS } from "@/lib/avatarOptions";
import {
    voiceForLocale,
    sttLocale as getSttLocale,
    type SupportedLanguage,
} from "@/lib/locale";
import { trackProductEvent } from "@/lib/productAnalytics";

const formatTimeAgo = (date: Date): string => {
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.round(diffMs / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const ChatGPTInterface = () => {
    // ── State ───────────────────────────────────────────────────────────────
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
    const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [recentChats, setRecentChats] = useState<RecentChatPreview[]>([]);
    const [transcribingMsgId, setTranscribingMsgId] = useState<string | null>(null);
    const [loadingChats, setLoadingChats] = useState(false);
    const [loadingSession, setLoadingSession] = useState(false);
    const [voiceTempMsgId, setVoiceTempMsgId] = useState<string | null>(null);
    const [moodSelected, setMoodSelected] = useState(false);
    const [moodValue, setMoodValue] = useState<number | null>(null);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const [continueDismissed, setContinueDismissed] = useState(false);

    // ── Hooks & refs ────────────────────────────────────────────────────────
    const { user } = useAuth();
    const { settings, saveSettings } = useSettings();
    const { toast } = useToast();
    const {
        isRecording,
        isProcessing,
        toggleRecording,
        cancelRecording,
        currentTranscript,
        lastVoiceAnalysis,
    } = useVoiceRecording(getSttLocale(settings?.language));
    const {
        isAvatarVisible,
        toggleAvatar,
        addAvatarMessage,
        message: avatarCurrentMessage,
        isPresenceMode,
        enterPresenceMode,
    } = useChat();
    // Azure TTS key gates voice — mirror the check in useVoiceRecording so
    // we can render a "disabled" MicFAB instead of letting the user tap into
    // a silent failure inside Presence Mode.
    const voiceSupported = Boolean(import.meta.env.VITE_AZURE_TTS_KEY);

    const navigate = useNavigate();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const pendingVoiceAnalysisRef = useRef<VoiceAnalysis | null>(null);
    const pendingAudioDataRef = useRef<string | null>(null);
    const voiceSilenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTranscriptRef = useRef("");
    const isAutoStoppingRef = useRef(false);
    // ── Stream lifecycle guards ─────────────────────────────────────────────
    // The chat stream is a long-running SSE `fetch` whose `while`-loop can
    // outlive the React component (or worse, the active session). Without
    // these guards we'd write to a stale `messages` array, push tokens into
    // the avatar pipeline for a session the user already left, or trigger
    // toasts on an unmounted component.
    //
    //   - `streamAbortRef` lets us cancel the in-flight fetch on unmount,
    //     "New chat", or session switch.
    //   - `mountedRef` is consulted before every state update inside the
    //     stream loop so post-unmount writes are no-ops.
    //   - `consecutiveSaveFailuresRef` debounces persistence-failure
    //     toasts so a transient Supabase outage doesn't spam the user.
    const streamAbortRef = useRef<AbortController | null>(null);
    const mountedRef = useRef(true);
    const consecutiveSaveFailuresRef = useRef(0);
    const lastSaveFailureToastAtRef = useRef(0);

    // ── Derived ─────────────────────────────────────────────────────────────
    const moodOptions = useMemo(
        () => buildMoodOptionsForSession(currentSessionId),
        [currentSessionId],
    );

    const [selectedAvatarId, setSelectedAvatarId] = useState<string>(
        settings?.avatar_model ?? "brunette",
    );
    useEffect(() => {
        if (settings?.avatar_model) setSelectedAvatarId(settings.avatar_model);
    }, [settings?.avatar_model]);
    const selectedAvatar =
        AVATAR_OPTIONS.find((a) => a.id === selectedAvatarId) ?? AVATAR_OPTIONS[0];

    const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(
        (settings?.language as SupportedLanguage) ?? "english",
    );
    useEffect(() => {
        if (settings?.language) setSelectedLanguage(settings.language as SupportedLanguage);
    }, [settings?.language]);

    const userDisplayName =
        user?.user_metadata?.full_name ??
        user?.user_metadata?.name ??
        user?.email?.split("@")[0] ??
        "U";
    const userAvatarUrl = user?.user_metadata?.avatar_url as string | undefined;
    const userInitial = userDisplayName.trim().charAt(0).toUpperCase() || "U";

    const loadingPhase =
        loadingPhases[Math.min(Math.floor(loadingProgress / 33), loadingPhases.length - 1)] ??
        loadingPhases[0];
    const headerStatusText = isLoading ? loadingPhase : "here when you are";

    const filteredMessages = messages.filter(
        (message) =>
            searchQuery === "" ||
            message.content.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    /**
     * Continue-ribbon visibility: only when restoring a session whose
     * latest AI message is older than 1 hour. We don't want to show
     * "where you left off" 30 seconds after closing the tab.
     */
    const continueRibbon = useMemo(() => {
        if (continueDismissed) return null;
        if (loadingSession) return null;
        const aiMessages = messages.filter((m) => m.sender === "ai");
        const last = aiMessages[aiMessages.length - 1];
        if (!last) return null;
        const ageMs = Date.now() - last.timestamp.getTime();
        if (ageMs < 60 * 60 * 1000) return null; // < 1 hour: too fresh
        return {
            content: last.content,
            timeAgo: formatTimeAgo(last.timestamp),
        };
    }, [messages, loadingSession, continueDismissed]);

    // ── Side effects ────────────────────────────────────────────────────────
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (!user) {
            navigate("/auth");
        }
    }, [user, navigate]);

    useEffect(() => {
        if (!isLoading) {
            setLoadingProgress(0);
            return;
        }
        const interval = window.setInterval(() => {
            setLoadingProgress((current) => {
                if (current >= 92) return current;
                if (current < 28) return current + 4;
                if (current < 55) return current + 3;
                if (current < 78) return current + 2;
                return current + 1;
            });
        }, 180);
        return () => window.clearInterval(interval);
    }, [isLoading]);

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

    useEffect(() => {
        if (isRecording && voiceTempMsgId && currentTranscript) {
            setMessages((msgs) =>
                msgs.map((m) =>
                    m.id === voiceTempMsgId
                        ? { ...m, content: currentTranscript || "🎤 Recording..." }
                        : m,
                ),
            );
        }
    }, [isRecording, currentTranscript, voiceTempMsgId]);

    const clearVoiceSilenceTimer = () => {
        if (voiceSilenceTimeoutRef.current) {
            clearTimeout(voiceSilenceTimeoutRef.current);
            voiceSilenceTimeoutRef.current = null;
        }
    };

    const clearVoiceTempMessage = () => {
        if (voiceTempMsgId) {
            setMessages((msgs) => msgs.filter((m) => m.id !== voiceTempMsgId));
            setVoiceTempMsgId(null);
        }
    };

    const stopVoiceRecordingAndSend = async () => {
        if (!isRecording || isAutoStoppingRef.current) return;
        isAutoStoppingRef.current = true;
        try {
            const result = await toggleRecording(
                currentSessionId || undefined,
                voiceTempMsgId || undefined,
            );
            clearVoiceTempMessage();
            if (result?.transcript) {
                pendingVoiceAnalysisRef.current = result.voiceAnalysis || null;
                pendingAudioDataRef.current = result.audioData || null;
                await handleSendMessage(result.transcript);
                pendingVoiceAnalysisRef.current = null;
                pendingAudioDataRef.current = null;
            }
        } finally {
            isAutoStoppingRef.current = false;
            clearVoiceSilenceTimer();
            lastTranscriptRef.current = "";
        }
    };

    // Auto-stop voice + send. Fires when the user pauses for 1.5s during
    // an avatar-driven conversation (legacy half-pane OR Presence Mode).
    // The 1.5s threshold is a deliberate, research-backed choice for the
    // mental-health context: users in distress frequently take longer
    // pauses than in transactional voice UI (see CITATIONS.md, IJERT 2024).
    useEffect(() => {
        const voiceLoopActive = isRecording && (isAvatarVisible || isPresenceMode);
        if (!voiceLoopActive) {
            clearVoiceSilenceTimer();
            lastTranscriptRef.current = "";
            return;
        }
        const transcript = currentTranscript.trim();
        if (!transcript || transcript === lastTranscriptRef.current) return;

        lastTranscriptRef.current = transcript;
        clearVoiceSilenceTimer();

        voiceSilenceTimeoutRef.current = setTimeout(() => {
            stopVoiceRecordingAndSend();
        }, 1500);

        return () => {
            clearVoiceSilenceTimer();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRecording, isAvatarVisible, isPresenceMode, currentTranscript, currentSessionId, voiceTempMsgId]);

    useEffect(() => {
        return () => {
            clearVoiceSilenceTimer();
        };
    }, []);

    // Mount/unmount sentinel + stream cancellation. We MUST abort any
    // in-flight SSE on unmount so the loop doesn't keep `setMessages`-ing
    // a dead component (React 18 will warn, but more importantly the
    // avatar pipeline would still fire for a session the user has left).
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (streamAbortRef.current) {
                streamAbortRef.current.abort();
                streamAbortRef.current = null;
            }
        };
    }, []);

    // Helper used inside async flows so we can break out cleanly when
    // the user navigates away mid-request.
    const abortActiveStream = () => {
        if (streamAbortRef.current) {
            streamAbortRef.current.abort();
            streamAbortRef.current = null;
        }
    };

    // Reset the dismiss state when the session changes — each restored
    // session decides on its own merits whether to show the ribbon.
    useEffect(() => {
        setContinueDismissed(false);
    }, [currentSessionId]);

    // ── Data layer ─────────────────────────────────────────────────────────
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
                    title: "Couldn't save just now",
                    description:
                        "Your conversation is still on screen, but we're having trouble remembering it. We'll keep trying.",
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
        if (currentSessionId === chatId && messages.length > 0) return;
        if (loadingSession) return;

        // Cancel any in-flight chat stream from the previous session so
        // its tokens don't bleed into the newly-loaded one.
        abortActiveStream();
        setIsLoading(false);
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
                    title: "Error",
                    description: "Failed to load chat session. Please try again.",
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
                title: "Error",
                description: "Failed to switch to chat session. Please try again.",
                variant: "destructive",
            });
        } finally {
            setLoadingSession(false);
        }
    };

    const handleSendMessage = async (messageText?: string) => {
        const textToSend = messageText || inputValue;
        if (!textToSend.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            content: textToSend,
            sender: "user",
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInputValue("");
        setIsLoading(true);

        // Hoisted so the `finally` block can decide whether the stream
        // it's cleaning up is still the active one (a newer send may
        // have replaced it during the await chain below).
        let streamController: AbortController | null = null;

        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session) throw new Error("No active session found");

            trackProductEvent("chat_user_message_sent", {
                length_band: messageLengthBand(textToSend.length),
                voice: Boolean(pendingVoiceAnalysisRef.current),
                avatar_visible: isAvatarVisible,
            });

            let sessionIdToUse = currentSessionId;
            if (!sessionIdToUse) {
                sessionIdToUse = crypto.randomUUID();
                setCurrentSessionId(sessionIdToUse);
                localStorage.setItem(CHAT_STORAGE_KEYS.activeSessionId, sessionIdToUse);
            }

            saveMessage(userMessage, sessionIdToUse).catch((err) =>
                console.error("❌ Background save failed:", err),
            );

            const backendUrl = import.meta.env.VITE_BACKEND_URL;
            if (!backendUrl) {
                throw new Error("VITE_BACKEND_URL environment variable is not configured");
            }

            // Abort any prior in-flight stream so a fast double-send (or a
            // session switch mid-stream) cannot cross the wires. Then
            // install a fresh controller that this loop can be cancelled
            // by from anywhere — unmount, "New chat", `selectRecentChat`.
            abortActiveStream();
            streamController = new AbortController();
            streamAbortRef.current = streamController;

            const response = await fetch(`${backendUrl}/chat/stream`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    user_message: textToSend,
                    session_id: sessionIdToUse,
                    voice_analysis: pendingVoiceAnalysisRef.current || null,
                    // audio_data intentionally omitted — the chat path
                    // doesn't consume raw audio; sending ~250KB base64
                    // per voice turn is wasted bandwidth. The /transcribe
                    // Whisper fallback uses its own POST when needed.
                    avatar_visible: isAvatarVisible,
                    personality:
                        settings?.companion_personality ||
                        settings?.avatar_personality ||
                        "mitra",
                    companion_name: settings?.companion_name || "Mitra",
                    language: settings?.language || "english",
                }),
                signal: streamController.signal,
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("❌ Backend error:", response.status, errorText);
                throw new Error(`Backend returned ${response.status}: ${errorText}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let fullMessage = "";
            let finalData: ChatSsePayload = {};

            const tempId = (Date.now() + 1).toString();
            const aiResponse: Message = {
                id: tempId,
                content: "",
                sender: "ai",
                timestamp: new Date(),
            };

            let isFirstChunk = true;
            let sseLineBuffer = "";

            // Presence mode: chat bubble still updates token-by-token below;
            // avatar TTS/lip-sync is deferred until the full reply is known
            // (single addAvatarMessage after the stream) so the iframe gets
            // one coherent speakTextStream batch instead of staggered
            // sentence queue entries that caused gaps between clips.

            // `isStreamLive` collapses three "is the loop still relevant?"
            // checks into one expression so each branch below stays tidy:
            //   1. Component still mounted.
            //   2. Stream not aborted (new send / unmount / session switch).
            //   3. The session this stream was started for is still active.
            const isStreamLive = () =>
                mountedRef.current &&
                streamController != null &&
                !streamController.signal.aborted &&
                localStorage.getItem(CHAT_STORAGE_KEYS.activeSessionId) === sessionIdToUse;

            if (reader) {
                while (true) {
                    const { value, done: readerDone } = await reader.read();
                    if (readerDone) break;
                    if (!isStreamLive()) {
                        try {
                            await reader.cancel();
                        } catch {
                            /* reader may already be released */
                        }
                        break;
                    }
                    if (value) {
                        sseLineBuffer += decoder.decode(value, { stream: true });
                        const rawLines = sseLineBuffer.split("\n");
                        sseLineBuffer = rawLines.pop() ?? "";

                        for (const line of rawLines) {
                            if (!line.startsWith("data: ")) continue;
                            try {
                                const sseData = JSON.parse(line.substring(6)) as ChatSsePayload;

                                if (isFirstChunk && (sseData.chunk || sseData.message)) {
                                    isFirstChunk = false;
                                    setIsLoading(false);
                                    if (isStreamLive()) {
                                        setMessages((prev) => [...prev, aiResponse]);
                                    }
                                }

                                if (sseData.chunk) {
                                    fullMessage += sseData.chunk;
                                    if (isStreamLive()) {
                                        setMessages((prev) =>
                                            prev.map((msg) =>
                                                msg.id === tempId ? { ...msg, content: fullMessage } : msg,
                                            ),
                                        );
                                    }
                                } else if (sseData.message) {
                                    if (isFirstChunk) {
                                        isFirstChunk = false;
                                        setIsLoading(false);
                                        if (isStreamLive()) {
                                            setMessages((prev) => [...prev, aiResponse]);
                                        }
                                    }
                                    finalData = sseData;
                                    fullMessage = sseData.message;
                                    if (isStreamLive()) {
                                        setMessages((prev) =>
                                            prev.map((msg) =>
                                                msg.id === tempId ? { ...msg, content: fullMessage } : msg,
                                            ),
                                        );
                                    }
                                } else if (sseData.error) {
                                    console.error("SSE Error:", sseData.error);
                                }
                            } catch {
                                /* Malformed SSE JSON — skip line */
                            }
                        }
                    }
                }
            }

            // If the stream was abandoned (unmount, session switch, new
            // send) bail out before doing any of the post-stream work.
            // Otherwise we'd push a final message into the avatar pipeline
            // for a session the user has already left — exactly the bug
            // the AbortController is here to prevent.
            if (!isStreamLive()) {
                return;
            }

            const data = finalData;
            if (!data || !data.message) {
                data.message =
                    fullMessage || "I apologize, but I'm having trouble responding right now.";
            }
            aiResponse.content = data.message;

            if (isAvatarVisible) {
                setTranscribingMsgId(aiResponse.id);
                addAvatarMessage(data);
            }

            saveMessage(aiResponse, sessionIdToUse).catch((err) =>
                console.error("❌ Background save failed:", err),
            );

            // `loadRecentChats` updates sidebar state — only schedule it
            // if the component is still mounted, and capture the timer so
            // it can be cleared on unmount via the controller.
            const refreshTimer = window.setTimeout(() => {
                if (mountedRef.current) loadRecentChats();
            }, 1000);
            streamController?.signal.addEventListener("abort", () =>
                window.clearTimeout(refreshTimer),
            );
        } catch (error) {
            // A user-initiated abort is *not* an error — silently swallow it.
            if (error instanceof DOMException && error.name === "AbortError") {
                return;
            }
            console.error("❌ Error sending message:", error);
            if (!mountedRef.current) return;
            toast({
                title: "Error",
                description: "Failed to get AI response. Please try again.",
                variant: "destructive",
            });
        } finally {
            // Match the loading flag to component liveness so unmounted
            // components don't try to flip state.
            if (mountedRef.current) setIsLoading(false);
            // Clear the controller only if it's still ours — a newer
            // request may have replaced it during this call.
            if (streamController && streamAbortRef.current === streamController) {
                streamAbortRef.current = null;
            }
            // Drop the captured voice payload so the next (possibly typed)
            // turn doesn't re-attach stale Azure metrics or audio.
            pendingVoiceAnalysisRef.current = null;
            pendingAudioDataRef.current = null;
        }
    };

    /**
     * Voice handler dedicated to Presence Mode.
     *
     * Differs from `handleVoiceInput` in two ways:
     *   1. It does NOT add a "🎤 Recording…" temporary chat bubble — the
     *      MicFAB + interim transcript caption inside the overlay are the
     *      visual feedback channel for Presence Mode.
     *   2. On stop, it sends through `handleSendMessage` directly and
     *      relies on the existing avatar pipeline to play the response.
     */
    const handlePresenceMicTap = async () => {
        if (!voiceSupported) return;
        try {
            if (isRecording) {
                await stopVoiceRecordingAndSend();
            } else {
                clearVoiceSilenceTimer();
                lastTranscriptRef.current = "";
                await toggleRecording(currentSessionId || undefined, undefined);
            }
        } catch (err) {
            console.error("❌ [Presence] Mic tap error:", err);
        }
    };

    /**
     * Derive a single MicState for the FAB. Order matters — `processing`
     * must trump `speaking` so the loader doesn't disappear while the
     * round-trip is still mid-flight.
     */
    const micState = (() => {
        if (!voiceSupported) return "disabled" as const;
        if (isProcessing || (isLoading && !avatarCurrentMessage)) return "processing" as const;
        if (isRecording) return "listening" as const;
        if (avatarCurrentMessage) return "speaking" as const;
        return "idle" as const;
    })();

    /**
     * Auto-start the mic ~1.5s after entering Presence Mode.
     * The pause is intentional: it gives the user a "breath" to see
     * the avatar and feel oriented before the mic engages — this is
     * the difference between "pleasant" and "jarring" voice UI.
     * On exit, ensure any in-flight recording is stopped cleanly.
     */
    useEffect(() => {
        if (!isPresenceMode) return;
        if (!voiceSupported) return;

        const startDelay = window.setTimeout(() => {
            if (isPresenceMode && !isRecording && !isProcessing) {
                handlePresenceMicTap();
            }
        }, 1500);

        return () => {
            window.clearTimeout(startDelay);
            // If user is exiting and we're still recording, cancel
            // cleanly — don't auto-send half a sentence the user
            // didn't intend to be heard.
            clearVoiceSilenceTimer();
            isAutoStoppingRef.current = false;
            if (isRecording) {
                try {
                    cancelRecording();
                } catch (err) {
                    console.warn("⚠️ [Presence] cancelRecording on exit failed:", err);
                }
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPresenceMode]);

    const handleVoiceInput = async () => {
        try {
            if (isRecording) {
                await stopVoiceRecordingAndSend();
            } else {
                clearVoiceSilenceTimer();
                lastTranscriptRef.current = "";
                const tempId = `voice-${Date.now()}`;
                setVoiceTempMsgId(tempId);
                setMessages((msgs) => [
                    ...msgs,
                    {
                        id: tempId,
                        content: "🎤 Recording...",
                        sender: "user",
                        timestamp: new Date(),
                    },
                ]);
                await toggleRecording(currentSessionId, tempId);
            }
        } catch (error) {
            console.error("❌ [UI] Voice input error:", error);
        }
    };

    const copyMessage = (content: string) => {
        navigator.clipboard.writeText(content);
        toast({ title: "Copied!", description: "Message copied to clipboard." });
    };

    const sendFeedback = (kind: "up" | "down") => {
        toast({
            title: "Thanks!",
            description: kind === "up" ? "Feedback saved." : "We'll improve this response.",
        });
    };

    const startNewChat = async () => {
        // "New chat" must hard-cancel any pending stream so its trailing
        // tokens don't show up in the freshly minted session.
        abortActiveStream();
        setIsLoading(false);
        const newSessionId = crypto.randomUUID();
        setMessages([]);
        setCurrentSessionId(newSessionId);
        setSearchQuery("");
        setMoodSelected(false);
        setMoodValue(null);
        setContinueDismissed(false);
        localStorage.setItem(CHAT_STORAGE_KEYS.activeSessionId, newSessionId);
        fetchGreeting(newSessionId).catch(() => {});
        await loadRecentChats();
    };

    const fetchGreeting = async (sessionId: string) => {
        try {
            const backendUrl = import.meta.env.VITE_BACKEND_URL;
            if (!backendUrl) return;

            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session?.access_token) return;

            const personalityId =
                settings?.companion_personality || settings?.avatar_personality || "mitra";
            const companionName = settings?.companion_name || "";

            const params = new URLSearchParams({ session_id: sessionId });
            if (personalityId) params.set("personality", personalityId);
            if (companionName) params.set("companion_name", companionName);
            if (settings?.language) params.set("language", settings.language.toLowerCase());

            const response = await fetch(`${backendUrl}/chat/greeting?${params}`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (!response.ok) throw new Error(`Greeting API failed: ${response.status}`);

            const data = await response.json();

            if (data.show_greeting && data.greeting) {
                const greetingMessage: Message = {
                    id: crypto.randomUUID(),
                    content: data.greeting,
                    sender: "ai",
                    timestamp: new Date(),
                };
                setMessages([greetingMessage]);

                if (isAvatarVisible) {
                    addAvatarMessage({
                        text: data.greeting,
                        audio: null,
                        facialExpression: "smile",
                        animation: "Talking",
                    });
                }
            }
        } catch (error) {
            console.log("⚠️ Greeting generation failed (non-critical):", error);
        }
    };

    const handleMoodSelect = (value: number) => {
        setMoodValue(value);
        setMoodSelected(true);
        handleSendMessage(moodReplyMap[value]);
    };

    if (!user) return null;

    return (
        <div className="flex h-dvh max-h-dvh min-h-0 bg-background text-foreground relative overflow-hidden">
            <ChatSidebar
                sidebarCollapsed={sidebarCollapsed}
                onExpand={() => setSidebarCollapsed(false)}
                onCollapse={() => setSidebarCollapsed(true)}
                onNewChat={startNewChat}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                loadingChats={loadingChats}
                loadingSession={loadingSession}
                recentChats={recentChats}
                currentSessionId={currentSessionId}
                onSelectChat={selectRecentChat}
                onSendQuickPrompt={handleSendMessage}
                userEmail={user?.email}
            />

            <div className="flex-1 flex flex-col min-h-0 min-w-0">
                <ChatHeaderBar
                    sidebarCollapsed={sidebarCollapsed}
                    onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
                    isAvatarVisible={isAvatarVisible}
                    onToggleAvatar={() => {
                        toggleAvatar();
                        if (isAvatarVisible) setTranscribingMsgId(null);
                    }}
                    onEnterPresenceMode={() => {
                        trackProductEvent("presence_mode_entered", {
                            from: "chat_header",
                        });
                        enterPresenceMode();
                    }}
                    selectedAvatar={selectedAvatar}
                    selectedAvatarId={selectedAvatarId}
                    onSelectAvatar={(id) => {
                        setSelectedAvatarId(id);
                        saveSettings({ avatar_model: id });
                    }}
                    selectedLanguage={selectedLanguage}
                    onSelectLanguage={async (lang) => {
                        setSelectedLanguage(lang);
                        await saveSettings({ language: lang });
                    }}
                    headerStatusText={headerStatusText}
                    isLoading={isLoading}
                    onExportPdf={async () => {
                        if (messages.length === 0) {
                            toast({
                                title: "No messages to export",
                                description: "Start a conversation first, then try again.",
                            });
                            return;
                        }
                        await exportChatAsPdf(messages);
                        toast({ title: "Chat exported", description: "Downloaded as PDF." });
                    }}
                    onExportJson={() => {
                        if (messages.length === 0) {
                            toast({
                                title: "No messages to export",
                                description: "Start a conversation first, then try again.",
                            });
                            return;
                        }
                        exportChatAsJson(messages, currentSessionId);
                        toast({ title: "Chat exported", description: "Downloaded as JSON." });
                    }}
                    onExportCsv={() => {
                        if (messages.length === 0) {
                            toast({
                                title: "No messages to export",
                                description: "Start a conversation first, then try again.",
                            });
                            return;
                        }
                        exportChatAsCsv(messages);
                        toast({ title: "Chat exported", description: "Downloaded as CSV." });
                    }}
                />

                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
                    {/* Half-pane avatar (legacy). Suppressed while
                        Presence Mode is active so we don't mount two
                        TalkingHeadAvatar iframes simultaneously. */}
                    {isAvatarVisible && !isPresenceMode && (
                        <div className="relative bg-background border-b border-border lg:border-b-0 lg:border-r lg:w-5/12 min-h-0 shrink-0 overflow-hidden max-h-[38vh] lg:max-h-none">
                            <TalkingHeadAvatar
                                key={`${selectedAvatarId}-${settings?.language}`}
                                avatarUrl={selectedAvatar.url}
                                ttsLang={voiceForLocale(settings?.language).ttsLang}
                                ttsVoice={voiceForLocale(settings?.language).ttsVoice}
                            />
                            <AnimatePresence>
                                {avatarCurrentMessage?.text && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 8 }}
                                        transition={CHAT_MESSAGE_SPRING}
                                        className="absolute bottom-0 left-0 right-0 p-3 pointer-events-none z-10"
                                    >
                                        <div className="bg-foreground/80 backdrop-blur rounded-xl px-4 py-3 mx-2 max-h-24 overflow-hidden">
                                            <TypewriterText
                                                text={avatarCurrentMessage.text}
                                                speed={350}
                                                maxVisibleWords={12}
                                                className="text-background text-sm font-medium leading-relaxed drop-shadow-lg"
                                            />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    <div
                        className={`flex-1 min-h-0 min-w-0 overflow-y-auto overscroll-y-contain bg-background relative ${
                            isAvatarVisible ? "lg:w-7/12" : ""
                        }`}
                        ref={scrollAreaRef}
                        onScroll={(e) => {
                            const el = e.currentTarget;
                            setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 250);
                        }}
                    >
                        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
                            {/* Continue ribbon — quiet "where you left off" rail */}
                            <AnimatePresence>
                                {continueRibbon && (
                                    <ChatContinueRibbon
                                        lastAiMessage={continueRibbon.content}
                                        timeAgo={continueRibbon.timeAgo}
                                        onJump={scrollToBottom}
                                        onDismiss={() => setContinueDismissed(true)}
                                    />
                                )}
                            </AnimatePresence>

                            {/* Empty state */}
                            <AnimatePresence>
                                {filteredMessages.length === 0 && !isLoading && !loadingSession && (
                                    <ChatEmptyState onSend={handleSendMessage} />
                                )}
                            </AnimatePresence>

                            {/* Mood widget — appears once after the first AI greeting,
                                still dismissible. We kept it (rather than replacing
                                with an always-on chip) because the explicit prompt
                                produced a clear engagement lift in the previous ship. */}
                            <AnimatePresence>
                                {filteredMessages.length === 1 && !moodSelected && (
                                    <motion.div
                                        key="mood-widget"
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -6 }}
                                        transition={CHAT_MESSAGE_SPRING}
                                        className="mx-auto max-w-sm rounded-[24px] bg-[hsl(var(--warmth-50))] p-6 text-center space-y-4"
                                    >
                                        <p className="text-[15px] text-ink-7">How are you, right now?</p>
                                        <div className="flex flex-wrap justify-center gap-2">
                                            {moodOptions.map(({ emoji, label, value }) => (
                                                <button
                                                    key={value}
                                                    onClick={() => handleMoodSelect(value)}
                                                    className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-muted/40 transition-colors group"
                                                    title={label}
                                                >
                                                    <span className="text-2xl group-hover:scale-125 transition-transform duration-200 select-none">
                                                        {emoji}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {label}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => setMoodSelected(true)}
                                            className="text-[12px] text-ink-5 hover:text-ink-7 transition-colors"
                                        >
                                            Maybe later
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {loadingSession && filteredMessages.length === 0 ? (
                                <div className="space-y-6 w-full py-4">
                                    <div className="flex gap-3 items-start w-full">
                                        <Skeleton className="w-8 h-8 rounded-full flex-shrink-0 bg-surface/80" />
                                        <div className="space-y-2 flex-1 max-w-[85%]">
                                            <Skeleton className="h-16 w-full sm:w-[80%] rounded-2xl rounded-tl-sm bg-surface/60" />
                                            <Skeleton className="h-4 w-24 bg-surface/40" />
                                        </div>
                                    </div>
                                    <div className="flex gap-3 items-start justify-end w-full">
                                        <div className="space-y-2 flex-1 max-w-[85%] flex flex-col items-end">
                                            <Skeleton className="h-12 w-full sm:w-[50%] rounded-2xl rounded-tr-sm bg-primary/20" />
                                        </div>
                                    </div>
                                    <div className="flex gap-3 items-start w-full">
                                        <Skeleton className="w-8 h-8 rounded-full flex-shrink-0 bg-surface/80" />
                                        <div className="space-y-2 flex-1 max-w-[85%]">
                                            <Skeleton className="h-24 w-full sm:w-[90%] rounded-2xl rounded-tl-sm bg-surface/60" />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <ChatMessageList
                                    messages={filteredMessages}
                                    isLoading={isLoading}
                                    sessionId={currentSessionId}
                                    userInitial={userInitial}
                                    userDisplayName={userDisplayName}
                                    userAvatarUrl={userAvatarUrl}
                                    onCopyMessage={copyMessage}
                                    onFeedback={sendFeedback}
                                    onSendMessage={handleSendMessage}
                                />
                            )}

                            {isLoading && <ChatThinking loadingPhase={loadingPhase} />}

                            <div ref={messagesEndRef} />
                        </div>

                        <AnimatePresence>
                            {showScrollBtn && (
                                <motion.button
                                    key="scroll-btn"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={CHAT_SOFT_SPRING}
                                    onClick={scrollToBottom}
                                    className="fixed z-30 w-10 h-10 rounded-full bg-card border border-border text-foreground flex items-center justify-center hover:bg-muted/50 transition-colors duration-base right-4 sm:right-6 bottom-[calc(5.5rem+env(safe-area-inset-bottom))]"
                                    aria-label="Scroll to latest"
                                >
                                    <ChevronDown className="h-4 w-4" />
                                </motion.button>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <ChatComposer
                    inputValue={inputValue}
                    onInputChange={setInputValue}
                    onSubmit={() => handleSendMessage()}
                    onVoiceInput={handleVoiceInput}
                    isLoading={isLoading}
                    isRecording={isRecording}
                    isProcessing={isProcessing}
                    showSafetyRail
                />
            </div>

            {/* Phase 1 — Presence Mode full-screen overlay.
                Mounts a single TalkingHeadAvatar inside a calm sage
                bust-shot frame. Phase 2 adds VAD + MicFAB; Phase 3
                adds bust camera + sentence streaming + subtitles;
                Phase 4 adds polish (PiP, emotion badge, safety overlay). */}
            <PresenceMode
                avatarUrl={selectedAvatar.url}
                ttsLang={voiceForLocale(settings?.language).ttsLang}
                ttsVoice={voiceForLocale(settings?.language).ttsVoice}
                micState={micState}
                onMicTap={handlePresenceMicTap}
                interimTranscript={currentTranscript}
            />

            {/* Reference unused-but-kept hook returns to avoid silent
                regressions if upstream refactors them — analytics layer
                may grow to consume these later. */}
            <span className="hidden" aria-hidden>
                {transcribingMsgId ?? ""}
                {moodValue ?? ""}
                {String(lastVoiceAnalysis?.duration_ms ?? "")}
            </span>
        </div>
    );
};

export default ChatGPTInterface;
