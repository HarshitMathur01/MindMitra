import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import {
  avatarSourceText,
  toAvatarMessageSource,
  transformToAvatarMessage,
  type AvatarMessage,
  type AvatarMessageSource,
} from "@/lib/chat/avatarMessage";
import { devLog } from "@/lib/chat/devLog";

/**
 * useChat — avatar queue and presence-mode state.
 *
 * This hook is state only. Sentiment scoring lives in `lib/chat/sentiment.ts`
 * and the backend-payload adapter in `lib/chat/avatarMessage.ts`; both used to
 * sit in this file, which meant mounting a provider to test either one.
 *
 * Sending a message is NOT here — ChatGPTInterface talks to `POST /chat`
 * directly and pushes the reply in via `addAvatarMessage`.
 */

/** Options accepted by `chat()`. Kept for call-site compatibility. */
export interface ChatSendOptions {
  personality?: string;
  companion_name?: string;
  language?: string;
}

/** Everything `useChat()` exposes. */
export interface ChatContextValue {
  chat: (message: string, opts?: ChatSendOptions) => Promise<void>;
  message: AvatarMessage | null;
  onMessagePlayed: () => void;
  loading: boolean;
  cameraZoomed: boolean;
  setCameraZoomed: Dispatch<SetStateAction<boolean>>;
  isAvatarVisible: boolean;
  toggleAvatar: () => void;
  closeAvatar: () => void;
  addAvatarMessage: (input: string | AvatarMessageSource) => void;
  appendAvatarMessage: (input: string | AvatarMessageSource) => void;
  clearAvatarMessages: () => void;
  isPresenceMode: boolean;
  enterPresenceMode: () => void;
  exitPresenceMode: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const [messages, setMessages] = useState<AvatarMessage[]>([]);
  const [message, setMessage] = useState<AvatarMessage | null>(null);
  // Nothing sets `loading` — the send path moved to ChatGPTInterface, which
  // owns its own request state. Still exposed because consumers read it;
  // retire the field and its consumers together.
  const [loading] = useState(false);
  const [cameraZoomed, setCameraZoomed] = useState(true);
  const [isAvatarVisible, setIsAvatarVisible] = useState(false);
  // ✅ Presence Mode — full-screen voice + face surface (Phase 1 skeleton).
  // Distinct from `isAvatarVisible` (legacy half-pane avatar). When
  // Presence Mode is active, the avatar is rendered ONLY inside the
  // PresenceMode overlay (the half-pane is suppressed) to ensure we
  // never mount two TalkingHeadAvatar iframes.
  const [isPresenceMode, setIsPresenceMode] = useState(false);
  // Remember whether avatar was visible before entering presence mode,
  // so we can restore that state on exit (don't surprise the user).
  const [avatarVisibleBeforePresence, setAvatarVisibleBeforePresence] = useState(false);

  // We mirror `isAvatarVisible` and `avatarVisibleBeforePresence` in refs
  // so callbacks below can read the latest values without listing them in
  // their dep arrays. Without this, every flip of `isAvatarVisible` would
  // cause `enterPresenceMode`/`toggleAvatar` to get a new identity, which
  // in turn forces every consumer of the chat context to re-render —
  // including the TalkingHead iframe wrapper, on every avatar token.
  const isAvatarVisibleRef = useRef(isAvatarVisible);
  const avatarVisibleBeforePresenceRef = useRef(avatarVisibleBeforePresence);
  useEffect(() => {
    isAvatarVisibleRef.current = isAvatarVisible;
  }, [isAvatarVisible]);
  useEffect(() => {
    avatarVisibleBeforePresenceRef.current = avatarVisibleBeforePresence;
  }, [avatarVisibleBeforePresence]);

  // ── Avatar queue API ───────────────────────────────────────────────────
  // All callbacks below are stable across renders so memoised consumers
  // (e.g. TalkingHeadAvatar wrapped in React.memo in the future) don't
  // re-render whenever the queue mutates.

  /** Replaces the avatar queue with the latest message (discards backlog). */
  const addAvatarMessage = useCallback((messageContent: string | AvatarMessageSource) => {
    devLog('🎭 [Avatar Queue] ═══════════════════════════════');
    devLog('🎭 [Avatar Queue] Adding message to avatar');

    const inputData = toAvatarMessageSource(messageContent);
    const textPreview = avatarSourceText(messageContent).substring(0, 100);

    devLog('🎭 [Avatar Queue] Message preview:', textPreview);
    devLog('🎭 [Avatar Queue] Input type:', typeof messageContent);

    const avatarMessage = transformToAvatarMessage(inputData);

    setMessages((prevMessages) => {
      const newQueue = [avatarMessage];
      devLog('🎭 [Avatar Queue] Replaced queue with latest message');
      devLog('🎭 [Avatar Queue] Discarded', prevMessages.length, 'old messages');
      devLog('🎭 [Avatar Queue] New queue size:', newQueue.length);
      return newQueue;
    });
    devLog('🎭 [Avatar Queue] ═══════════════════════════════');
  }, []);

