import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, MapPin, GraduationCap, Building2, Globe, Calendar as CalendarIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PrivacyToggle } from '@/components/shared/PrivacyToggle';
import { SaveBar } from '@/components/shared/SaveBar';
import type { UserProfile } from '@/lib/types/profile';
import { profileSectionCard } from '@/components/profile/profileSurface';
import { cn } from '@/lib/utils';

interface PersonalInfoProps {
    profile: UserProfile | null;
    loading: boolean;
    saving: boolean;
    onSave: (updates: Partial<UserProfile>) => Promise<void>;
}

export function PersonalInfo({ profile, loading, saving, onSave }: PersonalInfoProps) {
    const [form, setForm] = useState<Partial<UserProfile>>({});
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (profile) {
            setForm({
                full_name: profile.full_name || '',
                age: profile.age,
                date_of_birth: profile.date_of_birth || '',
                gender: profile.gender,
                language: profile.language || 'english',
                college: profile.college || '',
                course_year: profile.course_year || '',
                city: profile.city || '',
                privacy_full_name: profile.privacy_full_name ?? true,
                privacy_age: profile.privacy_age ?? true,
                privacy_gender: profile.privacy_gender ?? true,
                privacy_college: profile.privacy_college ?? true,
                privacy_course_year: profile.privacy_course_year ?? true,
                privacy_city: profile.privacy_city ?? true,
            });
            setHasChanges(false);
        }
    }, [profile]);

    const updateField = (field: string, value: string | number | boolean) => {
        setForm(prev => ({ ...prev, [field]: value }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        await onSave(form);
        setHasChanges(false);
    };

    const handleDiscard = () => {
        if (profile) {
            setForm({
                full_name: profile.full_name || '',
                age: profile.age,
                date_of_birth: profile.date_of_birth || '',
                gender: profile.gender,
                language: profile.language || 'english',
                college: profile.college || '',
                course_year: profile.course_year || '',
                city: profile.city || '',
                privacy_full_name: profile.privacy_full_name ?? true,
                privacy_age: profile.privacy_age ?? true,
                privacy_gender: profile.privacy_gender ?? true,
                privacy_college: profile.privacy_college ?? true,
                privacy_course_year: profile.privacy_course_year ?? true,
                privacy_city: profile.privacy_city ?? true,
            });
        }
        setHasChanges(false);
    };

    if (loading) {
        return (
            <Card className={cn(profileSectionCard, 'overflow-hidden')}>
                <CardHeader>
                    <Skeleton className="h-6 w-40" />
                </CardHeader>
                <CardContent className="space-y-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-10 w-full rounded-xl" />
                        </div>
                    ))}
                </CardContent>
            </Card>
        );
    }

    const fields = [
        {
            key: 'full_name',
            label: 'Full Name',
            icon: User,
            privacyKey: 'privacy_full_name',
            type: 'text',
            placeholder: 'Your full name',
        },
        {
            key: 'age',
            label: 'Age',
            icon: CalendarIcon,
            privacyKey: 'privacy_age',
            type: 'number',
            placeholder: 'Your age',
        },
        {
            key: 'gender',
            label: 'Gender',
            icon: User,
            privacyKey: 'privacy_gender',
            type: 'select',
            options: [
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'non-binary', label: 'Non-binary' },
                { value: 'prefer-not-to-say', label: 'Prefer not to say' },
            ],
        },
        {
            key: 'language',
            label: 'Preferred Language',
            icon: Globe,
            type: 'select',
            options: [
                { value: 'english', label: 'English' },
                { value: 'hindi', label: 'Hindi' },
                { value: 'hinglish', label: 'Hinglish' },
            ],
        },
        {
            key: 'college',
            label: 'College / Institution',
            icon: Building2,
            privacyKey: 'privacy_college',
            type: 'text',
            placeholder: 'e.g., IIT Delhi',
        },
        {
            key: 'course_year',
            label: 'Course & Year',
            icon: GraduationCap,
            privacyKey: 'privacy_course_year',
            type: 'text',
            placeholder: 'e.g., B.Tech 2nd Year',
        },
        {
            key: 'city',
            label: 'City',
            icon: MapPin,
            privacyKey: 'privacy_city',
            type: 'text',
            placeholder: 'e.g., Mumbai',
        },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
        >
            <Card className={cn(profileSectionCard, 'overflow-hidden')}>
                <CardHeader className="pb-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-5">Details</p>
                    <CardTitle className="mt-1 flex items-center gap-2 font-display text-xl font-normal tracking-tight text-ink-8">
                        <User className="h-5 w-5 text-[hsl(var(--accent-600))] dark:text-[hsl(var(--accent-400))]" strokeWidth={1.8} />
                        Personal information
                    </CardTitle>
                    <p className="text-sm leading-relaxed text-ink-5">
                        All fields are optional — share only what feels comfortable.
                    </p>
                </CardHeader>
                <CardContent className="space-y-5">
                    {fields.map(field => (
                        <div key={field.key} className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                                    <field.icon className="h-4 w-4 text-muted-foreground" />
                                    {field.label}
                                </Label>
                                {field.privacyKey && (
                                    <PrivacyToggle
                                        isPrivate={(form as Record<string, unknown>)[field.privacyKey!] as boolean ?? true}
                                        onToggle={val => updateField(field.privacyKey!, val)}
                                    />
                                )}
                            </div>

                            {field.type === 'select' ? (
                                <Select
                                    value={(form as Record<string, unknown>)[field.key] as string || ''}
                                    onValueChange={val => updateField(field.key, val)}
                                >
                                    <SelectTrigger className="rounded-xl border-ink-3/50 bg-[hsl(var(--ink-1))] focus:border-[hsl(var(--accent-400))] dark:bg-[hsl(var(--ink-2))]">
                                        <SelectValue placeholder={`Choose ${field.label.toLowerCase()}`} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {field.options?.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    type={field.type}
                                    value={(form as Record<string, unknown>)[field.key] as string || ''}
                                    onChange={e => updateField(field.key, field.type === 'number' ? parseInt(e.target.value) || '' : e.target.value)}
                                    placeholder={field.placeholder}
                                    className="rounded-xl border-ink-3/50 bg-[hsl(var(--ink-1))] focus:border-[hsl(var(--accent-400))] dark:bg-[hsl(var(--ink-2))]"
                                />
                            )}
                        </div>
                    ))}

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
