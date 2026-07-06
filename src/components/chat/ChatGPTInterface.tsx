/**
 * ChatGPTInterface — orchestrator for the chat surface.
 *
 * Migrated to the simplified MHA v3 HTTP path: chat traffic now flows through
 * `POST /chat`. The surface still owns its local message state and persists
 * turns into `chat_messages` so the sidebar / recent-chats UX is unchanged.
 *
 * Voice, avatar, session restore, polling refresh, exports and the
 * mood widget are unchanged. The empty-state "first AI greeting" is now
 * lazy: the v3 stack only speaks after the user sends their first turn
 * (the spec dropped the standalone greeting endpoint).
 */

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useVoiceRecording, type VoiceAnalysis } from "@/hooks/useVoiceRecording";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { useLocalizedT } from "@/hooks/useLocalizedT";
import { useChat } from "../../hooks/useChat";

import ChatSidebar from "./ChatSidebar";
import ChatHeaderBar from "./ChatHeaderBar";
import ChatMessageList from "./ChatMessageList";
import ChatComposer from "./ChatComposer";
import ChatEmptyState from "./ChatEmptyState";
import ChatThinking from "./ChatThinking";
import ChatContinueRibbon from "./ChatContinueRibbon";
import ActivitySuggestionPanel, {
    ActivitySuggestionPill,
} from "./ActivitySuggestionPanel";
import { useActivitySuggestion } from "@/hooks/useActivitySuggestion";
import {
    clearChatHandoff,
    parseSuggestionFromMeta,
    readChatHandoff,
    type ChatActivityHandoff,
} from "@/lib/chat/activitySuggestion";
import { postChatTurn, postResponseLog } from "@/lib/chat/chatTransport";
import ChatAvatarPane from "./ChatAvatarPane";
import ChatMoodWidget from "./ChatMoodWidget";
import ChatReturnBanner from "./ChatReturnBanner";

import {
    CHAT_SOFT_SPRING,
    CHAT_STORAGE_KEYS,
    moodReplyMap,
} from "./chatConstants";
import { useLoadingPhases, useMoodOptions } from "./chatI18n";
import { useChatPersonalization } from "@/hooks/useChatPersonalization";
import { parseTurnMeta, type TurnMeta } from "@/lib/chat/turnPersonalization";
import {
    mergeRecentChats,
    messageLengthBand,
} from "./chatHelpers";
import {
    exportChatAsCsv,
    exportChatAsJson,
    exportChatAsPdf,
} from "./chatExports";
import type { Message, RecentChatPreview } from "./chatTypes";

import { AVATAR_OPTIONS, normalizeAvatarModelId } from "@/lib/avatarOptions";
import {
    voiceForLocale,
    sttLocale as getSttLocale,
    type SupportedLanguage,
} from "@/lib/locale";
import { trackProductEvent } from "@/lib/productAnalytics";

const PresenceMode = lazy(() => import("./PresenceMode"));

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

const PRESENCE_START_DELAY_MS = 1400;
const NO_INPUT_TIMEOUT_MS = 10_000;
const END_OF_TURN_SILENCE_MS = 2200;
const SHORT_UTTERANCE_EXTRA_MS = 800;
const MAX_RECORDING_MS = 60_000;

