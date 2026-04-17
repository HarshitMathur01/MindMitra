import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Clock, Globe, Palette } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { SaveBar } from '@/components/shared/SaveBar';
import { useTheme } from '@/context/ThemeContext';
import type { UserSettings } from '@/lib/types/profile';
import type { SupportedLanguage } from '@/lib/locale';

interface GeneralSettingsProps {
    settings: UserSettings | null;
    loading: boolean;
    saving: boolean;
    onSave: (updates: Partial<UserSettings>) => Promise<void>;
}

export function GeneralSettings({ settings, loading, saving, onSave }: GeneralSettingsProps) {
    const { themePreference, setTheme, setThemePreference } = useTheme();
    const [form, setForm] = useState({
        companion_name: '',
        avatar_personality: 'calm' as 'calm' | 'energetic' | 'analytical',
        reminder_time: '09:00',
        language: 'english' as SupportedLanguage,
    });
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (settings) {
            setForm({
                companion_name: settings.companion_name || 'Mitra',
                avatar_personality: settings.avatar_personality || 'calm',
                reminder_time: settings.reminder_time || '09:00',
                language: settings.language || 'english',
            });
            setHasChanges(false);
        }
    }, [settings]);

    const update = (field: string, value: string | number | boolean) => {
        setForm(prev => ({ ...prev, [field]: value }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        await onSave(form);
        setHasChanges(false);
    };

    if (loading) {
        return (
            <div className="space-y-6">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-10 w-full rounded-xl" />
                    </div>
                ))}
            </div>
        );
    }

    const personalities = [
        { value: 'calm', label: 'Calm', emoji: '🧘', description: 'Gentle and soothing responses' },
        { value: 'energetic', label: 'Energetic', emoji: '⚡', description: 'Upbeat and motivating tone' },
        { value: 'analytical', label: 'Analytical', emoji: '🧠', description: 'Thoughtful and structured approach' },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
        >
            {/* Companion Name */}
            <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    AI Companion Name
                </Label>
                <p className="text-xs text-muted-foreground">
                    What would you like to call your AI friend? — Apne AI dost ko kya naam dein?
                </p>
                <Input
                    value={form.companion_name}
                    onChange={e => update('companion_name', e.target.value)}
                    placeholder="e.g., Mitra, Aarav, Priya"
                    className="rounded-xl border-border bg-background/50 focus:border-primary max-w-sm"
                />
            </div>

            {/* Avatar Personality */}
            <div className="space-y-3">
                <Label className="text-sm font-medium text-foreground">
                    Companion Personality
                </Label>
                <RadioGroup
                    value={form.avatar_personality}
                    onValueChange={val => update('avatar_personality', val)}
                    className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                >
                    {personalities.map(p => (
                        <Label
                            key={p.value}
                            htmlFor={`personality-${p.value}`}
                            className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${form.avatar_personality === p.value
                                    ? 'border-primary bg-primary/5 shadow-sm'
                                    : 'border-border hover:border-primary/30 hover:bg-primary/3'
                                }`}
                        >
                            <RadioGroupItem value={p.value} id={`personality-${p.value}`} className="mt-0.5" />
                            <div>
                                <span className="text-lg mr-1">{p.emoji}</span>
                                <span className="text-sm font-semibold text-foreground">{p.label}</span>
                                <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                            </div>
                        </Label>
                    ))}
                </RadioGroup>
            </div>

            {/* Session Reminder Time */}
            <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Session Reminder Time
                </Label>
                <Input
                    type="time"
                    value={form.reminder_time}
                    onChange={e => update('reminder_time', e.target.value)}
                    className="rounded-xl border-border bg-background/50 focus:border-primary max-w-[180px]"
                />
            </div>

            {/* Language */}
            <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    Language Preference
                </Label>
                <Select value={form.language} onValueChange={val => update('language', val)}>
                    <SelectTrigger className="rounded-xl border-border bg-background/50 max-w-sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="english">English</SelectItem>
                        <SelectItem value="hindi">Hindi</SelectItem>
                        <SelectItem value="hinglish">Hinglish</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Theme */}
            <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Palette className="h-4 w-4 text-primary" />
                    Theme
                </Label>
                <div className="flex gap-3">
                    {(['light', 'dark', 'system'] as const).map(option => (
                        <button
                            key={option}
                            onClick={() => option === 'system' ? setThemePreference('system') : setTheme(option)}
                            className={`px-4 py-2.5 rounded-xl border capitalize text-sm font-medium transition-all duration-200 ${themePreference === option
                                    ? 'bg-primary text-white border-primary shadow-sm'
                                    : 'bg-surface text-muted-foreground border-border hover:border-primary/30'
                                }`}
                            type="button"
                        >
                            {option === 'light' ? '☀️ Light' : option === 'dark' ? '🌙 Dark' : '⚙️ Auto'}
                        </button>
                    ))}
                </div>
            </div>

            <SaveBar show={hasChanges} saving={saving} onSave={handleSave} />
        </motion.div>
    );
}
