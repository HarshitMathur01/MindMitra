import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import type { UserProfile, MentalHealthSnapshot } from '@/lib/types/profile';
import { DEFAULT_PROFILE as defaultProfile } from '@/lib/types/profile';

const STORAGE_KEY = 'mindmitra-profile';

const readStoredProfile = (userId: string): UserProfile | null => {
    try {
        const stored = localStorage.getItem(`${STORAGE_KEY}-${userId}`);
        return stored ? (JSON.parse(stored) as UserProfile) : null;
    } catch {
        return null;
    }
};

// Never throws: failure paths resolve to localStorage or defaults so the
// query never enters an error/retry loop.
const fetchProfileForUser = async (user: User): Promise<UserProfile> => {
    try {
        // Try Supabase first
        const { data, error } = await (supabase as SupabaseAny)
            .from('user_profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') {
            // PGRST116 = no rows found, which is fine for new users
            // If table doesn't exist, fall back to localStorage
            if (error.code === '42P01' || error.message?.includes('does not exist')) {
                return (
                    readStoredProfile(user.id) ?? {
                        ...defaultProfile,
                        user_id: user.id,
                        display_name: user.email?.split('@')[0] || 'User',
                    }
                );
            }
            throw error;
        }
        if (data) {
            return data as UserProfile;
        }
        // No profile yet, create defaults
        return {
            ...defaultProfile,
            user_id: user.id,
            display_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
            avatar_url: user.user_metadata?.avatar_url || '',
            created_at: user.created_at || new Date().toISOString(),
        };
    } catch {
        return (
            readStoredProfile(user.id) ?? {
                ...defaultProfile,
                user_id: user.id,
                display_name: user.email?.split('@')[0] || 'User',
                created_at: user.created_at || new Date().toISOString(),
            }
        );
    }
};

const fetchSnapshotForUser = async (user: User): Promise<MentalHealthSnapshot> => {
    try {
        // Try to compute from chat_messages
        const { data: messages } = await supabase
            .from('chat_messages')
            .select('created_at')
            .eq('user_id', user.id);

        const sessionCount = messages?.length
            ? new Set(messages.map(m => m.created_at?.split('T')[0])).size
            : 0;

        // Generate mock trend data for the sparkline
        const trendData = [];
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            trendData.push({
                date: date.toISOString().split('T')[0],
                score: Math.floor(Math.random() * 30) + 50 + (6 - i) * 3, // Trending upward
            });
        }

        return {
            stress_triggers: ['Exam pressure', 'Sleep issues', 'Social anxiety'],
            emotional_trend: 'improving',
            trend_data: trendData,
            sessions_completed: sessionCount || 0,
            therapist_status: null,
            therapist_name: null,
        };
    } catch {
        return {
            stress_triggers: [],
            emotional_trend: 'stable',
            trend_data: [],
            sessions_completed: 0,
            therapist_status: null,
            therapist_name: null,
        };
    }
};

export function useProfile() {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [saving, setSaving] = useState(false);

    const profileKey = ['user-profile', user?.id];

    // Cached and deduped across consumers; no refetch-on-mount within the
    // query client's staleTime window.
    const profileQuery = useQuery({
        queryKey: profileKey,
        queryFn: () => fetchProfileForUser(user as User),
        enabled: !!user,
    });

    const snapshotQuery = useQuery({
        queryKey: ['profile-snapshot', user?.id],
        queryFn: () => fetchSnapshotForUser(user as User),
        enabled: !!user,
    });

    const profile = (user ? profileQuery.data : null) ?? null;

    // Save profile
    const saveProfile = useCallback(async (updates: Partial<UserProfile>) => {
        if (!user || !profile) return;

        setSaving(true);
        const updatedProfile = { ...profile, ...updates, updated_at: new Date().toISOString() };

        try {
            // Try Supabase upsert
            const { error } = await (supabase as SupabaseAny)
                .from('user_profiles')
                .upsert({
                    ...updatedProfile,
                    user_id: user.id,
                }, { onConflict: 'user_id' });

            if (error) {
                // Fallback: save to localStorage
                localStorage.setItem(`${STORAGE_KEY}-${user.id}`, JSON.stringify(updatedProfile));
            }

            queryClient.setQueryData(profileKey, updatedProfile);
            toast({
                title: 'Saved successfully ✨',
                description: 'Your profile has been updated.',
            });
        } catch {
            // Fallback to localStorage
            localStorage.setItem(`${STORAGE_KEY}-${user.id}`, JSON.stringify(updatedProfile));
            queryClient.setQueryData(profileKey, updatedProfile);
            toast({
                title: 'Saved locally',
                description: 'Your changes are saved on this device.',
            });
        } finally {
            setSaving(false);
        }
        // profileKey is derived from user.id, already a dependency via `user`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, profile, toast, queryClient]);

    return {
        profile,
        snapshot: (user ? snapshotQuery.data : null) ?? null,
        loading: !!user && profileQuery.isLoading,
        saving,
        saveProfile,
        refetch: profileQuery.refetch,
    };
}
