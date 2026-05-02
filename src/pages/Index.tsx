import Header from "@/components/layout/Header";
import { useAuth } from "@/hooks/useAuth";
import { DashboardSkeleton } from "@/components/layout/DashboardSkeleton";
import PublicLanding from "./PublicLanding";
import SEO from "@/components/system/SEO";
import SanctuaryHome from "./SanctuaryHome";

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
        title="Your quiet companion"
        description="A calm, scrolling sanctuary — pause, breathe, and pick up where you left off with Mitra."
        path="/"
      />
      <Header />
      <SanctuaryHome />
    </>
  );
};

export default Index;
