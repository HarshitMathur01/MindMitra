import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/app/AppShell";
import { PageContainer } from "@/components/app/PageContainer";
import { profileSectionCard } from "@/components/profile/profileSurface";
import { cn } from "@/lib/utils";
import HeroSection from "@/components/therapist-bridge/HeroSection";
import EmotionalProfile from "@/components/therapist-bridge/EmotionalProfile";
import ConsentForm from "@/components/therapist-bridge/ConsentForm";
import TherapistDirectory from "@/components/therapist-bridge/TherapistDirectory";
import ProcessTimeline from "@/components/therapist-bridge/ProcessTimeline";
import DashboardPreview from "@/components/therapist-bridge/DashboardPreview";
import MoodChart from "@/components/therapist-bridge/MoodChart";
import PatternsCard from "@/components/therapist-bridge/PatternsCard";
import TopicCloud from "@/components/therapist-bridge/TopicCloud";
import AssessmentScores from "@/components/therapist-bridge/AssessmentScores";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { createReferral, fetchEmotionalProfile, fetchTherapists, hasMinimumConsentForBooking } from "@/lib/api/therapist-bridge";
import { defaultConsentState, EmotionalProfile as EmotionalProfileType, Therapist } from "@/lib/types/therapist-bridge";
import { triggerMindGymClinicalSync } from "@/lib/api/syncMindGymClinicalData";
import { exportClinicalBriefToPDF } from "@/lib/utils/exportClinicalPDF";
import { Download, RefreshCw } from "lucide-react";

