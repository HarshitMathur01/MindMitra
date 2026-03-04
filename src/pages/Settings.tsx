import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { User, Settings as SettingsIconLucide, Shield, Bell, Accessibility, UserCog } from 'lucide-react';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { PrivacySettings } from '@/components/settings/PrivacySettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { AccessibilitySettings } from '@/components/settings/AccessibilitySettings';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { ReplayOnboarding } from '@/components/settings/ReplayOnboarding';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/hooks/useAuth';

const Settings = () => {
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const { settings, loading, saving, saveSettings } = useSettings();

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
                    Loading your settings...
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-text-primary transition-colors duration-300">
            <Header />
            <main className="container mx-auto px-4 py-6 pb-24 md:pb-8 max-w-4xl">
                {/* Page Header */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between mb-6"
                >
                    <div>
                        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                            <SettingsIconLucide className="h-6 w-6 text-primary" />
                            Settings
                        </h1>
                        <p className="text-sm text-text-secondary mt-1">
                            Customize your MindMitra experience — Apne hisaab se set karein ⚙️
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/profile')}
                        className="rounded-xl border-border hover:border-primary/30 gap-2"
                    >
                        <User className="h-4 w-4" />
                        <span className="hidden sm:inline">Profile</span>
                    </Button>
                </motion.div>

                {/* Settings Tabs */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Card className="bg-surface border-border shadow-sm rounded-2xl">
                        <CardContent className="p-4 sm:p-6">
                            <Tabs defaultValue="general" className="w-full">
                                <TabsList className="mb-6 bg-background/50 rounded-xl p-1 flex-wrap h-auto gap-1">
                                    <TabsTrigger
                                        value="general"
                                        className="rounded-lg gap-1.5 data-[state=active]:bg-surface data-[state=active]:shadow-sm text-xs sm:text-sm"
                                    >
                                        <SettingsIconLucide className="h-3.5 w-3.5" />
                                        General
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="privacy"
                                        className="rounded-lg gap-1.5 data-[state=active]:bg-surface data-[state=active]:shadow-sm text-xs sm:text-sm"
                                    >
                                        <Shield className="h-3.5 w-3.5" />
                                        Privacy
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="notifications"
                                        className="rounded-lg gap-1.5 data-[state=active]:bg-surface data-[state=active]:shadow-sm text-xs sm:text-sm"
                                    >
                                        <Bell className="h-3.5 w-3.5" />
                                        Notifications
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="accessibility"
                                        className="rounded-lg gap-1.5 data-[state=active]:bg-surface data-[state=active]:shadow-sm text-xs sm:text-sm"
                                    >
                                        <Accessibility className="h-3.5 w-3.5" />
                                        Accessibility
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="account"
                                        className="rounded-lg gap-1.5 data-[state=active]:bg-surface data-[state=active]:shadow-sm text-xs sm:text-sm"
                                    >
                                        <UserCog className="h-3.5 w-3.5" />
                                        Account
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="general">
                                    <GeneralSettings
                                        settings={settings}
                                        loading={loading}
                                        saving={saving}
                                        onSave={saveSettings}
                                    />
                                    <div className="mt-6 pt-6 border-t border-border/50">
                                        <ReplayOnboarding />
                                    </div>
                                </TabsContent>

                                <TabsContent value="privacy">
                                    <PrivacySettings
                                        settings={settings}
                                        loading={loading}
                                        saving={saving}
                                        onSave={saveSettings}
                                    />
                                </TabsContent>

                                <TabsContent value="notifications">
                                    <NotificationSettings
                                        settings={settings}
                                        loading={loading}
                                        saving={saving}
                                        onSave={saveSettings}
                                    />
                                </TabsContent>

                                <TabsContent value="accessibility">
                                    <AccessibilitySettings
                                        settings={settings}
                                        loading={loading}
                                        saving={saving}
                                        onSave={saveSettings}
                                    />
                                </TabsContent>

                                <TabsContent value="account">
                                    <AccountSettings loading={loading} />
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </motion.div>
            </main>
        </div>
    );
};

export default Settings;
