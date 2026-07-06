/**
 * ChatAvatarPane — the half-pane avatar region shown beside the message area
 * when the avatar is visible and Presence Mode is NOT active (the
 * `isAvatarVisible && !isPresenceMode` gate stays in the orchestrator so the
 * two TalkingHeadAvatar iframes are never mounted simultaneously).
 *
 * Owns the lazy TalkingHeadAvatar chunk plus the typewriter caption overlay.
 */

import { lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { Skeleton } from "@/components/ui/skeleton";
import TypewriterText from "./TypewriterText";
import { CHAT_MESSAGE_SPRING } from "./chatConstants";

const TalkingHeadAvatar = lazy(() => import("./TalkingHeadAvatar"));

interface ChatAvatarPaneProps {
    /** Remount key — `${selectedAvatarId}-${language}` so avatar/language switches rebuild the iframe. */
    avatarKey: string;
    avatarUrl: string;
    ttsLang: string;
    ttsVoice: string;
    cameraView?: "full" | "mid" | "upper" | "head";
    /** Current avatar utterance; renders the caption overlay while speaking. */
    captionText?: string | null;
}

const ChatAvatarPane = ({
    avatarKey,
    avatarUrl,
    ttsLang,
    ttsVoice,
    cameraView,
    captionText,
}: ChatAvatarPaneProps) => (
    <div className="relative bg-background border-b border-border lg:border-b-0 lg:border-r lg:w-5/12 min-h-0 shrink-0 overflow-hidden max-h-[38vh] lg:max-h-none">
        <Suspense fallback={<Skeleton className="h-full min-h-[260px] w-full rounded-none bg-surface/60" />}>
            <TalkingHeadAvatar
                key={avatarKey}
                avatarUrl={avatarUrl}
                ttsLang={ttsLang}
                ttsVoice={ttsVoice}
                cameraView={cameraView}
            />
        </Suspense>
        <AnimatePresence>
            {captionText && (
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={CHAT_MESSAGE_SPRING}
                    className="absolute bottom-0 left-0 right-0 p-3 pointer-events-none z-10"
                >
                    <div className="bg-foreground/80 backdrop-blur rounded-xl px-4 py-3 mx-2 max-h-24 overflow-hidden">
                        <TypewriterText
                            text={captionText}
                            speed={350}
                            maxVisibleWords={12}
                            className="text-background text-sm font-medium leading-relaxed drop-shadow-lg"
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
);

export default ChatAvatarPane;
