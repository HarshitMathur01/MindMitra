import { useAuth } from "@/hooks/useAuth";
import { RouteFallback } from "@/components/layout/RouteFallback";
import SEO from "@/components/system/SEO";
import { loadRoute } from "@/lib/routeChunks";
import { lazy } from "react";

const SanctuaryHome = lazy(loadRoute.sanctuaryHome);
// Lazy so the marketing page's GSAP / Lenis / landing CSS stay out of the
// authenticated bundle. The auth check below is async anyway, so signed-in
// users never wait on this chunk.
const PublicLanding = lazy(loadRoute.publicLanding);

/**
 * `/` route gateway:
 *   - loading           → RouteFallback (home shape)
 *   - unauthenticated   → PublicLanding (marketing)
 *   - authenticated     → SanctuaryHome (post-login sanctuary dashboard)
 *
 * Both branches bring their own header (LandingHeader / SanctuaryHeader),
 * so we don't render the global Header here — it would double up.
 *
 * Note there is deliberately no <Suspense> here any more. A nested boundary
 * always renders its fallback when it first mounts — even inside a
 * transition — which meant arriving at `/` from another route flashed a
 * skeleton before the scenic page. Letting these suspend up to the App-level
 * boundary lets startTransition hold the previous page instead.
 */
const Index = () => {
  const { user, loading } = useAuth();

  if (loading) return <RouteFallback pathname="/" />;
  if (!user) return <PublicLanding />;

  return (
    <>
      <SEO
        title="Your thread, still here"
        description="Pick up with Mitra, breathe in Mind Gym, or open the therapist bridge — one calm home screen before you dive in."
        path="/"
      />
      <SanctuaryHome />
    </>
  );
};

export default Index;
