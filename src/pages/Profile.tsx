import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { House, Settings as SettingsIcon } from "lucide-react";
import { ProfileHero } from "@/components/profile/ProfileHero";
import { PersonalInfo } from "@/components/profile/PersonalInfo";
import { MentalHealthSnapshot } from "@/components/profile/MentalHealthSnapshot";
import { EmergencyContact } from "@/components/profile/EmergencyContact";
import { PersonalitySelector } from "@/components/profile/PersonalitySelector";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/app/AppShell";
import { PageContainer } from "@/components/app/PageContainer";
import { profileSectionCard, profileSectionInner } from "@/components/profile/profileSurface";
import { cn } from "@/lib/utils";
import { FadeUp } from "@/components/layout/FadeUp";
import { Eyebrow } from "@/components/layout/Eyebrow";
import { PeachBlush } from "@/components/layout/PeachBlush";

const Profile = () => {
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const { profile, snapshot, loading, saving, saveProfile } = useProfile();

    useEffect(() => {
        if (!authLoading && !user) {
            navigate("/auth");
        }
    }, [user, authLoading, navigate]);

    if (authLoading) {
        return (
            <AppShell className="qc-canvas" hideHeader>
                <div className="flex min-h-screen items-center justify-center px-6">
                    <p className="qc-display mitra-voice text-center text-base text-[color:var(--qc-ink-soft)]">
                        gathering your space…
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
                            <Eyebrow>your space</Eyebrow>
                            <h1 className="qc-display mt-3 text-[clamp(2rem,4.5vw,3rem)] text-[color:var(--qc-ink)]">
                                about you
                            </h1>
                            <p className="mt-4 max-w-[60ch] text-base leading-[1.6] text-[color:var(--qc-ink-soft)]">
                                a calm record of who you are in this season — edit anytime, share only what feels right.
                            </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-3">
                            <button
                                type="button"
                                className="qc-pill-outline"
                                onClick={() => navigate("/")}
                            >
                                <House className="h-4 w-4" strokeWidth={1.6} />
                                <span className="hidden sm:inline">home</span>
                            </button>
                            <button
                                type="button"
                                className="qc-pill-primary"
                                onClick={() => navigate("/settings")}
                            >
                                <SettingsIcon className="h-4 w-4" strokeWidth={1.6} />
                                <span className="hidden sm:inline">settings</span>
                            </button>
                        </div>
                    </header>
                </FadeUp>

                <FadeUp delay={80}>
                    <div className="space-y-10">
                        <ProfileHero profile={profile} loading={loading} onSave={saveProfile} />

                        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-10">
                            <aside className="space-y-8 lg:col-span-4">
                                <EmergencyContact profile={profile} loading={loading} saving={saving} onSave={saveProfile} />
                            </aside>

                            <div className="space-y-8 lg:col-span-8">
                                <PersonalInfo profile={profile} loading={loading} saving={saving} onSave={saveProfile} />
                                <section className={cn(profileSectionCard, profileSectionInner)}>
                                    <PersonalitySelector />
                                </section>
                                <MentalHealthSnapshot snapshot={snapshot} loading={loading} />
                            </div>
                        </div>
                    </div>
                </FadeUp>
            </PageContainer>
        </AppShell>
    );
};

export default Profile;
