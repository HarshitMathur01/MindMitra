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
import { useChatSessions } from "./hooks/useChatSessions";
import { useVoiceTurn } from "./hooks/useVoiceTurn";

import {
    CHAT_SOFT_SPRING,
    moodReplyMap,
} from "./chatConstants";
import { useLoadingPhases, useMoodOptions } from "./chatI18n";
import { useChatPersonalization } from "@/hooks/useChatPersonalization";
import { parseTurnMeta, type TurnMeta } from "@/lib/chat/turnPersonalization";
import { messageLengthBand } from "./chatHelpers";
import {
    exportChatAsCsv,
    exportChatAsJson,
    exportChatAsPdf,
} from "./chatExports";
import type { Message } from "./chatTypes";

import { AVATAR_OPTIONS, normalizeAvatarModelId } from "@/lib/avatarOptions";
import {
    voiceForLocale,
    sttLocale as getSttLocale,
    type SupportedLanguage,
} from "@/lib/locale";
import { trackProductEvent } from "@/lib/productAnalytics";

const PresenceMode = lazy(() => import("./PresenceMode"));

const durationBand = (ms: number): string => {
    const minutes = ms / 60_000;
    if (minutes < 1) return "<1m";
    if (minutes < 5) return "1-5m";
    if (minutes < 15) return "5-15m";
    return "15m+";
};

// Lifetime-activation marker for `first_chat_message`. Keyed per user; the
// mm_ prefix means sessionCleanup sweeps it on sign-out (privacy wins over
// dedupe — worst case a re-login re-emits one event, and funnels key on the
// first occurrence anyway).
const markFirstChatMessage = (userId: string): boolean => {
    try {
        const key = `mm_analytics_first_msg_${userId}`;
        if (localStorage.getItem(key)) return false;
        localStorage.setItem(key, "1");
        return true;
    } catch {
        return false;
    }
};

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
    const [transcribingMsgId, setTranscribingMsgId] = useState<string | null>(null);
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
    // ── Request lifecycle guards ────────────────────────────────────────────
    // The chat request can outlive the React component. Keep one AbortController
    // for the active turn so navigation/session switches do not write stale UI.
    const activeChatRequestRef = useRef<AbortController | null>(null);
    const mountedRef = useRef(true);

    // ── Funnel telemetry (coarse; never message content) ────────────────────
    const visitTurnsRef = useRef(0);
    const visitStartedAtRef = useRef(Date.now());
    const visitEndTrackedRef = useRef(false);

    // Helper used inside async flows so we can break out cleanly when
    // the user navigates away mid-request.
    const abortActiveRequest = () => {
        activeChatRequestRef.current?.abort();
        activeChatRequestRef.current = null;
    };

    // ── Session lifecycle ───────────────────────────────────────────────────
    const {
        currentSessionId,
        adoptSessionId,
        getSessionEpoch,
        recentChats,
        loadingChats,
        loadingSession,
        saveMessage,
        loadRecentChats,
        selectRecentChat,
        startNewChat,
    } = useChatSessions({
        user,
        setMessages,
        hasMessages: () => messages.length > 0,
        onBeforeSwitch: () => {
            abortActiveRequest();
            setIsLoading(false);
        },
        onNewChatReset: () => {
            setSearchQuery("");
            setMoodSelected(false);
            setMoodValue(null);
            setContinueDismissed(false);
        },
    });

    // ── Voice endpointing + presence auto-listen ────────────────────────────
    const { handleVoiceInput, handlePresenceMicTap, micState } = useVoiceTurn({
        recording: {
            isRecording,
            isProcessing,
            toggleRecording,
            cancelRecording,
            currentTranscript,
            hasTranscript,
            lastTranscriptAt,
        },
        voiceSupported,
        isPresenceMode,
        isAvatarVisible,
        isLoading,
        avatarCurrentMessage,
        currentSessionId,
        setMessages,
        onVoiceResult: (analysis, audioData) => {
            pendingVoiceAnalysisRef.current = analysis;
            pendingAudioDataRef.current = audioData;
        },
        sendMessage: (text) => handleSendMessage(text),
    });

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

    // Mount/unmount sentinel + HTTP request cleanup.
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            activeChatRequestRef.current?.abort();
            activeChatRequestRef.current = null;
        };
    }, []);

    // chat_session_ended — one per /chat visit with at least one turn.
    // SPA navigation ends via unmount; tab close/background via pagehide
    // (Mixpanel persists its batch queue to localStorage, so a late event
    // survives to the next load). pageshow un-latches after a bfcache
    // restore so a resumed visit can emit its own end.
    useEffect(() => {
        const trackVisitEnd = () => {
            if (visitEndTrackedRef.current || visitTurnsRef.current === 0) return;
            visitEndTrackedRef.current = true;
            trackProductEvent("chat_session_ended", {
                turns: visitTurnsRef.current,
                duration_band: durationBand(Date.now() - visitStartedAtRef.current),
            });
        };
        const unlatch = () => {
            visitEndTrackedRef.current = false;
        };
        window.addEventListener("pagehide", trackVisitEnd);
        window.addEventListener("pageshow", unlatch);
        return () => {
            window.removeEventListener("pagehide", trackVisitEnd);
            window.removeEventListener("pageshow", unlatch);
            trackVisitEnd();
        };
    }, []);

    // Reset the dismiss state when the session changes — each restored
    // session decides on its own merits whether to show the ribbon.
    useEffect(() => {
        setContinueDismissed(false);
    }, [currentSessionId]);

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
            visitTurnsRef.current += 1;
            if (user?.id && markFirstChatMessage(user.id)) {
                trackProductEvent("first_chat_message");
            }

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
            const sendEpoch = getSessionEpoch();
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
            // The abort in onBeforeSwitch cannot cover a request that has
            // already resolved but not yet committed. If the session context
            // changed while we were awaiting, drop this response outright —
            // adopting its session id or queueing its avatar turn would
            // clobber the newly selected chat.
            if (getSessionEpoch() !== sendEpoch) return;

            adoptSessionId(finalText.session_id);

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

            // Avatar playback is intentionally queued BEFORE these saves
            // resolve: waiting on a network write would delay the spoken
            // response, and save failures already surface via the debounced
            // toast in saveMessage. Do not reorder.
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
