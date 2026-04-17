import { useState } from "react";
import { motion } from "framer-motion";
import { Camera, Flame, Calendar, Pencil, Check, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { UserProfile } from "@/lib/types/profile";
import { format } from "date-fns";
import { profileSectionCard, profileSectionInner } from "@/components/profile/profileSurface";
import { cn } from "@/lib/utils";

interface ProfileHeroProps {
    profile: UserProfile | null;
    loading: boolean;
    onSave: (updates: Partial<UserProfile>) => Promise<void>;
}

export function ProfileHero({ profile, loading, onSave }: ProfileHeroProps) {
    const [editingName, setEditingName] = useState(false);
    const [nameValue, setNameValue] = useState("");

    const initials =
        profile?.display_name
            ?.split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2) || "U";

    const memberSince = profile?.created_at ? format(new Date(profile.created_at), "MMM yyyy") : null;

    const handleEditName = () => {
        setNameValue(profile?.display_name || "");
        setEditingName(true);
    };

    const handleSaveName = async () => {
        if (nameValue.trim()) {
            await onSave({ display_name: nameValue.trim() });
        }
        setEditingName(false);
    };

    const handleAvatarEdit = () => {
        window.open("https://readyplayer.me/avatar", "_blank");
    };

    if (loading) {
        return (
            <div className={cn(profileSectionCard, profileSectionInner)}>
                <div className="grid grid-cols-1 gap-8 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-start sm:gap-10">
                    <Skeleton className="mx-auto h-[7.5rem] w-[7.5rem] shrink-0 rounded-full sm:mx-0" />
                    <div className="min-w-0 space-y-4">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-9 w-full max-w-md" />
                        <Skeleton className="h-4 w-full max-w-lg" />
                        <div className="flex flex-wrap gap-2">
                            <Skeleton className="h-11 w-40 rounded-2xl" />
                            <Skeleton className="h-11 w-44 rounded-2xl" />
                        </div>
                        <Skeleton className="h-10 w-44 rounded-full" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 40, damping: 38, mass: 1.2 }}
            className={cn(profileSectionCard, profileSectionInner, "pb-8 pt-8 sm:pb-10 sm:pt-10")}
        >
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-start sm:gap-10">
                {/* Avatar */}
                <div className="mx-auto flex w-[7.5rem] shrink-0 flex-col items-center sm:mx-0">
                    <div className="group relative">
                        <Avatar className="h-[7.5rem] w-[7.5rem] border-2 border-ink-3/25 shadow-dashboard-soft ring-2 ring-[hsl(var(--accent-100))]/40">
                            {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={profile.display_name ?? "Profile"} /> : null}
                            <AvatarFallback className="bg-[hsl(var(--accent-100))] text-3xl font-medium text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-300))]">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="absolute -bottom-1 -right-1 h-10 w-10 rounded-full p-0 opacity-0 shadow-md ring-1 ring-ink-3/25 transition-opacity duration-200 group-hover:opacity-100"
                            onClick={handleAvatarEdit}
                            aria-label="Change avatar"
                        >
                            <Camera className="h-4 w-4" strokeWidth={1.8} />
                        </Button>
                    </div>
                </div>

                {/* Identity — min-w-0 prevents flex/grid overflow clipping long names */}
                <div className="min-w-0 space-y-6 text-center sm:border-l sm:border-ink-3/20 sm:pl-10 sm:text-left">
                    <div className="space-y-3">
                        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-5">Identity</p>

                        {editingName ? (
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                                <Input
                                    value={nameValue}
                                    onChange={(e) => setNameValue(e.target.value)}
                                    className="min-h-11 w-full border-ink-3 text-base font-normal text-ink-8 focus-visible:border-[hsl(var(--accent-400))] sm:max-w-xl sm:text-lg"
                                    autoFocus
                                    onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                                />
                                <div className="flex justify-center gap-1 sm:justify-start sm:pt-0.5">
                                    <Button type="button" size="sm" variant="ghost" onClick={handleSaveName} className="h-10 w-10 shrink-0 p-0 text-[hsl(var(--accent-600))]">
                                        <Check className="h-4 w-4" strokeWidth={1.8} />
                                    </Button>
                                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditingName(false)} className="h-10 w-10 shrink-0 p-0 text-ink-5">
                                        <X className="h-4 w-4" strokeWidth={1.8} />
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-start justify-center gap-2 sm:justify-start">
                                <h2 className="min-w-0 max-w-full break-words text-balance font-display text-2xl font-normal tracking-tight text-ink-8 sm:text-3xl">
                                    {profile?.display_name || "Your name"}
                                </h2>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleEditName}
                                    className="mt-1 h-9 shrink-0 rounded-full px-2 text-ink-5 hover:bg-[hsl(var(--ink-1))] hover:text-[hsl(var(--accent-600))] sm:mt-1.5"
                                    aria-label="Edit display name"
                                >
                                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                                </Button>
                            </div>
                        )}

                        <p className="mx-auto max-w-lg text-sm leading-relaxed text-ink-5 sm:mx-0">
                            A quiet corner that belongs to you.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-stretch justify-center gap-2 sm:justify-start">
                        {(profile?.streak_days ?? 0) > 0 && (
                            <div className="inline-flex min-h-[2.75rem] max-w-full items-center gap-2 rounded-2xl border border-[hsl(var(--accent-300))]/35 bg-[hsl(var(--accent-50))] px-3 py-2 dark:border-[hsl(var(--accent-500))]/25 dark:bg-[hsl(var(--accent-100))]/15">
                                <Flame className="h-4 w-4 shrink-0 text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]" strokeWidth={1.8} />
                                <p className="min-w-0 text-left text-sm leading-snug text-ink-7">
                                    <span className="block text-[11px] font-medium uppercase tracking-wide text-ink-5">Rhythm</span>
                                    <span className="font-medium text-ink-8">{profile?.streak_days} days checked in</span>
                                </p>
                            </div>
                        )}

                        {memberSince && (
                            <div className="inline-flex min-h-[2.75rem] max-w-full items-center gap-2 rounded-2xl border border-ink-3/40 bg-[hsl(var(--ink-1))] px-3 py-2 dark:border-ink-3/30 dark:bg-[hsl(var(--ink-2))]/80">
                                <Calendar className="h-4 w-4 shrink-0 text-ink-5" strokeWidth={1.8} />
                                <p className="min-w-0 text-left text-sm leading-snug text-ink-7">
                                    <span className="block text-[11px] font-medium uppercase tracking-wide text-ink-5">Here since</span>
                                    <span className="font-medium text-ink-8">{memberSince}</span>
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="border-t border-ink-3/25 pt-6 dark:border-ink-3/20">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleAvatarEdit}
                            className="rounded-full border-ink-3/50 bg-[hsl(var(--card))] px-5 text-ink-7 shadow-dashboard-soft hover:bg-[hsl(var(--ink-1))]"
                        >
                            <Camera className="mr-2 h-4 w-4 shrink-0" strokeWidth={1.8} />
                            Change avatar
                        </Button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
