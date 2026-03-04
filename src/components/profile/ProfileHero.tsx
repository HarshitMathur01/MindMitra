import { useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Flame, Calendar, Pencil, Check, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { UserProfile } from '@/lib/types/profile';
import { format } from 'date-fns';

interface ProfileHeroProps {
    profile: UserProfile | null;
    loading: boolean;
    onSave: (updates: Partial<UserProfile>) => Promise<void>;
}

export function ProfileHero({ profile, loading, onSave }: ProfileHeroProps) {
    const [editingName, setEditingName] = useState(false);
    const [nameValue, setNameValue] = useState('');

    const initials = profile?.display_name
        ?.split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'U';

    const handleEditName = () => {
        setNameValue(profile?.display_name || '');
        setEditingName(true);
    };

    const handleSaveName = async () => {
        if (nameValue.trim()) {
            await onSave({ display_name: nameValue.trim() });
        }
        setEditingName(false);
    };

    const handleAvatarEdit = () => {
        window.open('https://readyplayer.me/avatar', '_blank');
    };

    if (loading) {
        return (
            <div className="bg-surface rounded-2xl p-8 border border-border shadow-sm">
                <div className="flex flex-col items-center gap-4">
                    <Skeleton className="h-24 w-24 rounded-full" />
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-64" />
                    <div className="flex gap-3">
                        <Skeleton className="h-6 w-32 rounded-full" />
                        <Skeleton className="h-6 w-36 rounded-full" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-surface rounded-2xl p-8 border border-border shadow-sm overflow-hidden relative"
        >
            {/* Subtle gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />

            <div className="relative flex flex-col items-center gap-5">
                {/* Avatar */}
                <div className="relative group">
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                    >
                        <Avatar className="h-24 w-24 border-4 border-primary/20 shadow-lg">
                            {profile?.avatar_url ? (
                                <AvatarImage src={profile.avatar_url} alt={profile.display_name} />
                            ) : null}
                            <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                    </motion.div>

                    <Button
                        size="sm"
                        variant="secondary"
                        className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full p-0 shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        onClick={handleAvatarEdit}
                    >
                        <Camera className="h-4 w-4" />
                    </Button>
                </div>

                {/* Name */}
                <div className="flex items-center gap-2">
                    {editingName ? (
                        <div className="flex items-center gap-2">
                            <Input
                                value={nameValue}
                                onChange={e => setNameValue(e.target.value)}
                                className="text-center text-xl font-bold w-48 border-primary/30 focus:border-primary"
                                autoFocus
                                onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                            />
                            <Button size="sm" variant="ghost" onClick={handleSaveName} className="h-8 w-8 p-0 text-success">
                                <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingName(false)} className="h-8 w-8 p-0 text-danger">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-bold text-text-primary">
                                {profile?.display_name || 'Your Name'}
                            </h2>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleEditName}
                                className="h-8 w-8 p-0 text-text-secondary hover:text-primary"
                            >
                                <Pencil className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    )}
                </div>

                {/* Tagline */}
                <p className="text-text-secondary text-sm italic">
                    Your safe space, your story. 💙
                </p>

                {/* Badges */}
                <div className="flex flex-wrap items-center justify-center gap-3">
                    {(profile?.streak_days ?? 0) > 0 && (
                        <motion.div
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        >
                            <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20 gap-1.5 px-3 py-1">
                                <Flame className="h-3.5 w-3.5" />
                                {profile?.streak_days}-day check-in streak
                            </Badge>
                        </motion.div>
                    )}

                    {profile?.created_at && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 gap-1.5 px-3 py-1">
                            <Calendar className="h-3.5 w-3.5" />
                            Member since {format(new Date(profile.created_at), 'MMM yyyy')}
                        </Badge>
                    )}
                </div>

                {/* Edit Avatar Link */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAvatarEdit}
                    className="rounded-xl border-border hover:border-primary/30 hover:bg-primary/5 transition-all duration-200"
                >
                    <Camera className="h-4 w-4 mr-2" />
                    Edit Avatar
                </Button>
            </div>
        </motion.div>
    );
}
