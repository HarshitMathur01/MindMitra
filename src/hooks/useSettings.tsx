import { useState, useEffect, useCallback } from 'react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any;
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import type { UserSettings } from '@/lib/types/profile';
import { DEFAULT_SETTINGS } from '@/lib/types/profile';

const STORAGE_KEY = 'mindmitra-settings';

export function useSettings() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const fetchSettings = useCallback(async () => {
        if (!user) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await (supabase as SupabaseAny)
                .from('user_settings')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                if (error.code === '42P01' || error.message?.includes('does not exist')) {
                    const stored = localStorage.getItem(`${STORAGE_KEY}-${user.id}`);
                    if (stored) {
                        setSettings(JSON.parse(stored));
                    } else {
                        setSettings({ ...DEFAULT_SETTINGS, user_id: user.id });
                    }
                } else {
                    throw error;
                }
            } else if (data) {
                setSettings(data as UserSettings);
            } else {
                setSettings({ ...DEFAULT_SETTINGS, user_id: user.id });
            }
        } catch {
            const stored = localStorage.getItem(`${STORAGE_KEY}-${user.id}`);
            if (stored) {
                setSettings(JSON.parse(stored));
            } else {
                setSettings({ ...DEFAULT_SETTINGS, user_id: user.id });
            }
        } finally {
            setLoading(false);
        }
    }, [user]);

    const saveSettings = useCallback(async (updates: Partial<UserSettings>) => {
        if (!user || !settings) return;

        setSaving(true);
        const updatedSettings = { ...settings, ...updates, updated_at: new Date().toISOString() };

        try {
            const { error } = await (supabase as SupabaseAny)
                .from('user_settings')
                .upsert({
                    ...updatedSettings,
                    user_id: user.id,
                }, { onConflict: 'user_id' });

            if (error) {
                localStorage.setItem(`${STORAGE_KEY}-${user.id}`, JSON.stringify(updatedSettings));
            }

            setSettings(updatedSettings);
            toast({
                title: 'Settings saved ✨',
                description: 'Your preferences have been updated.',
            });
        } catch {
            localStorage.setItem(`${STORAGE_KEY}-${user.id}`, JSON.stringify(updatedSettings));
            setSettings(updatedSettings);
            toast({
                title: 'Saved locally',
                description: 'Your settings are saved on this device.',
            });
        } finally {
            setSaving(false);
        }
    }, [user, settings, toast]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    return {
        settings,
        loading,
        saving,
        saveSettings,
        updateLocal: (updates: Partial<UserSettings>) => {
            if (settings) setSettings({ ...settings, ...updates });
        },
        refetch: fetchSettings,
    };
}
