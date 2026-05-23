import { lazy, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { DashboardSkeleton } from "@/components/layout/DashboardSkeleton";
import PublicLanding from "./PublicLanding";
import SEO from "@/components/system/SEO";

const SanctuaryHome = lazy(() => import("./SanctuaryHome"));

/**
 * `/` route gateway:
 *   - loading           → DashboardSkeleton
 *   - unauthenticated   → PublicLanding (marketing)
 *   - authenticated     → SanctuaryHome (post-login sanctuary dashboard)
 *
 * SanctuaryHome provides its own SanctuaryHeader, so we don't render the
 * global Header here — it would double up.
 */
const Index = () => {
  const { user, loading } = useAuth();

  if (loading) return <DashboardSkeleton />;
  if (!user) return <PublicLanding />;

  return (
    <>
      <SEO
        title="Your thread, still here"
        description="Pick up with Mitra, breathe in Mind Gym, or open the therapist bridge — one calm home screen before you dive in."
        path="/"
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <SanctuaryHome />
      </Suspense>
    </>
  );
};

export default Index;
