import { motion } from "framer-motion";
import {
    PanelLeftOpen,
    PanelLeftClose,
    MoreVertical,
    Eye,
    EyeOff,
    Download,
    User,
    Globe,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { CHAT_SOFT_SPRING } from "./chatConstants";
import { LANGUAGE_LABELS, type SupportedLanguage } from "@/lib/locale";
import { AVATAR_OPTIONS } from "@/lib/avatarOptions";

type AvatarOption = (typeof AVATAR_OPTIONS)[number];

interface ChatHeaderBarProps {
    sidebarCollapsed: boolean;
    onToggleSidebar: () => void;
    isAvatarVisible: boolean;
    onToggleAvatar: () => void;
    selectedAvatar: AvatarOption;
    selectedAvatarId: string;
    onSelectAvatar: (id: string) => void;
    selectedLanguage: SupportedLanguage;
    onSelectLanguage: (lang: SupportedLanguage) => void;
    headerStatusText: string;
    isLoading: boolean;
    onExportPdf: () => void;
    onExportJson: () => void;
    onExportCsv: () => void;
}

/**
 * Top chat header — re-shaped to keep "presence" of the conversation
 * intact even on mobile.
 *
 * Avatar/Language pickers and Export options are consolidated into a
 * single overflow `(•••)` menu on small screens; the only persistent
 * controls become the sidebar toggle, brand mark, and an avatar
 * eye-toggle. On `sm+`, key controls surface inline.
 */
const ChatHeaderBar = ({
    sidebarCollapsed,
    onToggleSidebar,
    isAvatarVisible,
    onToggleAvatar,
    selectedAvatar,
    selectedAvatarId,
    onSelectAvatar,
    selectedLanguage,
    onSelectLanguage,
    headerStatusText,
    isLoading,
    onExportPdf,
    onExportJson,
    onExportCsv,
}: ChatHeaderBarProps) => {
    const navigate = useNavigate();

    return (
        <motion.div
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={CHAT_SOFT_SPRING}
            className="border-b border-border bg-card/95 backdrop-blur p-3 sm:p-4 flex items-center justify-between gap-2 min-w-0"
        >
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <Button
                    variant="ghost"
                    size="sm"
                    className="hover:bg-muted/40 transition-colors"
                    onClick={onToggleSidebar}
                    aria-label={sidebarCollapsed ? "Open conversations" : "Close conversations"}
                >
                    {sidebarCollapsed ? (
                        <PanelLeftOpen className="h-4 w-4" />
                    ) : (
                        <PanelLeftClose className="h-4 w-4" />
                    )}
                </Button>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => navigate("/")}
                            className="w-9 h-9 rounded-full bg-accent flex items-center justify-center shadow-xs transition-colors duration-150 hover:bg-accent/80"
                            aria-label="Go to home"
                        >
                            <img
                                src="/image.png"
                                alt="MindMitra"
                                className="h-5 w-5 object-contain"
                            />
                        </button>
                        <span
                            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-background ${
                                isLoading ? "bg-warning animate-pulse" : "bg-success"
                            }`}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate("/")}
                        className="min-w-0 text-left"
                        aria-label="Go to home"
                    >
                        <h1 className="font-display text-[16px] sm:text-[17px] font-normal text-ink-8 leading-tight truncate">
                            MindMitra
                        </h1>
                        <p className="text-[11.5px] text-ink-5 leading-none mt-0.5 truncate max-w-[44vw] sm:max-w-none">
                            {headerStatusText}
                        </p>
                    </button>
                </div>
            </div>

            <div className="flex items-center justify-end gap-1 sm:gap-2 flex-shrink-0">
                {/* Avatar eye-toggle — visible on every breakpoint. */}
                <Button
                    variant="outline"
                    size="sm"
                    className={`flex-shrink-0 bg-card border-border gap-2 transition-all duration-200 ${
                        isAvatarVisible ? "border-primary/30" : ""
                    }`}
                    onClick={onToggleAvatar}
                    aria-pressed={isAvatarVisible}
                    aria-label={isAvatarVisible ? "Hide avatar" : "Show avatar"}
                >
                    {isAvatarVisible ? (
                        <Eye className="h-4 w-4 text-primary" />
                    ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium hidden sm:inline">
                        {isAvatarVisible ? "Hide avatar" : "Show avatar"}
                    </span>
                </Button>

                {/* Settings & exports — consolidated overflow on mobile. */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="hover:bg-muted/40 transition-colors flex-shrink-0"
                            aria-label="More options"
                        >
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60">
                        <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-5">
                            Companion
                        </DropdownMenuLabel>
                        {AVATAR_OPTIONS.map((avatar) => (
                            <DropdownMenuItem
                                key={avatar.id}
                                onClick={() => onSelectAvatar(avatar.id)}
                                className="flex items-center justify-between py-2"
                            >
                                <div className="flex items-center gap-2">
                                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                                    <div>
                                        <p className="font-medium text-sm">{avatar.name}</p>
                                        <p className="text-[11px] text-muted-foreground">
                                            {avatar.description}
                                        </p>
                                    </div>
                                </div>
                                {selectedAvatarId === avatar.id && (
                                    <div className="ml-2 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                                )}
                            </DropdownMenuItem>
                        ))}

                        <DropdownMenuSeparator />

                        <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-5">
                            Language
                        </DropdownMenuLabel>
                        {(Object.entries(LANGUAGE_LABELS) as [SupportedLanguage, string][]).map(
                            ([code, label]) => (
                                <DropdownMenuItem
                                    key={code}
                                    onClick={() => onSelectLanguage(code)}
                                    className="flex items-center justify-between py-2"
                                >
                                    <div className="flex items-center gap-2">
                                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="font-medium text-sm">{label}</span>
                                    </div>
                                    {selectedLanguage === code && (
                                        <div className="ml-2 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                                    )}
                                </DropdownMenuItem>
                            ),
                        )}

                        <DropdownMenuSeparator />

                        <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-5">
                            Export this conversation
                        </DropdownMenuLabel>
                        <DropdownMenuItem onClick={onExportPdf}>
                            <Download className="h-4 w-4 mr-2" />
                            Export as PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onExportJson}>
                            <Download className="h-4 w-4 mr-2" />
                            Export as JSON
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onExportCsv}>
                            <Download className="h-4 w-4 mr-2" />
                            Export as CSV
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Reference selectedAvatar so its image preload can be added later */}
            <span className="hidden" aria-hidden>
                {selectedAvatar.name}
            </span>
        </motion.div>
    );
};

export default ChatHeaderBar;
