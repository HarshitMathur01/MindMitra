import { Suspense, lazy } from "react";
import { Brain } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WelcomeHero from "@/components/sections/WelcomeHero";
import DailyAffirmation from "@/components/sections/DailyAffirmation";
import FeaturesPreview from "@/components/sections/FeaturesPreview";
import StatsSection from "@/components/sections/StatsSection";
import TestimonialCarousel from "@/components/sections/TestimonialCarousel";
import CrisisSafetyBadge from "@/components/sections/CrisisSafetyBadge";
import BreathingWidget from "@/components/sections/BreathingWidget";
import ScrollToTop from "@/components/sections/ScrollToTop";
import { useIntersectionObserver } from "@/hooks/useScrollAnimations";

const AvatarShowcase = lazy(() => import("@/components/sections/AvatarShowcase"));

const AnimatedSection = ({ children }: { children: React.ReactNode }) => {
    const [ref, isVisible] = useIntersectionObserver({ triggerOnce: true });

    return (
        <div
            ref={(node) => {
                ref.current = node;
            }}
            className={`transform transition-all duration-700 ease-out ${isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
                }`}
        >
            {children}
        </div>
    );
};

const PublicLanding = () => {
    return (
        <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
            <Header />
            <main>
                <WelcomeHero />

                <AnimatedSection>
                    <FeaturesPreview />
                </AnimatedSection>

                <AnimatedSection>
                    <DailyAffirmation />
                </AnimatedSection>

                <AnimatedSection>
                    <Suspense
                        fallback={
                            <div className="mx-4 my-12 flex h-96 flex-col items-center justify-center rounded-3xl bg-muted/10 py-20 animate-pulse sm:mx-8">
                                <Brain className="mb-4 h-10 w-10 animate-bounce text-primary/40" />
                                <p className="text-sm text-muted-foreground">Loading 3D Experience...</p>
                            </div>
                        }
                    >
                        <AvatarShowcase />
                    </Suspense>
                </AnimatedSection>

                <AnimatedSection>
                    <StatsSection />
                </AnimatedSection>

                <AnimatedSection>
                    <TestimonialCarousel />
                </AnimatedSection>
            </main>

            <Footer />
            <CrisisSafetyBadge />
            <BreathingWidget />
            <ScrollToTop />
        </div>
    );
};

export default PublicLanding;
