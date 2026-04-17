import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Phone, Heart, ShieldAlert, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { SaveBar } from '@/components/shared/SaveBar';
import { HELPLINE_CONTACTS } from '@/lib/types/profile';
import type { UserProfile } from '@/lib/types/profile';
import { profileSectionCard } from '@/components/profile/profileSurface';
import { cn } from '@/lib/utils';

interface EmergencyContactProps {
    profile: UserProfile | null;
    loading: boolean;
    saving: boolean;
    onSave: (updates: Partial<UserProfile>) => Promise<void>;
}

export function EmergencyContact({ profile, loading, saving, onSave }: EmergencyContactProps) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (profile) {
            setName(profile.emergency_contact_name || '');
            setPhone(profile.emergency_contact_phone || '');
            setHasChanges(false);
        }
    }, [profile]);

    const handleSave = async () => {
        await onSave({
            emergency_contact_name: name,
            emergency_contact_phone: phone,
        });
        setHasChanges(false);
    };

    const handleDiscard = () => {
        setName(profile?.emergency_contact_name || '');
        setPhone(profile?.emergency_contact_phone || '');
        setHasChanges(false);
    };

    if (loading) {
        return (
            <Card className={cn(profileSectionCard, 'overflow-hidden ring-1 ring-[hsl(var(--danger))]/12')}>
                <CardHeader>
                    <Skeleton className="h-6 w-44" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-full rounded-xl" />
                    <Skeleton className="h-10 w-full rounded-xl" />
                </CardContent>
            </Card>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
        >
            <Card className={cn(profileSectionCard, 'overflow-hidden ring-1 ring-[hsl(var(--danger))]/15')}>
                <CardHeader className="pb-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[hsl(var(--danger))]/90">Safety</p>
                    <CardTitle className="mt-1 flex items-center gap-2 font-display text-xl font-normal tracking-tight text-ink-8">
                        <ShieldAlert className="h-5 w-5 text-[hsl(var(--danger))]" strokeWidth={1.8} />
                        Emergency contact
                    </CardTitle>
                    <p className="flex items-center gap-1.5 text-sm leading-relaxed text-ink-5">
                        <Heart className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--danger))]/70" strokeWidth={1.8} />
                        Someone we can reach if you ever need help in a crisis.
                    </p>
                </CardHeader>

                <CardContent className="space-y-5">
                    {/* Trusted Contact Form */}
                    <div className="bg-danger/5 rounded-xl p-4 border border-danger/10 space-y-4">
                        <p className="text-sm font-medium text-foreground">
                            Who should we contact if you're in crisis?
                        </p>

                        <div className="space-y-2">
                            <Label className="text-sm text-muted-foreground flex items-center gap-2">
                                <User className="h-3.5 w-3.5" />
                                Contact Name
                            </Label>
                            <Input
                                value={name}
                                onChange={e => { setName(e.target.value); setHasChanges(true); }}
                                placeholder="e.g., Mom, Best Friend, Roommate"
                                className="rounded-xl border-border bg-background/50 focus:border-primary"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm text-muted-foreground flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5" />
                                Phone Number
                            </Label>
                            <Input
                                value={phone}
                                onChange={e => { setPhone(e.target.value); setHasChanges(true); }}
                                placeholder="+91 XXXXX XXXXX"
                                type="tel"
                                className="rounded-xl border-border bg-background/50 focus:border-primary"
                            />
                        </div>
                    </div>

                    {/* Helplines */}
                    <div className="space-y-3">
                        <p className="text-[13px] font-medium text-ink-6">
                            Helplines — someone is there when you need them
                        </p>
                        {HELPLINE_CONTACTS.map(contact => (
                            <a
                                key={contact.phone}
                                href={`tel:${contact.phone}`}
                                className="flex items-center gap-3 bg-background/50 rounded-xl p-3 border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 group"
                            >
                                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                    <Phone className="h-4 w-4 text-primary" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-foreground">{contact.name}</p>
                                    <p className="text-xs text-muted-foreground">{contact.description}</p>
                                </div>
                                <span className="text-[13px] font-medium tracking-wide text-[hsl(var(--accent-600))]">{contact.phone}</span>
                            </a>
                        ))}
                    </div>

                    <SaveBar
                        show={hasChanges}
                        saving={saving}
                        onSave={handleSave}
                        onDiscard={handleDiscard}
                    />
                </CardContent>
            </Card>
        </motion.div>
    );
}
