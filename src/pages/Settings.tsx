import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { FadeUp } from '@/components/layout/FadeUp';
import { Eyebrow } from '@/components/layout/Eyebrow';
import { PeachBlush } from '@/components/layout/PeachBlush';

const TAB_TRIGGER_CLASS =
    "qc-eyebrow rounded-none border-0 bg-transparent px-0 pb-2 pt-0 inline-flex items-center gap-2 " +
    "data-[state=active]:bg-transparent data-[state=active]:text-[color:var(--qc-ink)] " +
    "data-[state=active]:shadow-none data-[state=active]:[border-bottom:1px_solid_var(--qc-forest)]";

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
            <AppShell className="qc-canvas" hideHeader>
                <div className="flex min-h-screen items-center justify-center px-6">
                    <p className="qc-display mitra-voice text-center text-base text-[color:var(--qc-ink-soft)]">
                        loading your settings…
                    </p>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell className="qc-canvas relative isolate overflow-hidden">
            <PeachBlush position="top-right" size="lg" />

            <PageContainer width="wide" className="relative max-w-[1200px] py-16 pb-28 sm:py-20 md:pb-16">
                <FadeUp>
                    <header className="mb-16 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                        <div className="min-w-0">
                            <Eyebrow>preferences</Eyebrow>
                            <h1 className="qc-display mt-3 text-[clamp(2rem,4.5vw,3rem)] text-[color:var(--qc-ink)]">
                                settings
                            </h1>
                            <p className="mt-4 max-w-[60ch] text-base leading-[1.6] text-[color:var(--qc-ink-soft)]">
                                tune companion, privacy, reminders, and accessibility — everything stays on your device until you save.
                            </p>
                        </div>
                        <div className="shrink-0">
                            <button
                                type="button"
                                className="qc-pill-outline"
                                onClick={() => navigate('/profile')}
                            >
                                <User className="h-4 w-4" strokeWidth={1.6} />
                                <span className="hidden sm:inline">profile</span>
                            </button>
                        </div>
                    </header>
                </FadeUp>

                <FadeUp delay={80}>
                    <section className="rounded-3xl border border-[color:var(--qc-border)] bg-[color:var(--qc-surface)] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] sm:p-12">
                        <Tabs defaultValue="general" className="w-full">
                            <TabsList className="mb-12 flex h-auto w-full flex-wrap justify-start gap-x-8 gap-y-2 rounded-none border-0 border-b border-[color:var(--qc-border)] bg-transparent p-0">
                                <TabsTrigger value="general" className={TAB_TRIGGER_CLASS}>
                                    <SettingsIconLucide className="h-3.5 w-3.5" strokeWidth={1.6} />
                                    general
                                </TabsTrigger>
                                <TabsTrigger value="privacy" className={TAB_TRIGGER_CLASS}>
                                    <Shield className="h-3.5 w-3.5" strokeWidth={1.6} />
                                    privacy
                                </TabsTrigger>
                                <TabsTrigger value="notifications" className={TAB_TRIGGER_CLASS}>
                                    <Bell className="h-3.5 w-3.5" strokeWidth={1.6} />
                                    notifications
                                </TabsTrigger>
                                <TabsTrigger value="accessibility" className={TAB_TRIGGER_CLASS}>
                                    <Accessibility className="h-3.5 w-3.5" strokeWidth={1.6} />
                                    accessibility
                                </TabsTrigger>
                                <TabsTrigger value="account" className={TAB_TRIGGER_CLASS}>
                                    <UserCog className="h-3.5 w-3.5" strokeWidth={1.6} />
                                    account
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
                    </section>
                </FadeUp>
            </PageContainer>
        </AppShell>
    );
};

export default Settings;
