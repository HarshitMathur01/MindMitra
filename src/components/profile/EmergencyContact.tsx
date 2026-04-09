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
            <Card className="bg-surface border-danger/20 shadow-sm rounded-2xl">
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
            <Card className="bg-surface border-danger/20 shadow-sm rounded-2xl ring-1 ring-danger/10">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <ShieldAlert className="h-5 w-5 text-danger" />
                        Emergency Contact
                    </CardTitle>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Heart className="h-3.5 w-3.5 text-danger/60" />
                        This helps us keep you safe — yeh aapki suraksha ke liye hai
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
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            24/7 Helplines (always available)
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
                                <span className="text-xs font-mono text-primary">{contact.phone}</span>
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
