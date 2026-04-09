import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { PersonalInfo } from '@/components/profile/PersonalInfo';
import { MentalHealthSnapshot } from '@/components/profile/MentalHealthSnapshot';
import { EmergencyContact } from '@/components/profile/EmergencyContact';
import { PersonalitySelector } from '@/components/profile/PersonalitySelector';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon } from 'lucide-react';
import { AppShell } from '@/components/app/AppShell';
import { PageContainer } from '@/components/app/PageContainer';
import { PageHeader } from '@/components/app/PageHeader';

const Profile = () => {
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const { profile, snapshot, loading, saving, saveProfile } = useProfile();

    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/auth');
        }
    }, [user, authLoading, navigate]);

    if (authLoading) {
        return (
            <AppShell hideHeader>
                <div className="min-h-screen flex items-center justify-center">
                    <motion.div
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="text-primary text-base font-medium"
                    >
                        Loading your space…
                    </motion.div>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <PageContainer width="content" className="py-6 pb-24 md:pb-8">
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                >
                    <PageHeader
                        title="Your Profile"
                        description="Apni profile — your safe space, your story 💙"
                        actions={
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate('/settings')}
                                className="gap-2"
                            >
                                <SettingsIcon className="h-4 w-4" />
                                <span className="hidden sm:inline">Settings</span>
                            </Button>
                        }
                    />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.25 }}
                >
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Column */}
                        <div className="space-y-6">
                            <ProfileHero
                                profile={profile}
                                loading={loading}
                                onSave={saveProfile}
                            />
                            <EmergencyContact
                                profile={profile}
                                loading={loading}
                                saving={saving}
                                onSave={saveProfile}
                            />
                        </div>

                        {/* Right Column */}
                        <div className="lg:col-span-2 space-y-6">
                            <PersonalInfo
                                profile={profile}
                                loading={loading}
                                saving={saving}
                                onSave={saveProfile}
                            />
                            <PersonalitySelector />
                            <MentalHealthSnapshot
                                snapshot={snapshot}
                                loading={loading}
                            />
                        </div>
                    </div>
                </motion.div>
            </PageContainer>
        </AppShell>
    );
};

export default Profile;
