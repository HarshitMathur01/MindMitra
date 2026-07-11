import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import type { UserSettings } from '@/lib/types/profile';
import { DEFAULT_SETTINGS } from '@/lib/types/profile';
import { normalizeAvatarModelId } from '@/lib/avatarOptions';

const STORAGE_KEY = 'mindmitra-settings';

// The auto-generated Supabase types describe a newer JSONB schema that the
// deployed migrations never created. Use a loose row shape that mirrors the
// actual flat columns in supabase/migrations/20260303125000_*.sql (plus the
// later companion_personality / companion_personality_locked / avatar_model
// additions). Regenerating types via `supabase gen types` is out of scope.
type FlatSettingsRow = {
    id?: string;
    user_id?: string;
    companion_name?: string | null;
    avatar_personality?: string | null;
    avatar_model?: string | null;
    companion_personality?: string | null;
    companion_personality_locked?: boolean | null;
    reminder_time?: string | null;
    language?: string | null;
    theme?: string | null;
    privacy_data_sharing?: boolean | null;
    privacy_therapist_share?: boolean | null;
    privacy_crisis_alert?: boolean | null;
    data_retention_days?: number | null;
    notif_daily?: boolean | null;
    notif_weekly?: boolean | null;
    notif_therapist?: boolean | null;
    notif_crisis?: boolean | null;
    notif_daily_time?: string | null;
    notif_channels?: string[] | null;
    font_size?: string | null;
    high_contrast?: boolean | null;
    reduce_animations?: boolean | null;
    screen_reader?: boolean | null;
    text_to_speech?: boolean | null;
    updated_at?: string | null;
};

const readBoolean = (value: unknown, fallback: boolean): boolean => (
    typeof value === 'boolean' ? value : fallback
);

const readNumber = (value: unknown, fallback: number): number => (
    typeof value === 'number' && Number.isFinite(value) ? value : fallback
);

const readStringArray = (value: unknown, fallback: string[]): string[] => (
    Array.isArray(value) && value.every(item => typeof item === 'string') ? value : fallback
);

const toSettingsModel = (row: FlatSettingsRow | null, userId: string): UserSettings => {
    if (!row) {
        return { ...DEFAULT_SETTINGS, user_id: userId };
    }

    return {
        ...DEFAULT_SETTINGS,
        id: row.id,
        user_id: userId,
        companion_name: row.companion_name ?? DEFAULT_SETTINGS.companion_name,
        avatar_personality: (row.avatar_personality as UserSettings['avatar_personality']) ?? DEFAULT_SETTINGS.avatar_personality,
        avatar_model: normalizeAvatarModelId(row.avatar_model),
        companion_personality: (row.companion_personality as UserSettings['companion_personality']) ?? DEFAULT_SETTINGS.companion_personality,
        companion_personality_locked: row.companion_personality_locked ?? DEFAULT_SETTINGS.companion_personality_locked,
        reminder_time: row.reminder_time ?? DEFAULT_SETTINGS.reminder_time,
        language: (row.language as UserSettings['language']) ?? DEFAULT_SETTINGS.language,
        theme: (row.theme as UserSettings['theme']) ?? DEFAULT_SETTINGS.theme,
        privacy_data_sharing: readBoolean(row.privacy_data_sharing, DEFAULT_SETTINGS.privacy_data_sharing),
        privacy_therapist_share: readBoolean(row.privacy_therapist_share, DEFAULT_SETTINGS.privacy_therapist_share),
        privacy_crisis_alert: readBoolean(row.privacy_crisis_alert, DEFAULT_SETTINGS.privacy_crisis_alert),
        data_retention_days: readNumber(row.data_retention_days, DEFAULT_SETTINGS.data_retention_days),
        notif_daily: readBoolean(row.notif_daily, DEFAULT_SETTINGS.notif_daily),
        notif_weekly: readBoolean(row.notif_weekly, DEFAULT_SETTINGS.notif_weekly),
        notif_therapist: readBoolean(row.notif_therapist, DEFAULT_SETTINGS.notif_therapist),
        notif_crisis: readBoolean(row.notif_crisis, DEFAULT_SETTINGS.notif_crisis),
        notif_daily_time: row.notif_daily_time ?? DEFAULT_SETTINGS.notif_daily_time ?? '09:00',
        notif_channels: readStringArray(row.notif_channels, DEFAULT_SETTINGS.notif_channels),
        font_size: (row.font_size as UserSettings['font_size']) ?? DEFAULT_SETTINGS.font_size,
        high_contrast: readBoolean(row.high_contrast, DEFAULT_SETTINGS.high_contrast),
        reduce_animations: readBoolean(row.reduce_animations, DEFAULT_SETTINGS.reduce_animations),
        screen_reader: readBoolean(row.screen_reader, DEFAULT_SETTINGS.screen_reader),
        text_to_speech: readBoolean(row.text_to_speech, DEFAULT_SETTINGS.text_to_speech),
        updated_at: row.updated_at ?? undefined,
    };
};

