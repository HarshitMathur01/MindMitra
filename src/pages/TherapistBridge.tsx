import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
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
      const profileSnapshot = await fetchEmotionalProfile(user?.id ?? "demo-user");
      const referral = await createReferral({
        userId: user?.id ?? "demo-user",
        therapistId: therapist.id,
        consent: consentState,
        profileSnapshot,
      });

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
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <HeroSection
          onViewProfile={() => document.getElementById("emotional-profile")?.scrollIntoView({ behavior: "smooth" })}
          onFindTherapist={() => document.getElementById("find-therapist")?.scrollIntoView({ behavior: "smooth" })}
        />

        {loadingProfile ? (
          <Card className="p-6 mb-12">
            <Skeleton className="h-8 w-56 mb-4" />
            <Skeleton className="h-72 w-full" />
          </Card>
        ) : (
          profile && <EmotionalProfile profile={profile} />
        )}

        <ConsentForm consentState={consentState} setConsentState={setConsentState} onReviewData={() => setReviewModalOpen(true)} />

        {loadingTherapists ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="p-6">
                <Skeleton className="h-6 w-32 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3 mb-6" />
                <Skeleton className="h-10 w-full" />
              </Card>
            ))}
          </div>
        ) : (
          <TherapistDirectory therapists={therapists} onBook={handleBooking} booking={booking} />
        )}

        <ProcessTimeline />
        <DashboardPreview />
      </main>

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
    </div>
  );
};

export default TherapistBridge;