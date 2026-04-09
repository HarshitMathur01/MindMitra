import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Download, Trash2, Clock, AlertTriangle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { SaveBar } from '@/components/shared/SaveBar';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import type { UserSettings } from '@/lib/types/profile';

interface PrivacySettingsProps {
    settings: UserSettings | null;
    loading: boolean;
    saving: boolean;
    onSave: (updates: Partial<UserSettings>) => Promise<void>;
}

export function PrivacySettings({ settings, loading, saving, onSave }: PrivacySettingsProps) {
    const { toast } = useToast();
    const [form, setForm] = useState({
        privacy_data_sharing: false,
        privacy_therapist_share: false,
        privacy_crisis_alert: true,
        data_retention_days: 90,
    });
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (settings) {
            setForm({
                privacy_data_sharing: settings.privacy_data_sharing ?? false,
                privacy_therapist_share: settings.privacy_therapist_share ?? false,
                privacy_crisis_alert: settings.privacy_crisis_alert ?? true,
                data_retention_days: settings.data_retention_days ?? 90,
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

    const handleDownloadData = () => {
        toast({
            title: 'Data export requested',
            description: 'We\'ll prepare your data and email it to you within 24 hours. (DPDPA compliant)',
        });
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

    const privacyToggle = (
        key: keyof typeof form,
        label: string,
        description: string,
        icon: React.ReactNode,
    ) => (
        <div className="flex items-start justify-between gap-4 p-4 bg-background/50 rounded-xl border border-border/50">
            <div className="flex items-start gap-3 flex-1">
                <div className="mt-0.5">{icon}</div>
                <div>
                    <Label className="text-sm font-medium text-foreground cursor-pointer">
                        {label}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                </div>
            </div>
            <Switch
                checked={form[key] as boolean}
                onCheckedChange={val => update(key, val)}
            />
        </div>
    );

    return (
        <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-5"
        >
            <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Data & Privacy Controls
                </h3>
                <p className="text-xs text-muted-foreground">
                    You're in full control of your data — Aapka data, aapki marzi
                </p>
            </div>

            <div className="space-y-3">
                {privacyToggle(
                    'privacy_data_sharing',
                    'Help improve MindMitra',
                    'Allow anonymized session data to make MindMitra better for everyone',
                    <Shield className="h-4 w-4 text-muted-foreground" />,
                )}

                {privacyToggle(
                    'privacy_therapist_share',
                    'Share emotional profile with therapist',
                    'Your matched therapist can see your wellness summary to provide better support',
                    <Shield className="h-4 w-4 text-muted-foreground" />,
                )}

                {privacyToggle(
                    'privacy_crisis_alert',
                    'Crisis alert to emergency contact',
                    'If we detect severe distress, notify your emergency contact for your safety',
                    <AlertTriangle className="h-4 w-4 text-warning" />,
                )}
            </div>

            {/* Data Retention */}
            <div className="p-4 bg-background/50 rounded-xl border border-border/50 space-y-2">
                <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-medium text-foreground">Data Retention</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                    Your conversations are stored for <span className="font-semibold text-primary">{form.data_retention_days} days</span>.
                    After that, they are automatically deleted.
                </p>
                <div className="flex gap-2 mt-2">
                    {[30, 60, 90, 180].map(days => (
                        <button
                            key={days}
                            onClick={() => update('data_retention_days', days)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${form.data_retention_days === days
                                    ? 'bg-primary text-white'
                                    : 'bg-surface text-muted-foreground border border-border hover:border-primary/30'
                                }`}
                        >
                            {days} days
                        </button>
                    ))}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                    variant="outline"
                    onClick={handleDownloadData}
                    className="rounded-xl border-border hover:border-primary/30 gap-2"
                >
                    <Download className="h-4 w-4" />
                    Download My Data
                </Button>

                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button
                            variant="outline"
                            className="rounded-xl border-danger/30 text-danger hover:bg-danger/10 hover:border-danger/50 gap-2"
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete My Account
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-danger" />
                                Are you sure?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete your account, all conversations, and personal data.
                                This action cannot be undone. If you're going through a tough time, please reach out
                                to our helplines instead — hum aapke saath hain. 💙
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-xl">Keep my account</AlertDialogCancel>
                            <AlertDialogAction className="rounded-xl bg-danger hover:bg-danger/90 text-white">
                                Yes, delete everything
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>

            <SaveBar show={hasChanges} saving={saving} onSave={handleSave} />
        </motion.div>
    );
}
