import { lazy, Suspense } from "react";
import Header from "@/components/layout/Header";
import { useAuth } from "@/hooks/useAuth";
import { DashboardSkeleton } from "@/components/layout/DashboardSkeleton";
import PublicLanding from "./PublicLanding";
import SEO from "@/components/system/SEO";

const SanctuaryHome = lazy(() => import("./SanctuaryHome"));

/**
 * `/` route gateway:
 *   - loading           → DashboardSkeleton
 *   - unauthenticated   → PublicLanding (marketing)
 *   - authenticated     → SanctuaryHome (post-login scenic landing)
 *
 * The scenic landing renders its own `<main>` and closing footer block, so
 * we don't wrap it in PageShell or render HillsFooter here.
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
      <Header />
      <Suspense fallback={<DashboardSkeleton />}>
        <SanctuaryHome />
      </Suspense>
    </>
  );
};

export default Index;