const looksLikeIncompleteVoiceTurn = (text: string): boolean => {
    const trimmed = text.trim();
    if (trimmed.length < 18) return true;
    return /\b(and|but|because|so|then|like|matlab|ki|to|aur)$/i.test(trimmed);
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
    const [activityPanelOpen, setActivityPanelOpen] = useState(false);
    const [latestUrgency, setLatestUrgency] = useState(0);
    const [latestTraceId, setLatestTraceId] = useState<string | undefined>(undefined);
    const [latestTurnMeta, setLatestTurnMeta] = useState<TurnMeta | null>(null);
    const [returnHandoff, setReturnHandoff] = useState<ChatActivityHandoff | null>(null);
    const activitySuggestion = useActivitySuggestion();
    const { t: tSanctuary } = useLocalizedT();
    const personalization = useChatPersonalization(latestTurnMeta);

    // On mount, detect a completed chat → activity handoff. If the user
    // finished a tool launched from chat, surface a small "how did it land?"
    // QuickReplies chip set just above the composer.
    useEffect(() => {
        const handoff = readChatHandoff();
        if (handoff && handoff.completed) {
            setReturnHandoff(handoff);
        }
    }, []);

    // ── Hooks & refs ────────────────────────────────────────────────────────
    const { user, loading: authLoading } = useAuth();
    const { settings, saveSettings } = useSettings();
    const { toast } = useToast();
    const toastRef = useRef(toast);
    toastRef.current = toast;
    const {
        isRecording,
        isProcessing,
        toggleRecording,
        cancelRecording,
        currentTranscript,
        hasTranscript,
        lastTranscriptAt,
        lastVoiceAnalysis,
        noMatchCount,
        azureError,
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
    const avatarPlaybackEnabledRef = useRef(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const pendingVoiceAnalysisRef = useRef<VoiceAnalysis | null>(null);
    const pendingAudioDataRef = useRef<string | null>(null);
    const voiceSilenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const voiceNoInputTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const voiceMaxDurationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const presenceStartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTranscriptRef = useRef("");
    const hasTranscriptRef = useRef(false);
    const presenceAutoListenPausedRef = useRef(false);
    const wasPresenceModeRef = useRef(false);
    const isAutoStoppingRef = useRef(false);
    // ── Request lifecycle guards ────────────────────────────────────────────
    // The chat request can outlive the React component. Keep one AbortController
    // for the active turn so navigation/session switches do not write stale UI.
    const activeChatRequestRef = useRef<AbortController | null>(null);
    const mountedRef = useRef(true);
    const consecutiveSaveFailuresRef = useRef(0);
    const lastSaveFailureToastAtRef = useRef(0);

    // ── Derived ─────────────────────────────────────────────────────────────
    const moodOptions = useMoodOptions(currentSessionId);

    const [selectedAvatarId, setSelectedAvatarId] = useState<string>(
        normalizeAvatarModelId(settings?.avatar_model),
    );
    useEffect(() => {
        if (settings?.avatar_model) setSelectedAvatarId(normalizeAvatarModelId(settings.avatar_model));
    }, [settings?.avatar_model]);
    const selectedAvatar =
        AVATAR_OPTIONS.find((a) => a.id === selectedAvatarId) ?? AVATAR_OPTIONS[0];
    const selectedAvatarCameraView = selectedAvatar.id === "olaf" ? "mid" : undefined;
    const localeVoice = voiceForLocale(settings?.language);
    const effectiveTtsVoice = selectedAvatar.ttsVoice ?? localeVoice.ttsVoice;
    const effectiveTtsLang = selectedAvatar.ttsLang ?? localeVoice.ttsLang;

    useEffect(() => {
        avatarPlaybackEnabledRef.current = isAvatarVisible || isPresenceMode;
    }, [isAvatarVisible, isPresenceMode]);

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

    const defaultLoadingPhases = useLoadingPhases();
    const activeLoadingPhases = personalization.loadingPhases.length
        ? personalization.loadingPhases
        : defaultLoadingPhases;
    const loadingPhase =
        activeLoadingPhases[
            Math.min(Math.floor(loadingProgress / 33), activeLoadingPhases.length - 1)
        ] ?? activeLoadingPhases[0];
    const headerStatusText = isLoading ? loadingPhase : tSanctuary("chat.header.statusIdle");

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
        if (!authLoading && !user) {
            navigate("/auth");
        }
    }, [authLoading, user, navigate]);

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
                        ? { ...m, content: currentTranscript || tSanctuary("chat.voice.recording") }
                        : m,
                ),
            );
        }
    }, [isRecording, currentTranscript, voiceTempMsgId, tSanctuary]);

    useEffect(() => {
        hasTranscriptRef.current = hasTranscript;
    }, [hasTranscript]);

    useEffect(() => {
        if (isPresenceMode && !wasPresenceModeRef.current) {
            presenceAutoListenPausedRef.current = false;
        }
        if (!isPresenceMode) {
            presenceAutoListenPausedRef.current = false;
        }
        wasPresenceModeRef.current = isPresenceMode;
    }, [isPresenceMode]);

    const clearVoiceSilenceTimer = () => {
        if (voiceSilenceTimeoutRef.current) {
            clearTimeout(voiceSilenceTimeoutRef.current);
            voiceSilenceTimeoutRef.current = null;
        }
        if (voiceNoInputTimeoutRef.current) {
            clearTimeout(voiceNoInputTimeoutRef.current);
            voiceNoInputTimeoutRef.current = null;
        }
        if (voiceMaxDurationTimeoutRef.current) {
            clearTimeout(voiceMaxDurationTimeoutRef.current);
            voiceMaxDurationTimeoutRef.current = null;
        }
        if (presenceStartTimeoutRef.current) {
            clearTimeout(presenceStartTimeoutRef.current);
            presenceStartTimeoutRef.current = null;
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

    // Voice endpointing: wait longer for short/incomplete utterances, but do
    // not leave the mic open indefinitely if the user says nothing.
    useEffect(() => {
        if (!isRecording) {
            clearVoiceSilenceTimer();
            lastTranscriptRef.current = "";
            return;
        }

        voiceMaxDurationTimeoutRef.current = setTimeout(() => {
            stopVoiceRecordingAndSend();
        }, MAX_RECORDING_MS);

        voiceNoInputTimeoutRef.current = setTimeout(() => {
            if (!hasTranscriptRef.current) {
                presenceAutoListenPausedRef.current = isPresenceMode;
                stopVoiceRecordingAndSend();
            }
        }, NO_INPUT_TIMEOUT_MS);

        return () => {
            clearVoiceSilenceTimer();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRecording]);

    useEffect(() => {
        if (hasTranscript && voiceNoInputTimeoutRef.current) {
            clearTimeout(voiceNoInputTimeoutRef.current);
            voiceNoInputTimeoutRef.current = null;
        }
    }, [hasTranscript]);

    useEffect(() => {
        const voiceLoopActive = isRecording && (isAvatarVisible || isPresenceMode);
        if (!voiceLoopActive) {
            if (voiceSilenceTimeoutRef.current) {
                clearTimeout(voiceSilenceTimeoutRef.current);
                voiceSilenceTimeoutRef.current = null;
            }
            return;
        }
        const transcript = currentTranscript.trim();
        if (!transcript || transcript === lastTranscriptRef.current) return;

        lastTranscriptRef.current = transcript;
        if (voiceSilenceTimeoutRef.current) {
            clearTimeout(voiceSilenceTimeoutRef.current);
            voiceSilenceTimeoutRef.current = null;
        }

        const delay =
            END_OF_TURN_SILENCE_MS +
            (looksLikeIncompleteVoiceTurn(transcript) ? SHORT_UTTERANCE_EXTRA_MS : 0);
        voiceSilenceTimeoutRef.current = setTimeout(() => {
            stopVoiceRecordingAndSend();
        }, delay);

        return () => {
            if (voiceSilenceTimeoutRef.current) {
                clearTimeout(voiceSilenceTimeoutRef.current);
                voiceSilenceTimeoutRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRecording, isAvatarVisible, isPresenceMode, currentTranscript, lastTranscriptAt, currentSessionId, voiceTempMsgId]);

    useEffect(() => {
        return () => {
            clearVoiceSilenceTimer();
        };
    }, []);

    // Mount/unmount sentinel + HTTP request cleanup.
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            activeChatRequestRef.current?.abort();
            activeChatRequestRef.current = null;
        };
    }, []);

    // Helper used inside async flows so we can break out cleanly when
    // the user navigates away mid-request.
    const abortActiveRequest = () => {
        activeChatRequestRef.current?.abort();
        activeChatRequestRef.current = null;
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
        if (currentSessionId === chatId && messages.length > 0) return;
        if (loadingSession) return;

        // Cancel any in-flight chat request from the previous session so
        // its response doesn't bleed into the newly-loaded one.
        abortActiveRequest();
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

        let resolvedAiResponse: Message | null = null;

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

            const requestedSessionId = currentSessionId || "new";

            // Cancel any prior in-flight turn so a fast double-send (or a
            // session switch mid-request) cannot cross the wires.
            abortActiveRequest();

            const aiMessageId = (Date.now() + 1).toString();
            const aiResponse: Message = {
                id: aiMessageId,
                content: "",
                sender: "ai",
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, aiResponse]);

            const controller = new AbortController();
            activeChatRequestRef.current = controller;
            const finalText = await postChatTurn({
                accessToken: session.access_token,
                content: textToSend,
                sessionId: requestedSessionId,
                deviceLocale: navigator.language,
                language: selectedLanguage,
                signal: controller.signal,
            });
            activeChatRequestRef.current = null;

            if (!mountedRef.current) return;

            if (finalText.session_id && finalText.session_id !== currentSessionId) {
                setCurrentSessionId(finalText.session_id);
                localStorage.setItem(CHAT_STORAGE_KEYS.activeSessionId, finalText.session_id);
            }

            // Surface the deterministic activity suggestion (if any) to the
            // right-rail panel. The hook owns crisis suppression internally.
            setLatestUrgency(finalText.urgency ?? 0);
            setLatestTraceId(finalText.trace_id);
            setLatestTurnMeta(
                parseTurnMeta(finalText.meta, finalText.urgency ?? 0),
            );
            activitySuggestion.pushFromTurn({
                suggestion: parseSuggestionFromMeta(finalText.meta),
                urgency: finalText.urgency ?? 0,
                trace_id: finalText.trace_id,
                session_id: finalText.session_id,
            });

            const finalMessage =
                finalText.text ||
                tSanctuary("chat.errors.aiFallback");
            const finalAi: Message = { ...aiResponse, content: finalMessage };
            resolvedAiResponse = finalAi;
            setMessages((prev) =>
                prev.map((msg) => (msg.id === aiMessageId ? finalAi : msg)),
            );

            if (avatarPlaybackEnabledRef.current) {
                postResponseLog("avatar.queue", {
                    id: aiMessageId.slice(0, 8),
                    chars: finalMessage.length,
                    mode: finalText.mode,
                    urgency: finalText.urgency,
                    source: finalText.source,
                    totalMs: finalText.timings_ms?.total_ms,
                    llmMs: finalText.timings_ms?.llm_ms,
                });
                setTranscribingMsgId(aiMessageId);
                addAvatarMessage({
                    id: aiMessageId,
                    utteranceId: aiMessageId,
                    text: finalMessage,
                    content: finalMessage,
                    audio: null,
                    facialExpression: "default",
                    animation: "Talking",
                });
            }

            const persistedSessionId = finalText.session_id || currentSessionId;
            if (!persistedSessionId) {
                throw new Error("Chat response did not include a session_id");
            }

            saveMessage(userMessage, persistedSessionId).catch((err) =>
                console.error("❌ Background save failed:", err),
            );
            saveMessage(finalAi, persistedSessionId).catch((err) =>
                console.error("❌ Background save failed:", err),
            );

            const refreshTimer = window.setTimeout(() => {
                if (mountedRef.current) loadRecentChats();
            }, 1000);
            // Clear the timer later if the component stays mounted long enough.
            window.setTimeout(() => window.clearTimeout(refreshTimer), 5000);
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                return;
            }
            if (error instanceof Error && error.message === "aborted_by_user") {
                return;
            }
            if (error instanceof Error && error.message === "component_unmounted") {
                return;
            }
            console.error("❌ Error sending message:", error);
            if (!mountedRef.current) return;
            toast({
                title: tSanctuary("chat.toasts.chatServiceError.title"),
                description: tSanctuary("chat.toasts.chatServiceError.description"),
                variant: "destructive",
            });
        } finally {
            activeChatRequestRef.current = null;
            if (mountedRef.current) setIsLoading(false);
            // Drop the captured voice payload so the next (possibly typed)
            // turn doesn't re-attach stale Azure metrics or audio.
            pendingVoiceAnalysisRef.current = null;
            pendingAudioDataRef.current = null;
            // Help the type checker — `resolvedAiResponse` is kept around
            // only so future hooks can read the final committed message.
            void resolvedAiResponse;
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
            } else if (isProcessing || isLoading || avatarCurrentMessage) {
                // No automatic barge-in yet: don't start STT while Mitra is
                // thinking or speaking, because TTS cancellation is separate.
                return;
            } else {
                clearVoiceSilenceTimer();
                lastTranscriptRef.current = "";
                presenceAutoListenPausedRef.current = false;
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
     * Presence Mode auto-listen. Starts on entry and after each avatar turn,
     * but only when the UI is genuinely idle and the prior no-input turn did
     * not pause auto-listening.
     */
    useEffect(() => {
        if (
            !isPresenceMode ||
            !voiceSupported ||
            isRecording ||
            isProcessing ||
            isLoading ||
            avatarCurrentMessage ||
            presenceAutoListenPausedRef.current
        ) {
            if (presenceStartTimeoutRef.current) {
                clearTimeout(presenceStartTimeoutRef.current);
                presenceStartTimeoutRef.current = null;
            }
            return;
        }

        presenceStartTimeoutRef.current = setTimeout(() => {
            presenceStartTimeoutRef.current = null;
            if (
                isPresenceMode &&
                voiceSupported &&
                !isRecording &&
                !isProcessing &&
                !isLoading &&
                !avatarCurrentMessage &&
                !presenceAutoListenPausedRef.current
            ) {
                clearVoiceSilenceTimer();
                lastTranscriptRef.current = "";
                toggleRecording(currentSessionId || undefined, undefined).catch((err) => {
                    console.error("❌ [Presence] Auto-start failed:", err);
                });
            }
        }, PRESENCE_START_DELAY_MS);

        return () => {
            if (presenceStartTimeoutRef.current) {
                clearTimeout(presenceStartTimeoutRef.current);
                presenceStartTimeoutRef.current = null;
            }
        };
    }, [isPresenceMode, voiceSupported, isRecording, isProcessing, isLoading, avatarCurrentMessage, currentSessionId, toggleRecording]);

    useEffect(() => {
        if (isPresenceMode) return;
        // If user is exiting and we're still recording, cancel cleanly — don't
        // auto-send half a sentence the user didn't intend to be heard.
        clearVoiceSilenceTimer();
        isAutoStoppingRef.current = false;
        if (isRecording) {
            try {
                cancelRecording();
            } catch (err) {
                console.warn("⚠️ [Presence] cancelRecording on exit failed:", err);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPresenceMode]);

    const handleVoiceInput = async () => {
        try {
            if (isRecording) {
                await stopVoiceRecordingAndSend();
            } else if (isProcessing || isLoading || avatarCurrentMessage) {
                return;
            } else {
                clearVoiceSilenceTimer();
                lastTranscriptRef.current = "";
                const tempId = `voice-${Date.now()}`;
                setVoiceTempMsgId(tempId);
                setMessages((msgs) => [
                    ...msgs,
                    {
                        id: tempId,
                        content: tSanctuary("chat.voice.recording"),
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
        toast({
            title: tSanctuary("chat.toasts.copied.title"),
            description: tSanctuary("chat.toasts.copied.description"),
        });
    };

    const sendFeedback = (kind: "up" | "down") => {
        const branch = kind === "up" ? "feedbackUp" : "feedbackDown";
        toast({
            title: tSanctuary(`chat.toasts.${branch}.title`),
            description: tSanctuary(`chat.toasts.${branch}.description`),
        });
    };

    const startNewChat = async () => {
        // "New chat" must hard-cancel any pending request so its response
        // doesn't show up in the freshly minted session.
        abortActiveRequest();
        setIsLoading(false);
        const newSessionId = "new"; // v3 will mint a fresh UUID on first turn
        setMessages([]);
        setCurrentSessionId(null);
        setSearchQuery("");
        setMoodSelected(false);
        setMoodValue(null);
        setContinueDismissed(false);
        localStorage.removeItem(CHAT_STORAGE_KEYS.activeSessionId);
        await loadRecentChats();
        // v3 dropped the standalone greeting endpoint — the empty state
        // already renders a calm welcome surface, and the LLM responds on
        // the user's first turn. We intentionally avoid the pre-emptive
        // greeting fetch to keep cold-start latency under 300ms.
        void newSessionId;
    };

    const handleMoodSelect = (value: number) => {
        setMoodValue(value);
        setMoodSelected(true);
        handleSendMessage(moodReplyMap[value]);
    };

    if (!user) return null;

    return (
        <div
            className="flex h-dvh max-h-dvh min-h-0 bg-background text-foreground relative overflow-hidden"
            data-mm-mode={personalization.dataMode || undefined}
            style={personalization.rootStyle}
        >
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
                                title: tSanctuary("chat.toasts.exportEmpty.title"),
                                description: tSanctuary("chat.toasts.exportEmpty.description"),
                            });
                            return;
                        }
                        await exportChatAsPdf(messages);
                        toast({
                            title: tSanctuary("chat.toasts.exportPdf.title"),
                            description: tSanctuary("chat.toasts.exportPdf.description"),
                        });
                    }}
                    onExportJson={() => {
                        if (messages.length === 0) {
                            toast({
                                title: tSanctuary("chat.toasts.exportEmpty.title"),
                                description: tSanctuary("chat.toasts.exportEmpty.description"),
                            });
                            return;
                        }
                        exportChatAsJson(messages, currentSessionId);
                        toast({
                            title: tSanctuary("chat.toasts.exportJson.title"),
                            description: tSanctuary("chat.toasts.exportJson.description"),
                        });
                    }}
                    onExportCsv={() => {
                        if (messages.length === 0) {
                            toast({
                                title: tSanctuary("chat.toasts.exportEmpty.title"),
                                description: tSanctuary("chat.toasts.exportEmpty.description"),
                            });
                            return;
                        }
                        exportChatAsCsv(messages);
                        toast({
                            title: tSanctuary("chat.toasts.exportCsv.title"),
                            description: tSanctuary("chat.toasts.exportCsv.description"),
                        });
                    }}
                />

                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
                    {/* Half-pane avatar (legacy). Suppressed while
                        Presence Mode is active so we don't mount two
                        TalkingHeadAvatar iframes simultaneously. */}
                    {isAvatarVisible && !isPresenceMode && (
                        <ChatAvatarPane
                            avatarKey={`${selectedAvatarId}-${settings?.language}`}
                            avatarUrl={selectedAvatar.url}
                            ttsLang={effectiveTtsLang}
                            ttsVoice={effectiveTtsVoice}
                            cameraView={selectedAvatarCameraView}
                            captionText={avatarCurrentMessage?.text}
                        />
                    )}

                    <div
                        className={`mm-chat-ambient flex-1 min-h-0 min-w-0 overflow-y-auto overscroll-y-contain bg-background relative ${isAvatarVisible ? "lg:w-7/12" : ""
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
                                    <ChatEmptyState
                                        onSend={handleSendMessage}
                                        displayName={userDisplayName}
                                        timeBucket={personalization.timeBucket}
                                    />
                                )}
                            </AnimatePresence>

                            {/* Mood widget — appears once after the first AI greeting,
                                still dismissible. We kept it (rather than replacing
                                with an always-on chip) because the explicit prompt
                                produced a clear engagement lift in the previous ship. */}
                            <AnimatePresence>
                                {filteredMessages.length === 1 && !moodSelected && (
                                    <ChatMoodWidget
                                        key="mood-widget"
                                        options={moodOptions}
                                        onSelect={handleMoodSelect}
                                        onDismiss={() => setMoodSelected(true)}
                                    />
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
                                    messageSpring={personalization.messageSpring}
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
                                    aria-label={tSanctuary("chat.scroll.toLatestAria")}
                                >
                                    <ChevronDown className="h-4 w-4" />
                                </motion.button>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Return-from-activity banner — only rendered when the user
                    completed a tool that was opened from chat. Tapping a chip
                    posts as a normal user message through the LLM. */}
                {returnHandoff && (
                    <ChatReturnBanner
                        handoff={returnHandoff}
                        onReply={(text) => {
                            setReturnHandoff(null);
                            clearChatHandoff();
                            void handleSendMessage(text);
                        }}
                    />
                )}

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

            {/* Desktop floating popup — slides in bottom-right only when a
                suggestion exists. Hidden on <lg; mobile uses pill + sheet. */}
            <ActivitySuggestionPanel
                variant="floating"
                current={activitySuggestion.currentSuggestion}
                history={activitySuggestion.history}
                urgency={latestUrgency}
                onAccept={(s) =>
                    activitySuggestion.acceptSuggestion(s, {
                        trace_id: latestTraceId,
                        session_id: currentSessionId ?? undefined,
                    })
                }
                onDismiss={(s) =>
                    activitySuggestion.dismissSuggestion(s, {
                        trace_id: latestTraceId,
                        session_id: currentSessionId ?? undefined,
                    })
                }
            />

            {/* Mobile pill — opens the bottom-sheet variant when tapped. */}
            <ActivitySuggestionPill
                current={activitySuggestion.currentSuggestion}
                onOpen={() => setActivityPanelOpen(true)}
            />
            <ActivitySuggestionPanel
                variant="sheet"
                current={activitySuggestion.currentSuggestion}
                history={activitySuggestion.history}
                urgency={latestUrgency}
                mobileOpen={activityPanelOpen}
                onMobileOpenChange={setActivityPanelOpen}
                onAccept={(s) => {
                    setActivityPanelOpen(false);
                    activitySuggestion.acceptSuggestion(s, {
                        trace_id: latestTraceId,
                        session_id: currentSessionId ?? undefined,
                    });
                }}
                onDismiss={(s) =>
                    activitySuggestion.dismissSuggestion(s, {
                        trace_id: latestTraceId,
                        session_id: currentSessionId ?? undefined,
                    })
                }
            />

            {/* Phase 1 — Presence Mode full-screen overlay.
                Mounts a single TalkingHeadAvatar inside a calm sage
                bust-shot frame. Phase 2 adds VAD + MicFAB; Phase 3
                adds bust camera + sentence streaming + subtitles;
                Phase 4 adds polish (PiP, emotion badge, safety overlay). */}
            {isPresenceMode && (
                <Suspense fallback={null}>
                    <PresenceMode
                        avatarUrl={selectedAvatar.url}
                        ttsLang={effectiveTtsLang}
                        ttsVoice={effectiveTtsVoice}
                        micState={micState}
                        onMicTap={handlePresenceMicTap}
                        interimTranscript={currentTranscript}
                    />
                </Suspense>
            )}

            {/* Reference unused-but-kept hook returns to avoid silent
                regressions if upstream refactors them — analytics layer
                may grow to consume these later. */}
            <span className="hidden" aria-hidden>
                {transcribingMsgId ?? ""}
                {moodValue ?? ""}
                {String(lastVoiceAnalysis?.avg_pause_duration_ms ?? "")}
                {String(noMatchCount ?? "")}
                {azureError ?? ""}
            </span>
        </div>
    );
};

export default ChatGPTInterface;
