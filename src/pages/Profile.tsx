import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { House, Settings as SettingsIcon } from "lucide-react";
import { ProfileHero } from "@/components/profile/ProfileHero";
import { PersonalInfo } from "@/components/profile/PersonalInfo";
import { MentalHealthSnapshot } from "@/components/profile/MentalHealthSnapshot";
import { EmergencyContact } from "@/components/profile/EmergencyContact";
import { PersonalitySelector } from "@/components/profile/PersonalitySelector";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/app/AppShell";
import { PageContainer } from "@/components/app/PageContainer";
import { profileSectionCard, profileSectionInner } from "@/components/profile/profileSurface";
import { cn } from "@/lib/utils";

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
            <AppShell hideHeader>
                <div className="flex min-h-screen items-center justify-center px-6">
                    <p className="text-center text-[15px] font-normal text-ink-6">Gathering your space…</p>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <PageContainer width="wide" className="max-w-6xl py-8 pb-28 md:pb-12">
                <header className="mb-10 flex flex-col gap-6 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-5">Your space</p>
                        <h1 className="mt-2 font-display text-[clamp(1.85rem,4vw,2.75rem)] font-normal tracking-tight text-ink-8">
                            About you
                        </h1>
                        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-5">
                            A calm record of who you are in this season — edit anytime, share only what feels right.
                        </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2 rounded-full border-ink-3/50 bg-[hsl(var(--card))] text-ink-7 shadow-dashboard-soft hover:bg-[hsl(var(--ink-1))]"
                            onClick={() => navigate("/")}
                        >
                            <House className="h-4 w-4 stroke-[1.6]" />
                            <span className="hidden sm:inline">Home</span>
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            className="gap-2 rounded-full bg-[hsl(var(--accent-500))] px-4 text-white shadow-md hover:bg-[hsl(var(--accent-600))]"
                            onClick={() => navigate("/settings")}
                        >
                            <SettingsIcon className="h-4 w-4 stroke-[1.6]" />
                            <span className="hidden sm:inline">Settings</span>
                        </Button>
                    </div>
                </header>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 40, damping: 38, mass: 1.15 }}
                    className="space-y-10"
                >
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
                </motion.div>
            </PageContainer>
        </AppShell>
    );
};

export default Profile;
