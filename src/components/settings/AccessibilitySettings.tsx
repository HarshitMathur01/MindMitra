import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Accessibility, Type, Eye, Zap, Monitor, Volume2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { SaveBar } from '@/components/shared/SaveBar';
import type { UserSettings } from '@/lib/types/profile';

interface AccessibilitySettingsProps {
    settings: UserSettings | null;
    loading: boolean;
    saving: boolean;
    onSave: (updates: Partial<UserSettings>) => Promise<void>;
}

export function AccessibilitySettings({ settings, loading, saving, onSave }: AccessibilitySettingsProps) {
    const [form, setForm] = useState({
        font_size: 'medium' as 'small' | 'medium' | 'large',
        high_contrast: false,
        reduce_animations: false,
        screen_reader: false,
        text_to_speech: false,
    });
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (settings) {
            setForm({
                font_size: settings.font_size || 'medium',
                high_contrast: settings.high_contrast ?? false,
                reduce_animations: settings.reduce_animations ?? false,
                screen_reader: settings.screen_reader ?? false,
                text_to_speech: settings.text_to_speech ?? false,
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
                    <div key={i} className="flex items-center justify-between">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-6 w-11 rounded-full" />
                    </div>
                ))}
            </div>
        );
    }

    const fontSizes = [
        { value: 'small', label: 'Small', preview: 'text-xs' },
        { value: 'medium', label: 'Medium', preview: 'text-sm' },
        { value: 'large', label: 'Large', preview: 'text-base' },
    ];

    const toggleSettings = [
        {
            key: 'high_contrast' as const,
            label: 'High contrast mode',
            description: 'Increase contrast for better readability',
            icon: <Eye className="h-4 w-4 text-text-secondary" />,
        },
        {
            key: 'reduce_animations' as const,
            label: 'Reduce animations',
            description: 'Minimize motion for a calmer experience — especially helpful for anxiety',
            icon: <Zap className="h-4 w-4 text-text-secondary" />,
        },
        {
            key: 'screen_reader' as const,
            label: 'Screen reader optimization',
            description: 'Improve compatibility with screen reading software',
            icon: <Monitor className="h-4 w-4 text-text-secondary" />,
        },
        {
            key: 'text_to_speech' as const,
            label: 'Text-to-speech for AI responses',
            description: 'Listen to MindMitra\'s responses instead of reading — sunein, padhein nahi',
            icon: <Volume2 className="h-4 w-4 text-text-secondary" />,
        },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
        >
            <div className="space-y-1">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                    <Accessibility className="h-4 w-4 text-primary" />
                    Accessibility
                </h3>
                <p className="text-xs text-text-secondary">
                    Make MindMitra work best for you — Aapke hisaab se adjust karein
                </p>
            </div>

            {/* Font Size */}
            <div className="space-y-3">
                <Label className="text-sm font-medium text-text-primary flex items-center gap-2">
                    <Type className="h-4 w-4 text-primary" />
                    Font Size
                </Label>
                <div className="flex gap-2">
                    {fontSizes.map(size => (
                        <button
                            key={size.value}
                            onClick={() => update('font_size', size.value)}
                            className={`flex-1 py-3 rounded-xl border text-center transition-all duration-200 ${form.font_size === size.value
                                    ? 'border-primary bg-primary/5 shadow-sm'
                                    : 'border-border hover:border-primary/30'
                                }`}
                        >
                            <span className={`${size.preview} font-medium text-text-primary`}>
                                {size.label}
                            </span>
                            <p className={`${size.preview} text-text-secondary mt-0.5`}>Aa</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Toggle Settings */}
            <div className="space-y-3">
                {toggleSettings.map(setting => (
                    <div
                        key={setting.key}
                        className="flex items-start justify-between gap-4 p-4 bg-background/50 rounded-xl border border-border/50"
                    >
                        <div className="flex items-start gap-3 flex-1">
                            <div className="mt-0.5">{setting.icon}</div>
                            <div>
                                <Label className="text-sm font-medium text-text-primary">
                                    {setting.label}
                                </Label>
                                <p className="text-xs text-text-secondary mt-0.5">{setting.description}</p>
                            </div>
                        </div>
                        <Switch
                            checked={form[setting.key]}
                            onCheckedChange={val => update(setting.key, val)}
                        />
                    </div>
                ))}
            </div>

            <SaveBar show={hasChanges} saving={saving} onSave={handleSave} />
        </motion.div>
    );
}