const TherapistBridge = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [profile, setProfile] = useState<EmotionalProfileType | null>(null);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingTherapists, setLoadingTherapists] = useState(true);
  const [booking, setBooking] = useState(false);
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [consentState, setConsentState] = useState(defaultConsentState);

  useEffect(() => {
    const loadProfile = async () => {
      setLoadingProfile(true);
      try {
        const resolvedProfile = await fetchEmotionalProfile(user?.id ?? "demo-user");
        setProfile(resolvedProfile);
      } catch (error) {
        toast.error("We're having trouble generating your profile. Contact support if this persists.");
        console.error(error);
      } finally {
        setLoadingProfile(false);
      }
    };

    void loadProfile();
  }, [user?.id]);

  useEffect(() => {
    const loadTherapists = async () => {
      setLoadingTherapists(true);
      try {
        const result = await fetchTherapists();
        setTherapists(result);
      } catch (error) {
        toast.error("Unable to load therapists. Please refresh the page.");
        console.error(error);
      } finally {
        setLoadingTherapists(false);
      }
    };

    void loadTherapists();
  }, []);

  const handleBooking = async (therapist: Therapist) => {
    if (!profile) {
      toast.error("Your profile is still loading. Please try again.");
      return;
    }

    if (!hasMinimumConsentForBooking(consentState)) {
      setConsentModalOpen(true);
      return;
    }

    setBooking(true);
    try {
      // Use the profile already in state to ensure WYSIWYS (What You See Is What You Share)
      if (!profile) throw new Error("Profile not loaded");

      const referral = await createReferral({
        userId: user?.id ?? "demo-user",
        therapistId: therapist.id,
        consent: consentState,
        profileSnapshot: profile,
      });

      if (referral.status !== "created") {
        toast.error("Referral could not be completed. Check that you are signed in and try again.");
        return;
      }

      toast.success("Therapist referral created. Proceeding to booking.");
      navigate(`/booking/${referral.id}`);
    } catch (error) {
      toast.error("Unable to create referral right now. Please try again.");
      console.error(error);
    } finally {
      setBooking(false);
    }
  };

  return (
    <AppShell>
      <PageContainer width="wide" className="max-w-6xl py-8 pb-24 md:pb-12">
        <HeroSection
          onViewProfile={() => document.getElementById("emotional-profile")?.scrollIntoView({ behavior: "smooth" })}
          onFindTherapist={() => document.getElementById("find-therapist")?.scrollIntoView({ behavior: "smooth" })}
        />

        {loadingTherapists ? (
          <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className={cn(profileSectionCard, "p-6")}>
                <Skeleton className="mb-4 h-6 w-32" />
                <Skeleton className="mb-2 h-4 w-full" />
                <Skeleton className="mb-6 h-4 w-2/3" />
                <Skeleton className="h-10 w-full rounded-full" />
              </Card>
            ))}
          </div>
        ) : (
          <TherapistDirectory
            therapists={therapists}
            onBook={handleBooking}
            booking={booking}
            userTopics={profile?.topics}
          />
        )}

        {loadingProfile ? (
          <Card className={cn(profileSectionCard, "mb-12 p-6")}>
            <Skeleton className="mb-4 h-8 w-56" />
            <Skeleton className="h-72 w-full rounded-xl" />
          </Card>
        ) : (
          profile && (
            <div className="space-y-6">
              <div
                className={cn(
                  profileSectionCard,
                  "flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6",
                )}
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-5">Clinical data</p>
                  <h3 className="font-display text-lg font-normal text-ink-8">Sync &amp; export</h3>
                  <p className="max-w-xl text-sm leading-relaxed text-ink-5">
                    Pull offline MindGym check-ins into this profile, or download a brief you can share with a clinician.
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full border-ink-3/50"
                    onClick={async () => {
                      const msg = await triggerMindGymClinicalSync();
                      toast(msg, { icon: <RefreshCw className="h-4 w-4" /> });
                    }}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" strokeWidth={1.8} />
                    Sync device
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-full bg-[hsl(var(--accent-500))] text-white hover:bg-[hsl(var(--accent-600))]"
                    onClick={() => {
                      if (!profile) return;
                      exportClinicalBriefToPDF({
                        userId: user?.id || "demo-ID-1234",
                        userName: user?.user_metadata?.full_name || "User",
                        dateStr: new Date().toLocaleDateString(),
                        consentMask: consentState,
                        profileData: profile,
                      });
                      toast.success("Clinical PDF downloaded successfully.");
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" strokeWidth={1.8} />
                    Export PDF
                  </Button>
                </div>
              </div>
              <EmotionalProfile profile={profile} />
            </div>
          )
        )}

        <ConsentForm consentState={consentState} setConsentState={setConsentState} onReviewData={() => setReviewModalOpen(true)} />


        <ProcessTimeline />
        <DashboardPreview />
      </PageContainer>

      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto shadow-xl">
          <DialogHeader>
            <DialogTitle>Your Data Preview</DialogTitle>
            <DialogDescription>This is exactly what the therapist will receive based on your consent.</DialogDescription>
          </DialogHeader>

          {profile && (
            <div className="space-y-6">
              {consentState.shareFullProfile && (
                <>
                  <Card className="p-4">
                    <h3 className="font-semibold mb-3">Mood Trends</h3>
                    <MoodChart data={profile.moodTrends} />
                  </Card>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <PatternsCard patterns={profile.patterns} />
                    <TopicCloud topics={profile.topics} />
                  </div>
                </>
              )}

              {(consentState.shareAssessments || consentState.shareFullProfile) && (
                <AssessmentScores assessments={profile.assessments} />
              )}

              <p className="text-sm text-muted-foreground">This is exactly what the therapist will receive.</p>
              <div className="flex gap-3">
                <Button onClick={() => setReviewModalOpen(false)}>Looks Good, Share</Button>
                <Button variant="outline" onClick={() => setReviewModalOpen(false)}>Edit What I Share</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={consentModalOpen} onOpenChange={setConsentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Consent Required</DialogTitle>
            <DialogDescription>
              Please enable at least assessment sharing or full profile sharing before booking a therapist.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => setConsentModalOpen(false)}>Update Consent</Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default TherapistBridge;