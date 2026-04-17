import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { User, Settings as SettingsIconLucide, Shield, Bell, Accessibility, UserCog } from 'lucide-react';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { PrivacySettings } from '@/components/settings/PrivacySettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { AccessibilitySettings } from '@/components/settings/AccessibilitySettings';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/app/AppShell';
import { PageContainer } from '@/components/app/PageContainer';
import { PageHeader } from '@/components/app/PageHeader';

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
            <AppShell hideHeader>
                <div className="flex min-h-screen items-center justify-center px-6">
                    <motion.div
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="text-center text-base font-normal text-ink-6"
                    >
                        Loading your settings…
                    </motion.div>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <PageContainer width="wide" className="max-w-6xl py-8 pb-28 md:pb-12">
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                >
                    <PageHeader
                        kicker="Preferences"
                        title="Settings"
                        description="Tune companion, privacy, reminders, and accessibility — everything stays on your device until you save."
                        icon={<SettingsIconLucide className="h-5 w-5" strokeWidth={1.8} />}
                        actions={
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate('/profile')}
                                className="gap-2 rounded-full border-ink-3/50 bg-[hsl(var(--card))] shadow-dashboard-soft hover:bg-[hsl(var(--ink-1))]"
                            >
                                <User className="h-4 w-4" strokeWidth={1.8} />
                                <span className="hidden sm:inline">Profile</span>
                            </Button>
                        }
                    />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.25 }}
                >
                    <Card className="overflow-hidden rounded-[1.75rem] border border-ink-3/40 bg-[hsl(var(--card))] shadow-dashboard-soft dark:border-ink-3/30 dark:bg-[hsl(var(--ink-2))]">
                        <CardContent className="p-4 sm:p-8">
                            <Tabs defaultValue="general" className="w-full">
                                <TabsList className="mb-8 flex h-auto flex-wrap gap-1 rounded-2xl border border-ink-3/35 bg-[hsl(var(--ink-1))] p-1 dark:border-ink-3/25 dark:bg-[hsl(var(--ink-2))]/80">
                                    <TabsTrigger
                                        value="general"
                                        className="gap-1.5 rounded-xl text-xs data-[state=active]:border data-[state=active]:border-ink-3/40 data-[state=active]:bg-[hsl(var(--card))] data-[state=active]:text-ink-8 data-[state=active]:shadow-dashboard-soft sm:text-sm"
                                    >
                                        <SettingsIconLucide className="h-3.5 w-3.5" />
                                        General
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="privacy"
                                        className="gap-1.5 rounded-xl text-xs data-[state=active]:border data-[state=active]:border-ink-3/40 data-[state=active]:bg-[hsl(var(--card))] data-[state=active]:text-ink-8 data-[state=active]:shadow-dashboard-soft sm:text-sm"
                                    >
                                        <Shield className="h-3.5 w-3.5" />
                                        Privacy
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="notifications"
                                        className="gap-1.5 rounded-xl text-xs data-[state=active]:border data-[state=active]:border-ink-3/40 data-[state=active]:bg-[hsl(var(--card))] data-[state=active]:text-ink-8 data-[state=active]:shadow-dashboard-soft sm:text-sm"
                                    >
                                        <Bell className="h-3.5 w-3.5" />
                                        Notifications
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="accessibility"
                                        className="gap-1.5 rounded-xl text-xs data-[state=active]:border data-[state=active]:border-ink-3/40 data-[state=active]:bg-[hsl(var(--card))] data-[state=active]:text-ink-8 data-[state=active]:shadow-dashboard-soft sm:text-sm"
                                    >
                                        <Accessibility className="h-3.5 w-3.5" />
                                        Accessibility
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="account"
                                        className="gap-1.5 rounded-xl text-xs data-[state=active]:border data-[state=active]:border-ink-3/40 data-[state=active]:bg-[hsl(var(--card))] data-[state=active]:text-ink-8 data-[state=active]:shadow-dashboard-soft sm:text-sm"
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
            </PageContainer>
        </AppShell>
    );
};

export default Settings;
