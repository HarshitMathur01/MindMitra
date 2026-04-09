import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, Clock, Mail, MessageCircle, Smartphone } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { SaveBar } from '@/components/shared/SaveBar';
import type { UserSettings } from '@/lib/types/profile';

interface NotificationSettingsProps {
    settings: UserSettings | null;
    loading: boolean;
    saving: boolean;
    onSave: (updates: Partial<UserSettings>) => Promise<void>;
}

export function NotificationSettings({ settings, loading, saving, onSave }: NotificationSettingsProps) {
    const [form, setForm] = useState({
        notif_daily: true,
        notif_weekly: true,
        notif_therapist: true,
        notif_crisis: true,
        notif_daily_time: '09:00',
        notif_channels: ['push'] as string[],
    });
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (settings) {
            setForm({
                notif_daily: settings.notif_daily ?? true,
                notif_weekly: settings.notif_weekly ?? true,
                notif_therapist: settings.notif_therapist ?? true,
                notif_crisis: settings.notif_crisis ?? true,
                notif_daily_time: settings.notif_daily_time || '09:00',
                notif_channels: settings.notif_channels || ['push'],
            });
            setHasChanges(false);
        }
    }, [settings]);

    const update = (field: string, value: string | number | boolean | string[]) => {
        setForm(prev => ({ ...prev, [field]: value }));
        setHasChanges(true);
    };

    const toggleChannel = (channel: string) => {
        const channels = form.notif_channels.includes(channel)
            ? form.notif_channels.filter(c => c !== channel)
            : [...form.notif_channels, channel];
        update('notif_channels', channels);
    };

    const handleSave = async () => {
        await onSave(form);
        setHasChanges(false);
    };

    if (loading) {
        return (
            <div className="space-y-6">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-6 w-11 rounded-full" />
                    </div>
                ))}
            </div>
        );
    }

    const notifications = [
        {
            key: 'notif_daily' as const,
            label: 'Daily check-in reminder',
            description: 'A gentle nudge to check in with yourself — Apna khayal rakhein',
            icon: <Bell className="h-4 w-4 text-primary" />,
            hasTime: true,
        },
        {
            key: 'notif_weekly' as const,
            label: 'Weekly emotional summary',
            description: 'Get a weekly overview of your wellness journey',
            icon: <Bell className="h-4 w-4 text-accent" />,
        },
        {
            key: 'notif_therapist' as const,
            label: 'Therapist message alerts',
            description: 'Know when your therapist sends you a message',
            icon: <Bell className="h-4 w-4 text-secondary" />,
        },
        {
            key: 'notif_crisis' as const,
            label: 'Crisis resource updates',
            description: 'Stay updated on new mental health resources and support',
            icon: <Bell className="h-4 w-4 text-warning" />,
        },
    ];

    const channels = [
        { value: 'push', label: 'Push Notifications', icon: Smartphone },
        { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
        { value: 'email', label: 'Email', icon: Mail },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
        >
            <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" />
                    Notification Preferences
                </h3>
                <p className="text-xs text-muted-foreground">
                    Choose how and when MindMitra reaches out to you
                </p>
            </div>

            {/* Notification Toggles */}
            <div className="space-y-3">
                {notifications.map(notif => (
                    <div
                        key={notif.key}
                        className="flex items-start justify-between gap-4 p-4 bg-background/50 rounded-xl border border-border/50"
                    >
                        <div className="flex items-start gap-3 flex-1">
                            <div className="mt-0.5">{notif.icon}</div>
                            <div>
                                <Label className="text-sm font-medium text-foreground">
                                    {notif.label}
                                </Label>
                                <p className="text-xs text-muted-foreground mt-0.5">{notif.description}</p>
                                {notif.hasTime && form.notif_daily && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                        <Input
                                            type="time"
                                            value={form.notif_daily_time}
                                            onChange={e => update('notif_daily_time', e.target.value)}
                                            className="h-8 w-[140px] rounded-lg text-xs border-border bg-surface"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                        <Switch
                            checked={form[notif.key]}
                            onCheckedChange={val => update(notif.key, val)}
                        />
                    </div>
                ))}
            </div>

            {/* Notification Channels */}
            <div className="space-y-3">
                <Label className="text-sm font-medium text-foreground">
                    Notification Channels
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {channels.map(channel => (
                        <label
                            key={channel.value}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 ${form.notif_channels.includes(channel.value)
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-primary/30'
                                }`}
                        >
                            <Checkbox
                                checked={form.notif_channels.includes(channel.value)}
                                onCheckedChange={() => toggleChannel(channel.value)}
                            />
                            <channel.icon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-foreground">{channel.label}</span>
                        </label>
                    ))}
                </div>
            </div>

            <SaveBar show={hasChanges} saving={saving} onSave={handleSave} />
        </motion.div>
    );
}