  /** Appends a sentence to the avatar queue without replacing it.
   * Used for sentence-by-sentence streaming so the avatar speaks
   * back-to-back without gaps. */
  const appendAvatarMessage = useCallback((messageContent: string | AvatarMessageSource) => {
    if (!avatarSourceText(messageContent).trim()) return;

    const avatarMessage = transformToAvatarMessage(toAvatarMessageSource(messageContent));
    setMessages((prev) => {
      const updated = [...prev, avatarMessage];
      devLog('🎭 [Avatar Queue] Appended sentence — queue size:', updated.length);
      return updated;
    });
  }, []);

  const clearAvatarMessages = useCallback(() => {
    devLog('🎭 [Avatar Queue] Clearing all messages');
    setMessages([]);
    setMessage(null);
  }, []);

  const chat = useCallback(async (_message: string, _opts?: ChatSendOptions) => {
    // No-op: chat is handled directly by ChatGPTInterface → FastAPI /chat.
  }, []);

  /** Called by the avatar after a message finishes playing — pops the head
   * of the queue so the next sentence can begin. */
  const onMessagePlayed = useCallback(() => {
    devLog('🎭 [Avatar Queue] Message playback complete');
    setMessages((messages) => {
      const newQueue = messages.slice(1);
      devLog('🎭 [Avatar Queue] Removing message from queue');
      devLog('🎭 [Avatar Queue] Remaining messages:', newQueue.length);

      if (newQueue.length > 0) {
        devLog('🎭 [Avatar Queue] Next message will play automatically');
      } else {
        devLog('🎭 [Avatar Queue] Queue empty - avatar will return to idle');
      }

      return newQueue;
    });
  }, []);

  const toggleAvatar = useCallback(() => {
    setIsAvatarVisible((prev) => {
      const next = !prev;
      devLog('🎭 [Avatar] Visibility toggled:', next);
      if (!next) {
        // Clearing inside the setter is a deliberate side-effect — calling
        // clearAvatarMessages from outside would race with React batching.
        setMessages([]);
        setMessage(null);
      }
      return next;
    });
  }, []);

  const closeAvatar = useCallback(() => {
    devLog('🎭 [Avatar] Closed');
    setIsAvatarVisible(false);
    setMessages([]);
    setMessage(null);
  }, []);

  /** Enter Presence Mode (full-screen voice + face). Records the prior
   * `isAvatarVisible` state via ref so exit can restore it. */
  const enterPresenceMode = useCallback(() => {
    devLog('🎭 [Presence] Entering full-screen Presence Mode');
    setAvatarVisibleBeforePresence(isAvatarVisibleRef.current);
    setIsAvatarVisible(true);
    setIsPresenceMode(true);
  }, []);

  /** Exit Presence Mode and restore the prior avatar visibility state. */
  const exitPresenceMode = useCallback(() => {
    devLog('🎭 [Presence] Exiting Presence Mode');
    setIsPresenceMode(false);
    setMessages([]);
    setMessage(null);
    if (!avatarVisibleBeforePresenceRef.current) {
      setIsAvatarVisible(false);
    }
  }, []);

  // Update current message when queue changes
  useEffect(() => {
    if (messages.length > 0) {
      setMessage(messages[0]);
      devLog('🎭 [Avatar] Current message updated:', messages[0].text?.substring(0, 50));
    } else {
      setMessage(null);
      devLog('🎭 [Avatar] No messages in queue');
    }
  }, [messages]);

  // The provider value is memoised so consumers that rely only on
  // (say) `isPresenceMode` don't re-render when only `message` changes.
  // Stability of the callbacks above is what makes this useful — without
  // useCallback, the value object would still get a fresh function ref
  // on every render and defeat the memoisation.
  const value = useMemo<ChatContextValue>(
    () => ({
      chat,
      message,
      onMessagePlayed,
      loading,
      cameraZoomed,
      setCameraZoomed,
      isAvatarVisible,
      toggleAvatar,
      closeAvatar,
      addAvatarMessage,
      appendAvatarMessage,
      clearAvatarMessages,
      isPresenceMode,
      enterPresenceMode,
      exitPresenceMode,
    }),
    [
      chat,
      message,
      onMessagePlayed,
      loading,
      cameraZoomed,
      isAvatarVisible,
      toggleAvatar,
      closeAvatar,
      addAvatarMessage,
      appendAvatarMessage,
      clearAvatarMessages,
      isPresenceMode,
      enterPresenceMode,
      exitPresenceMode,
    ],
  );

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = (): ChatContextValue => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};