const toDbSettings = (settings: UserSettings): FlatSettingsRow => ({
    ...(settings.id ? { id: settings.id } : {}),
    user_id: settings.user_id,
    companion_name: settings.companion_name,
    avatar_personality: settings.avatar_personality,
    // Legacy DB CHECK constraint stores the Olaf rig under its previous
    // codename 'valentina'. The runtime normalizer translates the other way
    // on read; here we mirror it on write so the upsert never 400s.
    avatar_model: settings.avatar_model === 'olaf' ? 'valentina' : settings.avatar_model,
    companion_personality: settings.companion_personality,
    companion_personality_locked: settings.companion_personality_locked ?? false,
    reminder_time: settings.reminder_time ?? null,
    language: settings.language,
    theme: settings.theme,
    privacy_data_sharing: settings.privacy_data_sharing,
    privacy_therapist_share: settings.privacy_therapist_share,
    privacy_crisis_alert: settings.privacy_crisis_alert,
    data_retention_days: settings.data_retention_days,
    notif_daily: settings.notif_daily,
    notif_weekly: settings.notif_weekly,
    notif_therapist: settings.notif_therapist,
    notif_crisis: settings.notif_crisis,
    notif_daily_time: settings.notif_daily_time ?? '09:00',
    notif_channels: settings.notif_channels,
    font_size: settings.font_size,
    high_contrast: settings.high_contrast,
    reduce_animations: settings.reduce_animations,
    screen_reader: settings.screen_reader,
    text_to_speech: settings.text_to_speech,
    updated_at: settings.updated_at ?? new Date().toISOString(),
});

const readStoredSettings = (userId: string): UserSettings | null => {
    try {
        const stored = localStorage.getItem(`${STORAGE_KEY}-${userId}`);
        return stored ? (JSON.parse(stored) as UserSettings) : null;
    } catch {
        return null;
    }
};

// Never throws: every failure path resolves to localStorage or defaults, so
// the query never enters an error/retry loop and consumers always get a
// usable settings object once loading completes.
const fetchSettingsForUser = async (user: User): Promise<UserSettings> => {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
            .from('user_settings')
            .select('*')
            .eq('user_id', user.id)
            .single() as { data: FlatSettingsRow | null; error: { code?: string; message?: string } | null };

        if (error && error.code !== 'PGRST116') {
            if (error.code === '42P01' || error.message?.includes('does not exist')) {
                return readStoredSettings(user.id) ?? { ...DEFAULT_SETTINGS, user_id: user.id };
            }
            throw error;
        }
        if (data) {
            return toSettingsModel(data, user.id);
        }
        return { ...DEFAULT_SETTINGS, user_id: user.id };
    } catch {
        return readStoredSettings(user.id) ?? { ...DEFAULT_SETTINGS, user_id: user.id };
    }
};

export function useSettings() {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [saving, setSaving] = useState(false);

    const queryKey = ['user-settings', user?.id];

    // Shared across every mounted consumer (Settings page, chat, sanctuary):
    // one Supabase round trip per staleTime window instead of one per mount.
    const query = useQuery({
        queryKey,
        queryFn: () => fetchSettingsForUser(user as User),
        enabled: !!user,
    });

    const settings = (user ? query.data : null) ?? null;

    const saveSettings = useCallback(async (updates: Partial<UserSettings>) => {
        if (!user || !settings) return;

        setSaving(true);
        const updatedSettings = { ...settings, ...updates, updated_at: new Date().toISOString() };

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (supabase as any)
                .from('user_settings')
                .upsert(toDbSettings({ ...updatedSettings, user_id: user.id }), { onConflict: 'user_id' });

            if (error) {
                localStorage.setItem(`${STORAGE_KEY}-${user.id}`, JSON.stringify(updatedSettings));
            }

            queryClient.setQueryData(queryKey, updatedSettings);
            toast({
                title: 'Settings saved ✨',
                description: 'Your preferences have been updated.',
            });
        } catch {
            localStorage.setItem(`${STORAGE_KEY}-${user.id}`, JSON.stringify(updatedSettings));
            queryClient.setQueryData(queryKey, updatedSettings);
            toast({
                title: 'Saved locally',
                description: 'Your settings are saved on this device.',
            });
        } finally {
            setSaving(false);
        }
        // queryKey is derived from user.id, already a dependency via `user`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, settings, toast, queryClient]);

    return {
        settings,
        loading: !!user && query.isLoading,
        saving,
        saveSettings,
        updateLocal: (updates: Partial<UserSettings>) => {
            if (settings) queryClient.setQueryData(queryKey, { ...settings, ...updates });
        },
        refetch: query.refetch,
    };
}
