import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '@/components/layout/Header';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { PersonalInfo } from '@/components/profile/PersonalInfo';
import { MentalHealthSnapshot } from '@/components/profile/MentalHealthSnapshot';
import { EmergencyContact } from '@/components/profile/EmergencyContact';
import { PersonalitySelector } from '@/components/profile/PersonalitySelector';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Settings as SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
            <div className="min-h-screen bg-background flex items-center justify-center">
                <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-primary text-lg font-medium"
                >
                    Loading your space...
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-text-primary transition-colors duration-300">
            <Header />
            <main className="container mx-auto px-4 py-6 pb-24 md:pb-8 max-w-4xl">
                {/* Page Header with Tab Navigation */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between mb-6"
                >
                    <div>
                        <h1 className="text-2xl font-bold text-text-primary">Your Profile</h1>
                        <p className="text-sm text-text-secondary mt-1">
                            Apni profile — your safe space, your story 💙
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/settings')}
                        className="rounded-xl border-border hover:border-primary/30 gap-2"
                    >
                        <SettingsIcon className="h-4 w-4" />
                        <span className="hidden sm:inline">Settings</span>
                    </Button>
                </motion.div>

                {/* Profile Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column — Hero + Emergency */}
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

                    {/* Right Column — Info + Personality + Snapshot */}
                    <div className="lg:col-span-2 space-y-6">
                        <PersonalInfo
                            profile={profile}
                            loading={loading}
                            saving={saving}
                            onSave={saveProfile}
                        />

                        {/* AI Companion Personality */}
                        <motion.section
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 }}
                        >
                            <PersonalitySelector />
                        </motion.section>

                        <MentalHealthSnapshot
                            snapshot={snapshot}
                            loading={loading}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Profile;
